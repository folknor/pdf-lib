import { getRandomBytes } from '../../utils/rng.js';
import {
  compareVersions,
  getCatalog,
  getCatalogVersion,
  getEffectiveVersion,
} from '../document/pdfVersion.js';
import PDFArray from '../objects/PDFArray.js';
import PDFDict from '../objects/PDFDict.js';
import PDFHexString from '../objects/PDFHexString.js';
import PDFName from '../objects/PDFName.js';
import PDFRawStream from '../objects/PDFRawStream.js';
import PDFString from '../objects/PDFString.js';
import type PDFContext from '../PDFContext.js';
import DecodeStream from '../streams/DecodeStream.js';
import { decodePDFRawStream } from '../streams/decode.js';
import {
  checkOutputProfile,
  getSRGBProfile,
  SRGB_OUTPUT_CONDITION,
} from './icc.js';
import { XML_NAMESPACE, XMLNS_NAMESPACE, type XmlElement } from './xml.js';
import {
  DC_NS,
  formatXmpDate,
  PDF_NS,
  PDFAID_NS,
  parseXmpDate,
  XMP_NS,
  XmpError,
  XmpPacket,
  type XmpRead,
} from './xmp.js';

/**
 * A PDF/A identification as the catalog XMP states it (ISO 19005,
 * `pdfaid` schema), values as written.
 */
export interface PDFADeclaration {
  part: string;
  conformance?: string;
  amd?: string;
  corr?: string;
  rev?: string;
}

export type PDFAState =
  | { kind: 'none' }
  | { kind: 'declared'; declaration: PDFADeclaration }
  | { kind: 'unreadable'; reason: string };

type MetadataRead =
  | { kind: 'absent' }
  | { kind: 'packet'; packet: XmpPacket; stream: PDFRawStream }
  | { kind: 'unreadable'; reason: string };

const Metadata = PDFName.of('Metadata');
const OutputIntents = PDFName.of('OutputIntents');
const DestOutputProfile = PDFName.of('DestOutputProfile');
const GTS_PDFA1 = PDFName.of('GTS_PDFA1');

/** Whether `object` is the stream the catalog's /Metadata names. */
export const isCatalogMetadata = (
  context: PDFContext,
  object: unknown,
): boolean => {
  const value = getCatalog(context)?.get(Metadata);
  return value !== undefined && context.lookup(value) === object;
};

/** The catalog XMP packet, parsed afresh. Nothing is cached. */
const readMetadata = (context: PDFContext): MetadataRead => {
  const catalog = getCatalog(context);
  const value = catalog?.get(Metadata);
  if (value === undefined) return { kind: 'absent' };
  const stream = context.lookup(value);
  if (!(stream instanceof PDFRawStream)) {
    return {
      kind: 'unreadable',
      reason: 'the catalog /Metadata is not a stream',
    };
  }
  // An unfiltered stream is not bounded by the decoder; bound it here.
  const cap = context.maxDecodedStreamSize ?? DecodeStream.maxDecodedSize;
  if (stream.contents.length > cap) {
    return {
      kind: 'unreadable',
      reason: 'the catalog /Metadata stream is too large',
    };
  }
  let bytes: Uint8Array;
  try {
    bytes = decodePDFRawStream(stream).decode();
  } catch (e) {
    return {
      kind: 'unreadable',
      reason: `the catalog /Metadata stream cannot be decoded (${(e as Error).message})`,
    };
  }
  try {
    return { kind: 'packet', packet: XmpPacket.parse(bytes), stream };
  } catch (e) {
    if (e instanceof XmpError) return { kind: 'unreadable', reason: e.message };
    throw e;
  }
};

const identificationKeys = [
  'part',
  'conformance',
  'amd',
  'corr',
  'rev',
] as const;

