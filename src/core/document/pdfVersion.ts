import PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import type PDFContext from '../PDFContext.js';

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
