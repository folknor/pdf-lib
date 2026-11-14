import PDFHexString from '../objects/PDFHexString.js';

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
 */
export default class EncodedText {
  readonly codes: readonly string[];
  readonly advances: readonly number[];
  readonly widths: readonly number[];
  readonly xOffsets: readonly number[];
  readonly yOffsets: readonly number[];
  /** Sum of `advances`. */
  readonly advance: number;

  constructor(
    codes: string[],
    advances: number[],
    widths: number[],
    xOffsets: number[],
    yOffsets: number[],
  ) {
    const count = codes.length;
    if (
      advances.length !== count ||
      widths.length !== count ||
      xOffsets.length !== count ||
      yOffsets.length !== count
    ) {
      throw new Error('EncodedText: per-glyph arrays differ in length');
    }
    let advance = 0;
    for (let idx = 0; idx < count; idx++) {
      for (const value of [
        advances[idx]!,
        widths[idx]!,
        xOffsets[idx]!,
        yOffsets[idx]!,
      ]) {
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
    this.advance = advance;
  }

  /** The glyph codes alone, as shown by a plain `Tj`. */
  toHexString(): PDFHexString {
    return PDFHexString.of(this.codes.join(''));
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