const identify = (packet: XmpPacket): PDFAState => {
  const declaration: Record<string, string> = {};
  // Every pdfaid property, known or not, must be a simple value stated once.
  for (const key of packet.propertyNames(PDFAID_NS)) {
    const occurrences = packet.properties(PDFAID_NS, key);
    const values = new Set<string>();
    for (const p of occurrences) {
      const read: XmpRead =
        p.form === 'attribute'
          ? { kind: 'text', value: p.attribute.value }
          : // Read each occurrence alone so that equal duplicates agree.
            readOne(p.element);
      if (read.kind !== 'text') {
        return {
          kind: 'unreadable',
          reason: `pdfaid:${key} is not a simple value`,
        };
      }
      values.add(read.value.trim());
    }
    if (values.size > 1) {
      return {
        kind: 'unreadable',
        reason: `contradictory pdfaid:${key} values (${[...values].join(', ')})`,
      };
    }
    const [value] = values;
    if (value !== undefined) declaration[key] = value;
  }
  if (declaration['part'] === undefined) {
    return packet.hasNamespace(PDFAID_NS)
      ? { kind: 'unreadable', reason: 'pdfaid properties without pdfaid:part' }
      : { kind: 'none' };
  }
  const known: Record<string, string> = {};
  for (const key of identificationKeys) {
    if (declaration[key] !== undefined) known[key] = declaration[key];
  }
  return { kind: 'declared', declaration: known as unknown as PDFADeclaration };
};

const readOne = (element: XmlElement): XmpRead => {
  const onlyText = element.children.every((c) => c.kind !== 'element');
  const plainAttributes = element.attributes.every(
    (a) =>
      a.ns === XMLNS_NAMESPACE ||
      (a.ns === XML_NAMESPACE && a.local === 'lang'),
  );
  if (!onlyText || !plainAttributes) return { kind: 'unsupported', reason: '' };
  return {
    kind: 'text',
    value: element.children
      .map((c) => (c.kind === 'text' ? c.value : ''))
      .join(''),
  };
};

/**
 * Whether, and how, the document declares PDF/A, read from its catalog XMP
 * every time. A packet that cannot be decoded or parsed, or that states
 * contradictory identification, is `unreadable`: never taken as "not PDF/A".
 */
export const getPDFAState = (context: PDFContext): PDFAState => {
  const metadata = readMetadata(context);
  if (metadata.kind === 'absent') return { kind: 'none' };
  if (metadata.kind === 'unreadable') return metadata;
  return identify(metadata.packet);
};

const describe = (state: PDFAState) =>
  state.kind === 'declared'
    ? `declares PDF/A-${state.declaration.part}${state.declaration.conformance ?? ''}`
    : state.kind === 'unreadable'
      ? `has catalog XMP that cannot be read (${state.reason}), so it may declare PDF/A`
      : 'does not declare PDF/A';

/**
 * PDF/A-1 forbids cross-reference streams (ISO 19005-1 6.1.4), and with them
 * object streams; parts 2 to 4 allow both. A declaration this library cannot
 * read, or of a part it does not know, is held to the PDF/A-1 rule.
 */
export const forbidsObjectStreams = (state: PDFAState): boolean =>
  state.kind === 'unreadable' ||
  (state.kind === 'declared' &&
    !['2', '3', '4'].includes(state.declaration.part));

/** Refuse `encrypt()` on a document that declares, or may declare, PDF/A. */
export const assertMayEncrypt = (context: PDFContext): void => {
  const state = getPDFAState(context);
  if (state.kind !== 'none') {
    throw new Error(
      `Cannot encrypt: the document ${describe(state)}, and PDF/A forbids encryption.`,
    );
  }
};

/**
 * The PDF/A rules every write enforces, whichever writer makes it. Called by
 * both writers once the write's encryption is known:
 * - no output that names an /Encrypt dictionary (every part);
 * - for PDF/A-1, no object or cross-reference streams written, and no
 *   increment appended to a file that already uses them, since the
 *   revision chain would still reach them.
 */
export const assertPDFAWrite = (
  context: PDFContext,
  write: { encrypted: boolean; objectStreams: boolean; incremental: boolean },
): void => {
  if (!write.encrypted && !write.objectStreams && !write.incremental) return;
  const state = getPDFAState(context);
  if (state.kind === 'none') return;
  if (write.encrypted) {
    throw new Error(
      `Cannot write an encrypted file: the document ${describe(state)}, and PDF/A forbids encryption.`,
    );
  }
  if (!forbidsObjectStreams(state)) return;
  if (write.objectStreams) {
    throw new Error(
      `Cannot write object or cross-reference streams: the document ${describe(state)}, and PDF/A-1 forbids them. Save with useObjectStreams: false.`,
    );
  }
  if (write.incremental && context.pdfFileDetails.useObjectStreams) {
    throw new Error(
      `Cannot append an increment: the document ${describe(state)}, PDF/A-1 forbids cross-reference streams, and the file being extended uses them. Save with rewrite: true.`,
    );
  }
};

