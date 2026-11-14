import PDFHexString from "../objects/PDFHexString.js";

/**
 * A line of text encoded in a font, with where the font's layout places each
 * glyph. All lengths are in thousandths of an em (PDF glyph space), so the
 * value does not depend on the font size it is shown at.
 *
 * For glyph `i`, `advances[i]` is how far the pen moves after it (kerning,
 * zeroed mark advances and hidden default-ignorables included), `widths[i]`
 * how far the PDF moves the pen on its own when the glyph's code is shown (the
 * font's /W entry, or the standard font's AFM width), and `xOffsets[i]` /
 * `yOffsets[i]` where the glyph is drawn relative to the pen (mark and
 * cursive attachment). Showing the text with `showEncodedText` reproduces
 * exactly these positions, and `advance` (their sum) is the width the font
 * measures the text with, so a line is drawn at the positions it was
 * measured with.
 *
 * `spacing[i]` says how much character and word spacing is added after
 * glyph `i` (see [[withSpacing]]), and `attachedTo[i]` the index of the glyph
 * the layout attached it to (mark positioning), whose placement its offsets
 * follow. `actualText` lists the glyph ranges whose extracted text (through
 * the font's ToUnicode) would not be the text they were encoded from, with
 * that text; they are shown as /Span marked content with /ActualText.
 */
export default class EncodedText {
  readonly codes: readonly string[];
  readonly advances: readonly number[];
  readonly widths: readonly number[];
  readonly xOffsets: readonly number[];
  readonly yOffsets: readonly number[];
  readonly spacing: readonly GlyphSpacing[];
  readonly attachedTo: readonly (number | null)[];
  readonly actualText: readonly ActualTextSpan[];
  /** Sum of `advances`. */
  readonly advance: number;

  constructor(
    codes: string[],
    advances: number[],
    widths: number[],
    xOffsets: number[],
    yOffsets: number[],
    spacing: GlyphSpacing[] = codes.map(() => BASE_SPACING),
    attachedTo: (number | null)[] = new Array<number | null>(codes.length).fill(null),
    actualText: ActualTextSpan[] = [],
  ) {
    const count = codes.length;

    if (
      advances.length !== count ||
      widths.length !== count ||
      xOffsets.length !== count ||
      yOffsets.length !== count ||
      spacing.length !== count ||
      attachedTo.length !== count
    ) {
      throw new Error("EncodedText: per-glyph arrays differ in length");
    }

    attachmentRoots(attachedTo);
    let previousEnd = 0;

    for (const span of actualText) {
      if (
        !Number.isInteger(span.start) ||
        !Number.isInteger(span.end) ||
        span.start < previousEnd ||
        span.end <= span.start ||
        span.end > count
      ) {
        throw new Error("EncodedText: actual text spans overlap or are out of range");
      }

      previousEnd = span.end;
    }

    for (const kind of spacing) {
      if (
        !Number.isInteger(kind.characters) ||
        !Number.isInteger(kind.spaces) ||
        kind.characters < 0 ||
        kind.spaces < 0
      ) {
        throw new Error("EncodedText: spacing counts must be whole and not negative");
      }
    }

    let advance = 0;

    for (let idx = 0; idx < count; idx++) {
      for (const value of [advances[idx]!, widths[idx]!, xOffsets[idx]!, yOffsets[idx]!]) {
        if (!Number.isFinite(value)) {
          throw new Error(`EncodedText: glyph ${idx} has a non-finite metric`);
        }
      }

      advance += advances[idx]!;
    }

    this.codes = codes;
    this.advances = advances;
    this.widths = widths;
    this.xOffsets = xOffsets;
    this.yOffsets = yOffsets;
    this.spacing = spacing;
    this.attachedTo = attachedTo;
    this.actualText = actualText;
    this.advance = advance;
  }

