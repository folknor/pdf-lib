import { AFRelationship } from '../core/embedders/FileEmbedder.js';
import {
  PDFArray,
  type PDFContext,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFRef,
  PDFString,
} from '../core/index.js';
import {
  FACTUR_X_FILE_NAME,
  type FacturXProfile,
} from '../core/metadata/facturx.js';
import { collectUnreferenced } from './detach.js';
import {
  checkNameTree,
  insertIntoNameTree,
  readNameTree,
  removeFromNameTree,
} from './nameTree.js';

export interface EmbedFacturXOptions {
  /**
   * The profile the caller expects. The profile is read from the invoice
   * XML's guideline identifier; this only asserts it, and a mismatch throws.
   * `'BASIC_WL'` is accepted for `'BASIC WL'`.
   */
  conformanceLevel?: FacturXProfile | 'BASIC_WL';
  /**
   * How the invoice relates to the PDF. MINIMUM and BASIC WL invoices are
   * not complete invoices and are always `Data`. For BASIC, EN 16931 and
   * EXTENDED it is required, and must be `Data`, `Source` or
   * `Alternative`, depending on how the visual PDF was produced (see the
   * Factur-X specification; Germany expects `Alternative`).
   */
  afRelationship?: AFRelationship;
  /** The attachment's description. */
  description?: string;
  /** The XML file's modification date; defaults to now. */
  modificationDate?: Date;
}

const Names = PDFName.of('Names');
const EmbeddedFiles = PDFName.of('EmbeddedFiles');
const Limits = PDFName.of('Limits');
const AF = PDFName.of('AF');
const XRECHNUNG_FILE_NAME = 'xrechnung.xml';

/** Resolve the relationship the invoice is attached with. */
export const facturXRelationship = (
  profile: FacturXProfile,
  requested: AFRelationship | undefined,
): AFRelationship => {
  if (profile === 'MINIMUM' || profile === 'BASIC WL') {
    if (requested !== undefined && requested !== AFRelationship.Data) {
      throw new Error(
        `A Factur-X ${profile} invoice is attached with AFRelationship Data, not ${requested}.`,
      );
    }
    return AFRelationship.Data;
  }
  if (requested === undefined) {
    throw new Error(
      `A Factur-X ${profile} invoice needs an afRelationship (Data, Source or Alternative); it depends on how the PDF was produced.`,
    );
  }
  if (
    requested !== AFRelationship.Data &&
    requested !== AFRelationship.Source &&
    requested !== AFRelationship.Alternative
  ) {
    throw new Error(
      `A Factur-X invoice is attached with AFRelationship Data, Source or Alternative, not ${requested}.`,
    );
  }
  return requested;
};

const stringText = (o: unknown): string | undefined =>
  o instanceof PDFString || o instanceof PDFHexString
    ? o.decodeText()
    : undefined;

/** The names a file specification gives its file (/F and /UF). */
const specNames = (spec: PDFDict): string[] =>
  [
    stringText(spec.lookup(PDFName.of('F'))),
    stringText(spec.lookup(PDFName.of('UF'))),
  ].filter((n): n is string => n !== undefined);

const refusal = (reason: string) =>
  new Error(`Cannot embed a Factur-X invoice: ${reason}.`);

/**
 * Plan putting the invoice in the document's catalog-level attachments:
 * the /EmbeddedFiles name tree and the catalog /AF array. A previous
 * invoice (an entry whose key, /F or /UF is factur-x.xml) is unlinked from
 * both, under every key and every /AF occurrence. Objects only the old
 * invoice used are deleted; references from annotations or pages keep them
 * alive. The containers are replaced rather than edited,
 * since they may be shared. Every check runs before the returned function
 * changes anything.
 */