/** The Info entries with an XMP counterpart, and how each maps. */
type InfoMapping = {
  read: (p: XmpPacket) => XmpRead;
  write: (p: XmpPacket, value: string | Date) => void;
  isDate: boolean;
};

const textMapping = (ns: string, local: string): InfoMapping => ({
  read: (p) => p.readText(ns, local),
  write: (p, v) => p.setText(ns, local, v as string),
  isDate: false,
});
const dateMapping = (ns: string, local: string): InfoMapping => ({
  read: (p) => p.readText(ns, local),
  write: (p, v) => p.setText(ns, local, formatXmpDate(v as Date)),
  isDate: true,
});

export const infoMappings = {
  Title: {
    read: (p: XmpPacket) => p.readDefaultLanguage(DC_NS, 'title'),
    write: (p: XmpPacket, v: string | Date) =>
      p.setDefaultLanguage(DC_NS, 'title', v as string),
    isDate: false,
  },
  Author: {
    read: (p: XmpPacket): XmpRead => {
      const list = p.readList(DC_NS, 'creator', true);
      if (list.kind !== 'list') return list;
      return list.values.length === 1
        ? { kind: 'text', value: list.values[0]! }
        : {
            kind: 'unsupported',
            reason: `dc:creator has ${list.values.length} entries`,
          };
    },
    write: (p: XmpPacket, v: string | Date) =>
      p.setSingleItemList(DC_NS, 'creator', v as string),
    isDate: false,
  },
  Subject: {
    read: (p: XmpPacket) => p.readDefaultLanguage(DC_NS, 'description'),
    write: (p: XmpPacket, v: string | Date) =>
      p.setDefaultLanguage(DC_NS, 'description', v as string),
    isDate: false,
  },
  Keywords: textMapping(PDF_NS, 'Keywords'),
  Creator: textMapping(XMP_NS, 'CreatorTool'),
  Producer: textMapping(PDF_NS, 'Producer'),
  CreationDate: dateMapping(XMP_NS, 'CreateDate'),
  ModDate: dateMapping(XMP_NS, 'ModifyDate'),
} satisfies Record<string, InfoMapping>;

export type InfoKey = keyof typeof infoMappings;

const wholeSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

const writeMetadata = (
  context: PDFContext,
  existing: PDFRawStream | undefined,
  bytes: Uint8Array,
) => {
  if (existing) {
    // Rewritten in place, unfiltered; updateContents marks it for increments.
    existing.dict.delete(PDFName.of('Filter'));
    existing.dict.delete(PDFName.of('DecodeParms'));
    existing.dict.set(PDFName.of('Type'), Metadata);
    existing.dict.set(PDFName.of('Subtype'), PDFName.of('XML'));
    existing.updateContents(bytes);
    return;
  }
  const stream = context.stream(bytes, { Type: 'Metadata', Subtype: 'XML' });
  getCatalog(context)!.set(Metadata, context.register(stream));
};

/**
 * Prepare an Info edit on a document that may declare PDF/A. Returns the
 * function that writes the matching XMP property, to run with the Info
 * change; every check runs, and the new packet is built, before either is
 * changed. For a document that declares nothing it returns a no-op.
 *
 * A document whose XMP cannot be read, or that declares PDF/A-4 or a part
 * this library does not know (PDF/A-4 permits no Info entries but /ModDate,
 * and only with /PieceInfo), is refused.
 */
export const planInfoEdit = (
  context: PDFContext,
  key: InfoKey,
  value: string | Date,
): (() => void) => {
  const metadata = readMetadata(context);
  if (metadata.kind === 'absent') return () => {};
  if (metadata.kind === 'unreadable') {
    throw new Error(
      `Cannot set /${key}: the catalog XMP cannot be read (${metadata.reason}), so the document may declare PDF/A and its XMP could not be kept in step.`,
    );
  }
  const state = identify(metadata.packet);
  if (state.kind === 'none') return () => {};
  if (state.kind === 'unreadable') {
    throw new Error(`Cannot set /${key}: the document ${describe(state)}.`);
  }
  if (!['1', '2', '3'].includes(state.declaration.part)) {
    throw new Error(
      `Cannot set /${key}: the document ${describe(state)}, whose Info dictionary this library does not edit.`,
    );
  }
  try {
    infoMappings[key].write(metadata.packet, value);
  } catch (e) {
    if (e instanceof XmpError) {
      throw new Error(`Cannot set /${key} on a PDF/A document: ${e.message}`);
    }
    throw e;
  }
  const bytes = metadata.packet.serialize();
  return () => writeMetadata(context, metadata.stream, bytes);
};

