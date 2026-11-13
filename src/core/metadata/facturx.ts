import {
  childElements,
  isXmlText,
  parseXml,
  textContent,
  type XmlDocument,
  XmlError,
} from './xml.js';
import { type ExtensionSchema, XmpError, type XmpPacket } from './xmp.js';

/**
 * Factur-X / ZUGFeRD 2 support, written from the Factur-X specification
 * (FNFE-MPE / FeRD, release 1.07.2, sections 6.2 to 6.3 and 7). Only the five
 * Factur-X profiles are supported. XRECHNUNG is refused: its relationship,
 * file name and fx:Version rules differ, and XRechnung is normally exchanged
 * as plain XML rather than as a hybrid PDF.
 */

export type FacturXProfile =
  | 'MINIMUM'
  | 'BASIC WL'
  | 'BASIC'
  | 'EN 16931'
  | 'EXTENDED';

/** The guideline identifier each profile's invoice XML states. */
const profileByGuideline: Record<string, FacturXProfile> = {
  'urn:factur-x.eu:1p0:minimum': 'MINIMUM',
  'urn:factur-x.eu:1p0:basicwl': 'BASIC WL',
  'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic': 'BASIC',
  'urn:cen.eu:en16931:2017': 'EN 16931',
  'urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended': 'EXTENDED',
};

const RSM_NS = 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100';
const RAM_NS =
  'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100';

export const FACTUR_X_NS =
  'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#';
export const FACTUR_X_FILE_NAME = 'factur-x.xml';

/** Earlier ZUGFeRD / Factur-X namespaces; a packet using one is refused. */
const legacyNamespaces = [
  'urn:ferd:pdfa:CrossIndustryDocument:invoice:1p0#',
  'urn:zugferd:pdfa:CrossIndustryDocument:invoice:1p0#',
  'urn:zugferd:pdfa:CrossIndustryDocument:invoice:2p0#',
];

const facturXSchema: ExtensionSchema = {
  schema: 'Factur-X PDFA Extension Schema',
  namespaceURI: FACTUR_X_NS,
  prefix: 'fx',
  properties: [
    {
      name: 'DocumentFileName',
      valueType: 'Text',
      category: 'external',
      description: 'The name of the embedded XML invoice file',
    },
    {
      name: 'DocumentType',
      valueType: 'Text',
      category: 'external',
      description: 'The type of the hybrid document: INVOICE',
    },
    {
      name: 'Version',
      valueType: 'Text',
      category: 'external',
      description: 'The version of the Factur-X XMP schema',
    },
    {
      name: 'ConformanceLevel',
      valueType: 'Text',
      category: 'external',
      description: 'The Factur-X profile of the embedded XML invoice',
    },
  ],
};

const utf8 = new TextDecoder('utf-8', { fatal: true });

/** Check an XML declaration, if any: XML 1.0, UTF-8. */
const checkDeclaration = (doc: XmlDocument) => {
  const [first] = doc.prolog;
  if (first?.kind !== 'pi' || first.target !== 'xml') return;
  const version = /version\s*=\s*["']([^"']*)["']/.exec(first.data)?.[1];
  if (version !== '1.0') {
    throw new Error(
      `The invoice XML declares version ${version}; only XML 1.0 is supported.`,
    );
  }
  const encoding = /encoding\s*=\s*["']([^"']*)["']/.exec(first.data)?.[1];
  if (encoding !== undefined && encoding.toLowerCase() !== 'utf-8') {
    throw new Error(
      `The invoice XML declares encoding ${encoding}; only UTF-8 is supported.`,
    );
  }
};

/**
 * Read invoice XML, given as UTF-8 bytes or as text, and find its Factur-X
 * profile from the guideline identifier it states. Returns the bytes to
 * embed: the caller's bytes as given, or the text encoded as UTF-8.
 */
