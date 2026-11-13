import type { PDFHexString } from '../../core/index.js';
import {
  charAtIndex,
  charSplit,
  cleanText,
  lineSplit,
  mergeLines,
} from '../../utils/index.js';
import { CombedTextLayoutError } from '../errors.js';
import type PDFFont from '../PDFFont.js';
import { TextAlignment } from './alignment.js';

export interface TextPosition {
  text: string;
  encoded: PDFHexString;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_FONT_SIZE = 4;
const MAX_FONT_SIZE = 500;

const computeFontSize = (
  lines: string[],
  font: PDFFont,
  bounds: LayoutBounds,
  multiline: boolean = false,
) => {
  let fontSize = MIN_FONT_SIZE;

  while (fontSize < MAX_FONT_SIZE) {
    let linesUsed = 0;

    for (
      let lineIdx = 0, lineLen = lines.length;
      lineIdx < lineLen;
      lineIdx++
    ) {
      linesUsed += 1;

      const line = lines[lineIdx]!;
      const words = line.split(' ');

      // Layout the words using the current `fontSize`, line wrapping
      // whenever we reach the end of the current line.
      let spaceInLineRemaining = bounds.width;
      for (let idx = 0, len = words.length; idx < len; idx++) {
        const isLastWord = idx === len - 1;
        const word = isLastWord ? words[idx]! : `${words[idx]!} `;
        const widthOfWord = font.widthOfTextAtSize(word, fontSize);
        spaceInLineRemaining -= widthOfWord;
        if (spaceInLineRemaining <= 0) {
          linesUsed += 1;
          spaceInLineRemaining = bounds.width - widthOfWord;
        }
      }
    }

    // Return if we exceeded the allowed width
    if (!multiline && linesUsed > lines.length) return fontSize - 1;

    const height = font.heightAtSize(fontSize);
    const lineHeight = height + height * 0.2;
    const totalHeight = lineHeight * linesUsed;

    // Return if we exceeded the allowed height
    if (totalHeight > Math.abs(bounds.height)) return fontSize - 1;

    fontSize += 1;
  }

  return fontSize;
};

const computeCombedFontSize = (
  line: string,
  font: PDFFont,
  bounds: LayoutBounds,
  cellCount: number,
) => {
  const cellWidth = bounds.width / cellCount;
  const cellHeight = bounds.height;

  let fontSize = MIN_FONT_SIZE;

  const chars = charSplit(line);
  while (fontSize < MAX_FONT_SIZE) {
    for (let idx = 0, len = chars.length; idx < len; idx++) {
      const c = chars[idx]!;
      const tooLong = font.widthOfTextAtSize(c, fontSize) > cellWidth * 0.75;
      if (tooLong) return fontSize - 1;
    }

    const height = font.heightAtSize(fontSize, { descender: false });
    if (height > cellHeight) return fontSize - 1;

    fontSize += 1;
  }

  return fontSize;
};

export interface LayoutTextOptions {
  alignment: TextAlignment;
  fontSize: number | undefined;
  font: PDFFont;
  bounds: LayoutBounds;
}

export interface MultilineTextLayout {
  bounds: LayoutBounds;
  lines: TextPosition[];
  fontSize: number;
  lineHeight: number;
}

const splitOutLines = (
  input: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number,
) => {
  // Semantics: the candidate cut points are the start of every whitespace run
  // (including index 0) and the end of the input. The line is the longest
  // candidate prefix whose exact width (kerning, surrogate pairs, ...) is
  // below maxWidth; the remainder starts after the whitespace run at the cut.
  // If no candidate fits, the whole input is returned as one overflowing line.
  //
  // Candidates are discovered lazily and searched by galloping forward from
  // the line start (1, 2, 4, ... candidates) and then binary searching inside
  // the bracket, so the work is proportional to the line, not the remaining
  // paragraph.
  const breaks: number[] = [];
  let scanned = 0;
  let exhausted = false;
  // Ensure breaks[idx] exists if possible; returns false when there is none.
  const hasBreak = (idx: number): boolean => {
    while (breaks.length <= idx && !exhausted) {
      let i = scanned;
      while (
        i < input.length &&
        !(/\s/.test(input[i]!) && (i === 0 || !/\s/.test(input[i - 1]!)))
      ) {
        i++;
      }
      if (i < input.length) {
        breaks.push(i);
        scanned = i + 1;
      } else {
        breaks.push(input.length);
        exhausted = true;
      }
    }
    return idx < breaks.length;
  };

  const widths = new Map<number, number>();
  const widthUpTo = (end: number) => {
    let width = widths.get(end);
    if (width === undefined) {
      width = font.widthOfTextAtSize(input.substring(0, end), fontSize);
      widths.set(end, width);
    }
    return width;
  };

  // This relies on prefix width growing with the candidate index:
  // - Custom fonts sum non-negative advance widths of glyphsForString(), and
  //   cutting before whitespace never changes the glyphs before the cut, so
  //   a longer candidate's glyphs extend a shorter one's.
  // - Standard fonts add pair kerning, which can be negative, but each step
  //   between candidates adds a whitespace glyph plus a word, whose widths
  //   are expected to dwarf any negative kerning between them (true for all
  //   bundled Standard 14 AFM kerning pairs).
  // The forward check after the search extends past the boundary if a longer
  // candidate still fits, so a local non-monotonic step can't shorten a line.
  const fits = (idx: number) =>
    hasBreak(idx) && widthUpTo(breaks[idx]!) < maxWidth;

  // Gallop: find found < high with fits(found) (or found = -1) and !fits(high)
  let found = -1;
  let step = 1;
  while (fits(found + step)) {
    found += step;
    step *= 2;
  }
  let low = found + 1;
  let high = found + step - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (fits(middle)) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  while (fits(found + 1)) found++;

  if (found >= 0) {
    const lastBreakPoint = breaks[found]!;
    const line = input.substring(0, lastBreakPoint);
    // Skip past whitespace to find the start of the next word
    let remainderStart = lastBreakPoint;
    while (remainderStart < input.length && /\s/.test(input[remainderStart]!)) {
      remainderStart++;
    }
    const remainder = input.substring(remainderStart) || undefined;
    return {
      line,
      encoded: font.encodeText(line),
      width: widthUpTo(lastBreakPoint),
      remainder,
    };
  }

  // We were unable to split the input enough to get a chunk that would fit
  // within the specified `maxWidth` so we'll just return everything
  return {
    line: input,
    encoded: font.encodeText(input),
    width: widthUpTo(input.length),
    remainder: undefined,
  };
};

export const layoutMultilineText = (
  text: string,
  { alignment, fontSize, font, bounds }: LayoutTextOptions,
): MultilineTextLayout => {
  const lines = lineSplit(cleanText(text));

  if (fontSize === undefined || fontSize === 0) {
    fontSize = computeFontSize(lines, font, bounds, true);
  }
  const height = font.heightAtSize(fontSize);
  const lineHeight = height + height * 0.2;

  const textLines: TextPosition[] = [];

  let minX = bounds.x;
  let minY = bounds.y;
  let maxX = bounds.x + bounds.width;
  let maxY = bounds.y + bounds.height;

  let y = bounds.y + bounds.height;
  for (let idx = 0, len = lines.length; idx < len; idx++) {
    let prevRemainder: string | undefined = lines[idx];
    while (prevRemainder !== undefined) {
      const { line, encoded, width, remainder } = splitOutLines(
        prevRemainder,
        bounds.width,
        font,
        fontSize,
      );

      // prettier-ignore
      const x =
        alignment === TextAlignment.Left
          ? bounds.x
          : alignment === TextAlignment.Center
            ? bounds.x + bounds.width / 2 - width / 2
            : alignment === TextAlignment.Right
              ? bounds.x + bounds.width - width
              : bounds.x;

      y -= lineHeight;

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + width > maxX) maxX = x + width;
      if (y + height > maxY) maxY = y + height;

      textLines.push({ text: line, encoded, width, height, x, y });

      // Only trim lines that we had to split ourselves. So we won't trim lines
      // that the user provided themselves with whitespace.
      prevRemainder = remainder?.trim();
    }
  }

