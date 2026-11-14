import type { EncodedText, TextSpacing } from "../../core/index.js";
import { cleanText, lineSplit, mergeLines } from "../../utils/index.js";
import { CombedTextLayoutError } from "../errors.js";
import type PDFFont from "../PDFFont.js";
import { TextAlignment } from "./alignment.js";

export interface TextPosition {
  text: string;
  encoded: EncodedText;
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

// Keep the first acceptable run of integer sizes, checking both endpoints.
// If even the minimum fails, explicitly test smaller sizes instead of returning
// an unchecked overflow. Nonpositive boxes have no fitting positive size.
const findFontSize = (fits: (size: number) => boolean) => {
  if (!fits(MIN_FONT_SIZE)) {
    let size = MIN_FONT_SIZE - 1;

    while (size > 0) {
      if (fits(size)) return size;
      size /= 2;
    }

    throw new Error("Cannot fit text into the supplied bounds");
  }

  for (let size = MIN_FONT_SIZE + 1; size <= MAX_FONT_SIZE; size++) {
    if (!fits(size)) return size - 1;
  }

  return MAX_FONT_SIZE;
};

const computeFontSize = (
  measureLines: (fontSize: number) => { width: number }[],
  heightAtSize: (fontSize: number, lineCount: number) => number,
  bounds: LayoutBounds,
  inclusiveWidth = false,
) => {
  if (!(bounds.width > 0) || !(bounds.height > 0)) {
    throw new Error("Cannot auto size text into nonpositive bounds");
  }

  return findFontSize((size) => {
    const lines = measureLines(size);

    return (
      lines.every((line) =>
        inclusiveWidth ? line.width <= bounds.width : line.width < bounds.width,
      ) && heightAtSize(size, lines.length) <= bounds.height
    );
  });
};

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

const computeCombedFontSize = (
  clusters: string[],
  font: PDFFont,
  bounds: LayoutBounds,
  cellCount: number,
  spacing?: TextSpacing,
) =>
  computeFontSize(
    (size) =>
      clusters.map((cluster) => ({
        width: font.widthOfTextAtSize(cluster, size, spacing),
      })),
    (size) => font.heightAtSize(size, { descender: false }),
    // Retain the comb's 25% horizontal padding.
    { ...bounds, width: (bounds.width / cellCount) * 0.75 },
    true,
  );

export interface LayoutTextOptions {
  alignment: TextAlignment;
  fontSize: number | undefined;
  font: PDFFont;
  bounds: LayoutBounds;
  spacing?: TextSpacing | undefined;
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
  spacing?: TextSpacing,
) => {
  // Semantics: the candidate cut points are the start of every whitespace run
  // (including index 0) and the end of the input. Each candidate is measured
  // as the whole prefix from the line start, shaped as one string (kerning,
  // contextual rules, surrogate pairs, ...). The line ends before the first
  // candidate whose width is not below maxWidth; the remainder starts after
  // the whitespace run at the cut. If the first candidate does not fit, the
  // whole input is returned as one line whatever its width.
  //
  // Candidates are discovered lazily and scanned forward one by one. A
  // longer prefix is not assumed to be wider: positioned advances can be
  // negative (GPOS, AFM kerning) and contextual rules can reach across a
  // space, so a gallop or binary search would skip a candidate that does not
  // fit and land on an arbitrary fitting one. The scan measures growing
  // prefixes through the first failure, so shaping work is quadratic in the
  // length of the drawn line (which can be the whole paragraph) rather than
  // in the remaining paragraph per line; the fallback also measures the
  // whole input once.
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
      width = font.widthOfTextAtSize(input.substring(0, end), fontSize, spacing);
      widths.set(end, width);
    }

    return width;
  };

  const fits = (idx: number) => hasBreak(idx) && widthUpTo(breaks[idx]!) < maxWidth;

  let found = -1;

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

    return { line, width: widthUpTo(lastBreakPoint), remainder };
  }

  // We were unable to split the input enough to get a chunk that would fit
  // within the specified `maxWidth` so we'll just return everything
  return { line: input, width: widthUpTo(input.length), remainder: undefined };
};