export const readFacturXInvoice = (
  xml: string | Uint8Array,
): { bytes: Uint8Array; profile: FacturXProfile } => {
  let text: string;
  let bytes: Uint8Array;
  if (typeof xml === 'string') {
    if (!isXmlText(xml)) {
      throw new Error(
        'The invoice XML contains characters XML cannot represent.',
      );
    }
    // A leading byte order mark is kept in the bytes (as a UTF-8 one) but
    // is not part of the XML text.
    text = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
    bytes = new TextEncoder().encode(xml);
  } else {
    bytes = xml.slice();
    try {
      // Drops a leading UTF-8 byte order mark; a UTF-16 one is refused as
      // a malformed UTF-8 sequence.
      text = utf8.decode(bytes);
    } catch {
      throw new Error('The invoice XML is not valid UTF-8.');
    }
  }
  let doc: XmlDocument;
  try {
    doc = parseXml(text);
  } catch (e) {
    if (e instanceof XmlError) {
      throw new Error(`The invoice XML is not well-formed: ${e.message}`);
    }
    throw e;
  }
  checkDeclaration(doc);
  const { root } = doc;
  if (root.ns !== RSM_NS || root.local !== 'CrossIndustryInvoice') {
    throw new Error(
      'The invoice XML is not a Cross Industry Invoice (rsm:CrossIndustryInvoice, D16B).',
    );
  }
  const ids = childElements(root)
    .filter((e) => e.ns === RSM_NS && e.local === 'ExchangedDocumentContext')
    .flatMap((c) =>
      childElements(c).filter(
        (e) =>
          e.ns === RAM_NS &&
          e.local === 'GuidelineSpecifiedDocumentContextParameter',
      ),
    )
    .flatMap((p) =>
      childElements(p).filter((e) => e.ns === RAM_NS && e.local === 'ID'),
    );
  if (ids.length !== 1) {
    throw new Error(
      `The invoice XML states ${ids.length === 0 ? 'no' : 'more than one'} guideline identifier (GuidelineSpecifiedDocumentContextParameter/ID).`,
    );
  }
  const id = ids[0]!;
  if (childElements(id).length > 0) {
    throw new Error('The invoice XML guideline identifier is not plain text.');
  }
  const guideline = textContent(id).trim();
  const profile = profileByGuideline[guideline];
  if (!profile) {
    throw new Error(
      `The invoice XML states guideline ${guideline}, which is not a supported Factur-X profile (MINIMUM, BASIC WL, BASIC, EN 16931, EXTENDED).`,
    );
  }
  return { bytes, profile };
};

/**
 * Write the Factur-X identification into an XMP packet: the four `fx`
 * properties and the extension schema that declares them (PDF/A requires
 * one for every non-standard schema). Existing `fx` properties are updated
 * whatever prefix they use. Refuses a packet that uses an earlier
 * ZUGFeRD / Factur-X namespace, or names another invoice file.
 */
export const writeFacturXMetadata = (
  packet: XmpPacket,
  profile: FacturXProfile,
): void => {
  const declared = packet.extensionSchemaNamespaces();
  for (const ns of legacyNamespaces) {
    if (packet.hasNamespace(ns) || declared.includes(ns)) {
      throw new XmpError(
        `the XMP uses the earlier ZUGFeRD / Factur-X namespace ${ns}`,
      );
    }
  }
  const fileName = packet.readText(FACTUR_X_NS, 'DocumentFileName');
  if (
    fileName.kind === 'text' &&
    fileName.value.trim() !== FACTUR_X_FILE_NAME
  ) {
    throw new XmpError(
      `the XMP names the invoice file ${fileName.value.trim()}, not ${FACTUR_X_FILE_NAME}`,
    );
  }
  packet.setText(FACTUR_X_NS, 'DocumentType', 'INVOICE', 'fx');
  packet.setText(FACTUR_X_NS, 'DocumentFileName', FACTUR_X_FILE_NAME, 'fx');
  packet.setText(FACTUR_X_NS, 'Version', '1.0', 'fx');
  packet.setText(FACTUR_X_NS, 'ConformanceLevel', profile, 'fx');
  packet.ensureExtensionSchema(facturXSchema);
};