  /**
   * This text drawn with extra spacing, in PDF points at `fontSize`: glyph
   * `i` advances `spacing[i].characters` times `characterSpacing` plus
   * `spacing[i].spaces` times `wordSpacing` further. A glyph attached to another keeps
   * its place relative to the glyph its attachment chain ends at, whatever
   * spacing lies between them.
   *
   * This is the drawing counterpart of the PDF's `Tc` and `Tw`, which cannot
   * be used for it: `Tc` moves an attached mark off its anchor and `Tw` acts
   * only on the single-byte code 32, so not at all in a two-byte encoding.
   * A custom font with source clusters puts a cluster's whole spacing after
   * its last glyph (one character spacing per character it holds, one word
   * spacing per U+0020), so nothing inside a cluster - a base and its marks,
   * a ligature - moves apart, and the total does not depend on how the font
   * shaped the text.
   */
  withSpacing(characterSpacing: number, wordSpacing: number, fontSize: number): EncodedText {
    if (characterSpacing === 0 && wordSpacing === 0) return this;

    const extras = spacingExtras(this.spacing, characterSpacing, wordSpacing, fontSize);

    const count = this.codes.length;
    // Pen shift before each glyph, from the spacing alone.
    const shifts = new Array<number>(count);
    let shift = 0;

    for (let idx = 0; idx < count; idx++) {
      shifts[idx] = shift;
      shift += extras[idx]!;
    }

    const roots = attachmentRoots(this.attachedTo);
    const advances = this.advances.map((value, idx) => value + extras[idx]!);

    const xOffsets = this.xOffsets.map((value, idx) => value + shifts[roots[idx]!]! - shifts[idx]!);

    return new EncodedText(
      [...this.codes],
      advances,
      [...this.widths],
      xOffsets,
      [...this.yOffsets],
      [...this.spacing],
      [...this.attachedTo],
      [...this.actualText],
    );
  }

  /** The glyph codes alone, as shown by a plain `Tj`. */
  toHexString(): PDFHexString {
    return PDFHexString.of(this.codes.join(""));
  }

  /** True when some glyph is drawn at a different height than the pen. */
  hasVerticalOffsets(): boolean {
    return this.yOffsets.some((y) => y !== 0);
  }

  /** True when showing the codes with `Tj` alone draws every glyph in place. */
  isUnpositioned(): boolean {
    for (let idx = 0, len = this.codes.length; idx < len; idx++) {
      if (
        this.advances[idx] !== this.widths[idx] ||
        this.xOffsets[idx] !== 0 ||
        this.yOffsets[idx] !== 0
      ) {
        return false;
      }
    }

    return true;
  }
}

/**
 * What spacing is added after a glyph: `characters` times the character
 * spacing and `spaces` times the word spacing.
 */
export interface GlyphSpacing {
  readonly characters: number;
  readonly spaces: number;
}

/** One character. */
export const BASE_SPACING: GlyphSpacing = Object.freeze({
  characters: 1,
  spaces: 0,
});

/** One U+0020. */
export const SPACE_SPACING: GlyphSpacing = Object.freeze({
  characters: 1,
  spaces: 1,
});

/** Nothing (a mark, a hidden default-ignorable, inside a cluster). */
export const NO_SPACING: GlyphSpacing = Object.freeze({
  characters: 0,
  spaces: 0,
});

/**
 * Glyphs `start` to `end - 1` stand for `text`, which their ToUnicode
 * mappings do not spell.
 */
export interface ActualTextSpan {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** Extra spacing applied to text, in PDF points. */
export interface TextSpacing {
  characterSpacing?: number;
  wordSpacing?: number;
}

/** Each glyph's extra advance, in thousandths of an em, for the spacing. */
export const spacingExtras = (
  spacing: readonly GlyphSpacing[],
  characterSpacing: number,
  wordSpacing: number,
  fontSize: number,
): number[] => {
  if (
    !Number.isFinite(characterSpacing) ||
    !Number.isFinite(wordSpacing) ||
    !Number.isFinite(fontSize)
  ) {
    throw new Error("Text spacing and font size must be finite");
  }

  if (fontSize === 0 && (characterSpacing !== 0 || wordSpacing !== 0)) {
    throw new Error("Text spacing cannot be applied at font size 0");
  }

  const perEm = 1000 / (fontSize || 1);

  return spacing.map(
    (kind) => (kind.characters * characterSpacing + kind.spaces * wordSpacing) * perEm,
  );
};

// The glyph each glyph's attachment chain ends at (itself when unattached).
// Throws on an index out of range or a cycle.
const attachmentRoots = (attachedTo: readonly (number | null)[]): number[] => {
  const count = attachedTo.length;
  const roots = new Array<number>(count).fill(-1);

  for (let idx = 0; idx < count; idx++) {
    const chain: number[] = [];
    let at = idx;

    while (roots[at] === -1) {
      if (chain.includes(at)) {
        throw new Error(`EncodedText: glyph ${idx} is attached in a cycle`);
      }

      chain.push(at);
      const next = attachedTo[at];

      if (next === null || next === undefined) {
        roots[at] = at;
        break;
      }

      if (!Number.isInteger(next) || next < 0 || next >= count) {
        throw new Error(`EncodedText: glyph ${at} is attached out of range`);
      }

      at = next;
    }

    const root = roots[at]!;

    for (const member of chain) roots[member] = root;
  }

  return roots;
};