export interface OutputIntentOptions {
  /** The ICC profile bytes. */
  profile: Uint8Array;
  /** The output condition identifier, e.g. a registry name. */
  outputConditionIdentifier: string;
  /** A description of the output condition. */
  info?: string;
}

export interface DeclarePDFAOptions {
  part: 1 | 2 | 3;
  conformance: 'B' | 'U';
  /**
   * The output intent to add when the document has none. Defaults to a
   * generated sRGB profile.
   */
  outputIntent?: OutputIntentOptions;
}

type InfoReader = (key: InfoKey) => string | Date | undefined;

const lookupIntents = (
  context: PDFContext,
  catalog: PDFDict,
): PDFArray | undefined => {
  const value = catalog.get(OutputIntents);
  if (value === undefined) return undefined;
  const intents = context.lookup(value);
  if (!(intents instanceof PDFArray)) {
    throw new Error(
      'Cannot declare PDF/A: the catalog /OutputIntents is not an array.',
    );
  }
  return intents;
};

const checkExistingIntents = (
  context: PDFContext,
  intents: PDFArray,
  part: number,
) => {
  let pdfaIntents = 0;
  let sharedProfile: unknown;
  for (let i = 0; i < intents.size(); i++) {
    const intent = context.lookup(intents.get(i));
    if (!(intent instanceof PDFDict)) {
      throw new Error(
        'Cannot declare PDF/A: an output intent is not a dictionary.',
      );
    }
    const isPDFA = intent.lookup(PDFName.of('S')) === GTS_PDFA1;
    if (isPDFA) pdfaIntents++;
    const profileRef = intent.get(DestOutputProfile);
    if (profileRef === undefined) {
      if (isPDFA) {
        throw new Error(
          'Cannot declare PDF/A: the GTS_PDFA1 output intent has no /DestOutputProfile.',
        );
      }
      continue;
    }
    // ISO 19005-1 6.2.2, -2 6.2.3: every intent's profile is the same object.
    if (sharedProfile !== undefined && profileRef !== sharedProfile) {
      throw new Error(
        'Cannot declare PDF/A: the output intents name different /DestOutputProfile objects.',
      );
    }
    sharedProfile = profileRef;
    const profile = context.lookup(profileRef);
    if (!(profile instanceof PDFRawStream)) {
      throw new Error(
        'Cannot declare PDF/A: an output intent profile is not a stream.',
      );
    }
    let bytes: Uint8Array;
    try {
      bytes = decodePDFRawStream(profile).decode();
    } catch (e) {
      throw new Error(
        `Cannot declare PDF/A: an output intent profile cannot be decoded (${(e as Error).message}).`,
      );
    }
    const checked = checkOutputProfile(bytes, part);
    if ('error' in checked) {
      throw new Error(
        `Cannot declare PDF/A-${part}: in the existing output intent, ${checked.error}.`,
      );
    }
  }
  if (pdfaIntents === 0) {
    throw new Error(
      'Cannot declare PDF/A: the document has output intents but none with /S /GTS_PDFA1, and they are not replaced.',
    );
  }
};

const isIdString = (o: unknown) =>
  o instanceof PDFString || o instanceof PDFHexString;

/**
 * What a document must be for this library to write or keep a PDF/A-1 to -3
 * declaration on it: not encrypted by `encrypt()`, with a catalog and a
 * well-formed catalog /Version, and an effective version PDF 1.0 to 1.7
 * (ISO 19005-2/-3 5.1 admit those headers; PDF/A-1 is PDF 1.4-based but
 * reads any of them the same way here).
 */