  return {
    fontSize,
    lineHeight,
    lines: textLines,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
};

export interface LayoutCombedTextOptions {
  fontSize: number | undefined;
  font: PDFFont;
  bounds: LayoutBounds;
  cellCount: number;
}

export interface CombedTextLayout {
  bounds: LayoutBounds;
  cells: TextPosition[];
  fontSize: number;
}

export const layoutCombedText = (
  text: string,
  { fontSize, font, bounds, cellCount }: LayoutCombedTextOptions,
): CombedTextLayout => {
  const line = mergeLines(cleanText(text));

  if (line.length > cellCount) {
    throw new CombedTextLayoutError(line.length, cellCount);
  }

  if (fontSize === undefined || fontSize === 0) {
    fontSize = computeCombedFontSize(line, font, bounds, cellCount);
  }

  const cellWidth = bounds.width / cellCount;

  const height = font.heightAtSize(fontSize, { descender: false });
  const y = bounds.y + (bounds.height / 2 - height / 2);

  const cells: TextPosition[] = [];

  let minX = bounds.x;
  let minY = bounds.y;
  let maxX = bounds.x + bounds.width;
  let maxY = bounds.y + bounds.height;

  let cellOffset = 0;
  let charOffset = 0;
  while (cellOffset < cellCount) {
    const [char, charLength] = charAtIndex(line, charOffset);

    const encoded = font.encodeText(char);
    const width = font.widthOfTextAtSize(char, fontSize);

    const cellCenter = bounds.x + (cellWidth * cellOffset + cellWidth / 2);
    const x = cellCenter - width / 2;

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + width > maxX) maxX = x + width;
    if (y + height > maxY) maxY = y + height;

    cells.push({ text: line, encoded, width, height, x, y });

    cellOffset += 1;
    charOffset += charLength;
  }

  return {
    fontSize,
    cells,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
};

export interface LayoutSinglelineTextOptions {
  alignment: TextAlignment;
  fontSize: number | undefined;
  font: PDFFont;
  bounds: LayoutBounds;
}

export interface SinglelineTextLayout {
  bounds: LayoutBounds;
  line: TextPosition;
  fontSize: number;
}

export const layoutSinglelineText = (
  text: string,
  { alignment, fontSize, font, bounds }: LayoutSinglelineTextOptions,
): SinglelineTextLayout => {
  const line = mergeLines(cleanText(text));

  if (fontSize === undefined || fontSize === 0) {
    fontSize = computeFontSize([line], font, bounds);
  }

  const encoded = font.encodeText(line);
  const width = font.widthOfTextAtSize(line, fontSize);
  const height = font.heightAtSize(fontSize, { descender: false });

  // prettier-ignore
  const x =
    alignment === TextAlignment.Left
      ? bounds.x
      : alignment === TextAlignment.Center
        ? bounds.x + bounds.width / 2 - width / 2
        : alignment === TextAlignment.Right
          ? bounds.x + bounds.width - width
          : bounds.x;

  const y = bounds.y + (bounds.height / 2 - height / 2);

  return {
    fontSize,
    line: { text: line, encoded, width, height, x, y },
    bounds: { x, y, width, height },
  };
};