// The lines layoutMultilineText draws, with their widths: both the drawing and
// the auto font size use this, so the size is chosen for the drawn lines.
const wrapLines = (
  lines: string[],
  maxWidth: number,
  font: PDFFont,
  fontSize: number,
  spacing?: TextSpacing,
) => {
  const wrapped: { line: string; width: number }[] = [];

  for (const paragraph of lines) {
    let prevRemainder: string | undefined = paragraph;

    while (prevRemainder !== undefined) {
      const { line, width, remainder } = splitOutLines(
        prevRemainder,
        maxWidth,
        font,
        fontSize,
        spacing,
      );

      wrapped.push({ line, width });
      // Only trim lines that we had to split ourselves. So we won't trim lines
      // that the user provided themselves with whitespace.
      prevRemainder = remainder?.trim();
    }
  }

  return wrapped;
};

export const layoutMultilineText = (
  text: string,
  { alignment, fontSize, font, bounds, spacing }: LayoutTextOptions,
): MultilineTextLayout => {
  const lines = lineSplit(cleanText(text));

  if (fontSize === undefined || fontSize === 0) {
    fontSize = computeFontSize(
      (size) => wrapLines(lines, bounds.width, font, size, spacing),
      (size, count) => {
        const height = font.heightAtSize(size);

        return (height + height * 0.2) * count;
      },
      bounds,
    );
  }

  const height = font.heightAtSize(fontSize);
  const lineHeight = height + height * 0.2;

  const textLines: TextPosition[] = [];

  let minX = bounds.x;
  let minY = bounds.y;
  let maxX = bounds.x + bounds.width;
  let maxY = bounds.y + bounds.height;

  let y = bounds.y + bounds.height;

  for (const { line, width } of wrapLines(lines, bounds.width, font, fontSize, spacing)) {
    const raw = font.encodeText(line);

    const encoded = spacing
      ? raw.withSpacing(spacing.characterSpacing ?? 0, spacing.wordSpacing ?? 0, fontSize)
      : raw;

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
  spacing?: TextSpacing | undefined;
}

export interface CombedTextLayout {
  bounds: LayoutBounds;
  cells: TextPosition[];
  fontSize: number;
}

export const layoutCombedText = (
  text: string,
  { fontSize, font, bounds, cellCount, spacing }: LayoutCombedTextOptions,
): CombedTextLayout => {
  const line = mergeLines(cleanText(text));

  const clusters = Array.from(graphemes.segment(line), ({ segment }) => segment);

  if (clusters.length > cellCount) {
    throw new CombedTextLayoutError(clusters.length, cellCount);
  }

  if (fontSize === undefined || fontSize === 0) {
    fontSize = computeCombedFontSize(clusters, font, bounds, cellCount, spacing);
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

  while (cellOffset < cellCount) {
    const char = clusters[cellOffset] ?? "";

    const raw = font.encodeText(char);

    const encoded = spacing
      ? raw.withSpacing(spacing.characterSpacing ?? 0, spacing.wordSpacing ?? 0, fontSize)
      : raw;

    const width = font.widthOfTextAtSize(char, fontSize, spacing);

    const cellCenter = bounds.x + (cellWidth * cellOffset + cellWidth / 2);
    const x = cellCenter - width / 2;

    if (x < minX) minX = x;

    if (y < minY) minY = y;

    if (x + width > maxX) maxX = x + width;

    if (y + height > maxY) maxY = y + height;

    cells.push({ text: line, encoded, width, height, x, y });

    cellOffset += 1;
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
  spacing?: TextSpacing | undefined;
}

export interface SinglelineTextLayout {
  bounds: LayoutBounds;
  line: TextPosition;
  fontSize: number;
}

export const layoutSinglelineText = (
  text: string,
  { alignment, fontSize, font, bounds, spacing }: LayoutSinglelineTextOptions,
): SinglelineTextLayout => {
  const line = mergeLines(cleanText(text));

  if (fontSize === undefined || fontSize === 0) {
    fontSize = computeFontSize(
      (size) => [{ width: font.widthOfTextAtSize(line, size, spacing) }],
      (size) => font.heightAtSize(size, { descender: false }),
      bounds,
    );
  }

  const raw = font.encodeText(line);

  const encoded = spacing
    ? raw.withSpacing(spacing.characterSpacing ?? 0, spacing.wordSpacing ?? 0, fontSize)
    : raw;

  const width = font.widthOfTextAtSize(line, fontSize, spacing);
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