const assertDeclarable = (context: PDFContext, part: number): PDFDict => {
  if (context.security) {
    throw new Error(
      'Cannot declare PDF/A after encrypt(): PDF/A forbids encryption.',
    );
  }
  const catalog = getCatalog(context);
  if (!catalog)
    throw new Error('Cannot declare PDF/A: the document has no catalog.');
  if (getCatalogVersion(context) === 'malformed') {
    throw new Error('Cannot declare PDF/A: the catalog /Version is malformed.');
  }
  const version = getEffectiveVersion(context);
  if (
    compareVersions(version, [1, 0]) < 0 ||
    compareVersions(version, [1, 7]) > 0
  ) {
    throw new Error(
      `Cannot declare PDF/A-${part} for a PDF ${version.join('.')} document; parts 1 to 3 are PDF 1.0 to 1.7.`,
    );
  }
  return catalog;
};

/**
 * Declare the document PDF/A: see `PDFDocument.declarePDFA`. Every check
 * runs and every new object is built before anything is changed.
 */
export const declarePDFA = (
  context: PDFContext,
  options: DeclarePDFAOptions,
  readInfo: InfoReader,
): void => planDeclarePDFA(context, options, readInfo)();

/**
 * Check and build a PDF/A declaration, returning the function that applies
 * it. `edit` makes further changes to the same XMP packet, written in the
 * same metadata write; an `XmpError` from it refuses the declaration.
 */
export const planDeclarePDFA = (
  context: PDFContext,
  options: DeclarePDFAOptions,
  readInfo: InfoReader,
  edit?: (packet: XmpPacket) => void,
): (() => void) => {
  const { part, conformance, outputIntent } = options;
  if (part !== 1 && part !== 2 && part !== 3) {
    throw new Error(`PDF/A part must be 1, 2 or 3, not ${String(part)}.`);
  }
  if (conformance !== 'B' && conformance !== 'U') {
    throw new Error(
      `PDF/A conformance must be 'B' or 'U', not ${String(conformance)}.`,
    );
  }
  if (part === 1 && conformance === 'U') {
    throw new Error('PDF/A-1 has no conformance level U.');
  }
  const catalog = assertDeclarable(context, part);

  const metadata = readMetadata(context);
  if (metadata.kind === 'unreadable') {
    throw new Error(
      `Cannot declare PDF/A: the catalog XMP cannot be read (${metadata.reason}).`,
    );
  }
  const packet =
    metadata.kind === 'packet' ? metadata.packet : XmpPacket.create();
  const state = identify(packet);
  if (state.kind === 'unreadable') {
    throw new Error(`Cannot declare PDF/A: the document ${describe(state)}.`);
  }
  if (state.kind === 'declared') {
    const { declaration } = state;
    if (
      declaration.part !== String(part) ||
      declaration.conformance?.toUpperCase() !== conformance
    ) {
      throw new Error(
        `Cannot declare PDF/A-${part}${conformance}: the document already ${describe(state)}, which is not changed.`,
      );
    }
  }

  // Trailer /ID (ISO 19005-1 6.1.3, -2/-3 6.1.3).
  const { ID } = context.trailerInfo;
  if (ID !== undefined) {
    const id = context.lookup(ID);
    if (
      !(id instanceof PDFArray) ||
      id.size() !== 2 ||
      !isIdString(id.lookup(0)) ||
      !isIdString(id.lookup(1))
    ) {
      throw new Error(
        'Cannot declare PDF/A: the trailer /ID is not an array of two strings.',
      );
    }
  }

  // Output intent.
  const intents = lookupIntents(context, catalog);
  let newIntent: (() => void) | undefined;
  if (intents && intents.size() > 0) {
    if (outputIntent) {
      throw new Error(
        'Cannot declare PDF/A with an outputIntent: the document already has output intents, which are not replaced.',
      );
    }
    checkExistingIntents(context, intents, part);
  } else {
    const profile = outputIntent?.profile ?? getSRGBProfile();
    const identifier =
      outputIntent?.outputConditionIdentifier ?? SRGB_OUTPUT_CONDITION;
    if (!(profile instanceof Uint8Array))
      throw new Error('outputIntent.profile must be a Uint8Array.');
    if (typeof identifier !== 'string') {
      throw new Error(
        'outputIntent.outputConditionIdentifier must be a string.',
      );
    }
    const checked = checkOutputProfile(profile, part);
    if ('error' in checked)
      throw new Error(`Cannot declare PDF/A-${part}: ${checked.error}.`);
    const info = outputIntent ? outputIntent.info : SRGB_OUTPUT_CONDITION;
    newIntent = () => {
      const profileRef = context.register(
        context.flateStream(profile, { N: checked.components }),
      );
      const intent = context.obj({
        Type: 'OutputIntent',
        S: 'GTS_PDFA1',
        OutputConditionIdentifier: PDFHexString.fromText(identifier),
        Info: info === undefined ? undefined : PDFHexString.fromText(info),
        DestOutputProfile: profileRef,
      });
      const ref = context.register(intent);
      if (intents) intents.push(ref);
      else catalog.set(OutputIntents, context.obj([ref]));
    };
  }

  // XMP. A missing counterpart of an Info entry is added from Info. PDF/A-1
  // requires each Info entry to equal its counterpart (ISO 19005-1 6.7.3),
  // so for it a conflicting or uncomparable one is refused; parts 2 and 3
  // impose no such rule, and existing counterparts are left as they are.
  try {
    for (const key of Object.keys(infoMappings) as InfoKey[]) {
      const info = readInfo(key);
      if (info === undefined) continue;
      const mapping = infoMappings[key];
      const xmp = mapping.read(packet);
      if (xmp.kind === 'absent') {
        mapping.write(packet, info);
        continue;
      }
      if (part === 1) {
        if (xmp.kind === 'unsupported') {
          throw new XmpError(
            `its XMP counterpart of /${key} cannot be compared (${xmp.reason})`,
          );
        }
        const same = mapping.isDate
          ? parseXmpDate(xmp.value) !== undefined &&
            wholeSeconds(parseXmpDate(xmp.value)!) ===
              wholeSeconds(info as Date)
          : xmp.value === info;
        if (!same) {
          throw new XmpError(
            `Info /${key} and its XMP counterpart differ, and neither is chosen over the other`,
          );
        }
      }
    }
    if (state.kind === 'none') {
      packet.setText(PDFAID_NS, 'part', String(part));
      packet.setText(PDFAID_NS, 'conformance', conformance);
    }
    edit?.(packet);
  } catch (e) {
    if (e instanceof XmpError)
      throw new Error(`Cannot declare PDF/A-${part}: ${e.message}.`);
    throw e;
  }
  const bytes = packet.serialize();

  const newId =
    ID === undefined ? PDFHexString.fromBytes(getRandomBytes(16)) : undefined;

  // Everything is checked; apply.
  return () => {
    writeMetadata(
      context,
      metadata.kind === 'packet' ? metadata.stream : undefined,
      bytes,
    );
    newIntent?.();
    if (newId) context.trailerInfo.ID = context.obj([newId, newId]);
  };
};