export const planFacturXAttachment = (
  context: PDFContext,
  catalog: PDFDict,
  file: {
    bytes: Uint8Array;
    relationship: AFRelationship;
    description: string | undefined;
    modificationDate: Date;
  },
): (() => void) => {
  // The name tree.
  const namesValue = catalog.lookup(Names);
  if (namesValue !== undefined && !(namesValue instanceof PDFDict)) {
    throw refusal('the catalog /Names is not a dictionary');
  }
  const efValue = namesValue?.lookup(EmbeddedFiles);
  if (efValue !== undefined && !(efValue instanceof PDFDict)) {
    throw refusal('/EmbeddedFiles is not a dictionary');
  }
  if (efValue) checkNameTree(efValue);
  if (efValue?.has(Limits)) {
    const limits = efValue.lookup(Limits);
    if (
      !(limits instanceof PDFArray) ||
      limits.size() !== 2 ||
      stringText(limits.lookup(0)) === undefined ||
      stringText(limits.lookup(1)) === undefined
    ) {
      throw refusal('the /EmbeddedFiles /Limits is malformed');
    }
  }
  const pairs: { key: PDFString | PDFHexString; value: PDFRef }[] = [];
  const seen = new Set<string>();
  const invoices = new Set<PDFRef>();
  const checkSpec = (ref: unknown, where: string): PDFDict => {
    const spec = ref instanceof PDFRef ? context.lookup(ref) : undefined;
    if (!(spec instanceof PDFDict)) {
      throw refusal(`${where} has an entry that is not a file specification`);
    }
    return spec;
  };
  const classify = (ref: PDFRef, fileSpec: PDFDict, key?: string) => {
    const names = [...specNames(fileSpec), ...(key === undefined ? [] : [key])];
    if (names.includes(XRECHNUNG_FILE_NAME)) {
      throw refusal(
        `the document has an ${XRECHNUNG_FILE_NAME} attachment, and XRECHNUNG is not supported`,
      );
    }
    if (names.includes(FACTUR_X_FILE_NAME)) invoices.add(ref);
  };
  for (const { key, value } of efValue ? readNameTree(efValue) : []) {
    const text = key.decodeText();
    if (seen.has(text)) {
      throw refusal(`the /EmbeddedFiles name tree has ${text} twice`);
    }
    seen.add(text);
    checkSpec(value, 'the /EmbeddedFiles name tree');
    pairs.push({ key, value: value as PDFRef });
  }
  for (const { key, value } of pairs) {
    classify(value, context.lookup(value) as PDFDict, key.decodeText());
  }

  // The catalog /AF array.
  const afValue = catalog.lookup(AF);
  if (afValue !== undefined && !(afValue instanceof PDFArray)) {
    throw refusal('the catalog /AF is not an array');
  }
  const afRefs: PDFRef[] = [];
  for (let i = 0; i < (afValue?.size() ?? 0); i++) {
    const ref = afValue!.get(i);
    const spec = checkSpec(ref, 'the catalog /AF');
    afRefs.push(ref as PDFRef);
    classify(ref as PDFRef, spec);
  }

  // The new file. Its objects are built now and registered on apply.
  const { bytes, relationship, description, modificationDate } = file;
  const stream = context.flateStream(bytes, {
    Type: 'EmbeddedFile',
    Subtype: 'text/xml',
    Params: {
      Size: bytes.length,
      ModDate: PDFString.fromDate(modificationDate),
    },
  });
  const spec = context.obj({
    Type: 'Filespec',
    F: PDFString.of(FACTUR_X_FILE_NAME),
    UF: PDFHexString.fromText(FACTUR_X_FILE_NAME),
    Desc:
      description === undefined
        ? undefined
        : PDFHexString.fromText(description),
    AFRelationship: relationship,
  });

  const catalogNames = catalog.get(Names);
  const catalogAF = catalog.get(AF);

  return () => {
    spec.set(PDFName.of('EF'), context.obj({ F: context.register(stream) }));
    const specRef = context.register(spec);

    const invoiceKeys = new Set(
      pairs.filter(({ value }) => invoices.has(value)).map(({ key }) => key),
    );
    const removed = efValue
      ? removeFromNameTree(context, efValue, (key) => invoiceKeys.has(key))
      : undefined;
    const inserted = insertIntoNameTree(
      context,
      removed?.root ?? efValue ?? context.obj({}),
      PDFHexString.fromText(FACTUR_X_FILE_NAME),
      specRef,
    );
    const namesDict = namesValue ? namesValue.clone(context) : context.obj({});
    namesDict.set(EmbeddedFiles, inserted.root);
    catalog.set(Names, namesDict);

    const af = context.obj(afRefs.filter((r) => !invoices.has(r)));
    af.push(specRef);
    catalog.set(AF, af);

    // Replaced indirect containers can otherwise keep an unlinked invoice
    // alive. Collect them too, while preserving any shared container graph.
    const roots = [
      ...invoices,
      ...(removed?.displaced ?? []),
      ...inserted.displaced,
    ];
    for (const value of [
      catalogNames,
      namesValue?.get(EmbeddedFiles),
      efValue?.get(Names),
      catalogAF,
    ]) {
      if (value instanceof PDFRef) roots.push(value);
    }
    collectUnreferenced(context, roots);
  };
};
