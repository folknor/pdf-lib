import { toHexString, toHexStringOfMinLength } from '../../utils/index.js';
import {
  hasSurrogates,
  highSurrogate,
  isWithinBMP,
  lowSurrogate,
} from '../../utils/unicode.js';

/** [fontId, codePoint] */
type BfChar = [string, string];

/** A ToUnicode entry: a two-byte character code and the text it stands for. */
export type ToUnicodeEntry = readonly [
  code: number,
  codePoints: readonly number[],
];

/**
 * `entries` should be sorted by code, one per code, each with at least one
 * code point (an empty destination is malformed).
 */
export const createCmap = (entries: readonly ToUnicodeEntry[]) => {
  const bfChars: BfChar[] = new Array(entries.length);

  for (let idx = 0, len = entries.length; idx < len; idx++) {
    const [code, codePoints] = entries[idx]!;
    const id = cmapHexFormat(cmapHexString(code));
    const unicode = cmapHexFormat(...codePoints.map(cmapCodePointFormat));
    bfChars[idx] = [id, unicode];
  }

  return fillCmapTemplate(bfChars);
};

/* =============================== Templates ================================ */

const fillCmapTemplate = (bfChars: BfChar[]) => `\
/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo <<
  /Registry (Adobe)
  /Ordering (UCS)
  /Supplement 0
>> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000><ffff>
endcodespacerange
${bfChars.length} beginbfchar
${bfChars.map(([glyphId, codePoint]) => `${glyphId} ${codePoint}`).join('\n')}
endbfchar
endcmap
CMapName currentdict /CMap defineresource pop
end
end\
`;

/* =============================== Utilities ================================ */

const cmapHexFormat = (...values: string[]) => `<${values.join('')}>`;

const cmapHexString = (value: number) => toHexStringOfMinLength(value, 4);

const cmapCodePointFormat = (codePoint: number) => {
  if (isWithinBMP(codePoint)) return cmapHexString(codePoint);

  if (hasSurrogates(codePoint)) {
    const hs = highSurrogate(codePoint);
    const ls = lowSurrogate(codePoint);

    return `${cmapHexString(hs)}${cmapHexString(ls)}`;
  }

  const hex = toHexString(codePoint);
  const msg = `0x${hex} is not a valid UTF-8 or UTF-16 codepoint.`;
  throw new Error(msg);
};
