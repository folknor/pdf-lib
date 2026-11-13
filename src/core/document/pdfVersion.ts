import PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import PDFRef from '../objects/PDFRef.js';
import type PDFContext from '../PDFContext.js';
import PDFHeader from './PDFHeader.js';

/** A PDF version as `[major, minor]`. */
export type PDFVersion = readonly [number, number];

export const parsePDFVersion = (text: string): PDFVersion | undefined => {
  const match = /^(\d{1,4})\.(\d{1,4})$/.exec(text);
  return match ? [Number(match[1]), Number(match[2])] : undefined;
};

export const compareVersions = (a: PDFVersion, b: PDFVersion): number =>
  a[0] - b[0] || a[1] - b[1];

export const maxVersion = (a: PDFVersion, b: PDFVersion): PDFVersion =>
  compareVersions(a, b) >= 0 ? a : b;

export const versionString = (version: PDFVersion): string =>
  `${version[0]}.${version[1]}`;

export const getCatalog = (context: PDFContext): PDFDict | undefined => {
  const root = context.trailerInfo.Root;
  if (!root) return undefined;
  const catalog = context.lookup(root);
  return catalog instanceof PDFDict ? catalog : undefined;
};

/**
 * The catalog's /Version: `undefined` when absent, `'malformed'` when present
 * but not a name of the form `/major.minor`.
 */
export const getCatalogVersion = (
  context: PDFContext,
): PDFVersion | 'malformed' | undefined => {
  const value = getCatalog(context)?.lookup(PDFName.of('Version'));
  if (value === undefined) return undefined;
  if (!(value instanceof PDFName)) return 'malformed';
  return parsePDFVersion(value.decodeText()) ?? 'malformed';
};

/**
 * The version a document declares: the later of its header and its catalog
 * /Version (ISO 32000-2 7.7.2). A malformed catalog /Version is ignored here;
 * callers that must not silently pass over it check `getCatalogVersion`.
 */
export const getEffectiveVersion = (context: PDFContext): PDFVersion => {
  const header = parsePDFVersion(context.header.getVersionString()) ?? [1, 0];
  const catalog = getCatalogVersion(context);
  return catalog === undefined || catalog === 'malformed'
    ? header
    : maxVersion(header, catalog);
};

export const supportsObjectStreams = (version: PDFVersion): boolean =>
  compareVersions(version, [1, 5]) >= 0;

const OBJECT_STREAM_VERSION: PDFVersion = [1, 5];

/**
 * The version an increment appended now would declare: the header of the
 * bytes it extends (not `context.header`, which a full save or a caller may
 * have changed since load) and the catalog /Version it writes.
 */
export const getIncrementVersion = (context: PDFContext): PDFVersion => {
  const original = context.pdfFileDetails.originalHeader ?? context.header;
  const header = parsePDFVersion(original.getVersionString()) ?? [1, 0];
  const catalog = getCatalogVersion(context);
  return catalog === undefined || catalog === 'malformed'
    ? header
    : maxVersion(header, catalog);
};

const checkObjectStreamDeclarations = (
  context: PDFContext,
  incremental: boolean,
): void => {
  if (getCatalogVersion(context) === 'malformed') {
    throw new Error(
      'Cannot write object streams: the catalog /Version is malformed.',
    );
  }
  if (incremental) {
    if (!(context.trailerInfo.Root instanceof PDFRef) || !getCatalog(context)) {
      throw new Error(
        'Cannot write object streams in an increment: the trailer /Root is not a reference to a catalog dictionary.',
      );
    }
  } else if (!parsePDFVersion(context.header.getVersionString())) {
    throw new Error(
      `Cannot write object streams: unrecognised PDF header version '${context.header.getVersionString()}'.`,
    );
  }
};

/**
 * Object and cross-reference streams need PDF 1.5 (ISO 32000-1 7.5.7, 7.5.8).
 * Validates the declarations a save with object streams relies on and
 * returns the change that makes them sufficient, to be applied once the save
 * has prepared the document and is about to write: a full save raises the
 * header to 1.5, an increment (whose header is the original file's) raises
 * the catalog /Version and marks the catalog for the increment. Nothing is
 * lowered. The returned function validates again and recomputes, so it
 * raises only what is still below 1.5 when it runs.
 */
export const planObjectStreamVersion = (
  context: PDFContext,
  incremental: boolean,
): (() => void) => {
  checkObjectStreamDeclarations(context, incremental);
  return () => {
    checkObjectStreamDeclarations(context, incremental);
    const version = incremental
      ? getIncrementVersion(context)
      : getEffectiveVersion(context);
    if (supportsObjectStreams(version)) return;
    const [major, minor] = OBJECT_STREAM_VERSION;
    if (!incremental) {
      context.header = PDFHeader.forVersion(major, minor);
      return;
    }
    getCatalog(context)!.set(
      PDFName.of('Version'),
      PDFName.of(versionString(OBJECT_STREAM_VERSION)),
    );
    context.snapshot?.markRefForSave(context.trailerInfo.Root as PDFRef);
  };
};