/**
 * Plan an XMP edit for a document that is to be PDF/A-3: one that declares
 * PDF/A-3A, -3B or -3U keeps its declaration and has `edit` applied to its
 * packet; one that declares nothing is declared PDF/A-3B (as by
 * `declarePDFA`) with `edit` in the same write. Any other declaration, or
 * XMP that cannot be read, is refused. Returns the function that applies
 * the change; nothing is changed before it runs.
 */
export const planPDFA3Edit = (
  context: PDFContext,
  readInfo: InfoReader,
  what: string,
  edit: (packet: XmpPacket) => void,
): (() => void) => {
  assertDeclarable(context, 3);
  const metadata = readMetadata(context);
  if (metadata.kind === 'unreadable') {
    throw new Error(
      `Cannot ${what}: the catalog XMP cannot be read (${metadata.reason}).`,
    );
  }
  const declare = () =>
    planDeclarePDFA(context, { part: 3, conformance: 'B' }, readInfo, edit);
  if (metadata.kind === 'absent') return declare();
  const state = identify(metadata.packet);
  if (state.kind === 'none') return declare();
  if (
    state.kind !== 'declared' ||
    state.declaration.part !== '3' ||
    !['A', 'B', 'U'].includes(
      state.declaration.conformance?.toUpperCase() ?? '',
    )
  ) {
    throw new Error(
      `Cannot ${what}: it needs PDF/A-3, and the document ${describe(state)}.`,
    );
  }
  try {
    edit(metadata.packet);
  } catch (e) {
    if (e instanceof XmpError) throw new Error(`Cannot ${what}: ${e.message}.`);
    throw e;
  }
  const bytes = metadata.packet.serialize();
  const { stream } = metadata;
  return () => writeMetadata(context, stream, bytes);
};
