import { toCodePoint, toHexString } from '../../utils/index.js';
import {
  Encodings,
  type EncodingType,
  Font,
  FontNames,
} from '../../vendors/standard-fonts/index.js';
import type PDFRef from '../objects/PDFRef.js';
import type PDFContext from '../PDFContext.js';
import EncodedText, {
  type GlyphSpacing,
  type TextSpacing,
} from './EncodedText.js';

export interface Glyph {
  code: number;
  name: string;
}

/**
 * A note of thanks to the developers of https://github.com/foliojs/pdfkit, as
 * this class borrows from:
 *   https://github.com/foliojs/pdfkit/blob/f91bdd61c164a72ea06be1a43dc0a412afc3925f/lib/font/afm.coffee
 */
class StandardFontEmbedder {
  static for = (fontName: FontNames, customName?: string) =>
    new StandardFontEmbedder(fontName, customName);

  readonly font: Font;
  readonly encoding: EncodingType;
  readonly fontName: string;
  readonly customName: string | undefined;

  private constructor(fontName: FontNames, customName?: string) {
    // prettier-ignore
    this.encoding =
      fontName === FontNames.ZapfDingbats
        ? Encodings.ZapfDingbats
        : fontName === FontNames.Symbol
          ? Encodings.Symbol
          : Encodings.WinAnsi;
    this.font = Font.load(fontName);
    this.fontName = this.font.FontName;
    this.customName = customName;
  }

  /**
   * Encodes the JavaScript string into this font's WinAnsi, ZapfDingbats or
   * Symbol encoding, with the AFM pair kerning applied to each glyph's
   * advance, which is what widthOfTextAtSize measures: a Type1 font shown
   * with `Tj` does not kern by itself, so the kerning is written as `TJ`
   * adjustments. Each U+0020 takes word spacing (not U+00A0, though WinAnsi
   * draws it with the same glyph).
   */
  encodeText(text: string): EncodedText {
    const glyphs = this.encodeTextAsGlyphs(text);
    const characters = Array.from(text);
    const count = glyphs.length;
    const codes = new Array<string>(count);
    const advances = new Array<number>(count);
    const widths = new Array<number>(count);
    const zeros = new Array<number>(count).fill(0);
    const spacing = new Array<GlyphSpacing>(count);
    for (let idx = 0; idx < count; idx++) {
      const left = glyphs[idx]!.name;
      const right = glyphs[idx + 1]?.name;
      spacing[idx] = characters[idx] === ' ' ? 'space' : 'base';
      codes[idx] = toHexString(glyphs[idx]!.code);
      widths[idx] = this.widthOfGlyph(left);
      advances[idx] =
        widths[idx]! +
        (right === undefined
          ? 0
          : this.font.getXAxisKerningForPair(left, right) || 0);
    }
    return new EncodedText(
      codes,
      advances,
      widths,
      zeros,
      zeros.slice(),
      spacing,
    );
  }

  // With spacing, it measures what encodeText(text).withSpacing() draws.
  widthOfTextAtSize(
    text: string,
    size: number,
    spacing: TextSpacing = {},
  ): number {
    const { characterSpacing = 0, wordSpacing = 0 } = spacing;
    const encoded = this.encodeText(text);
    return (
      (encoded.withSpacing(characterSpacing, wordSpacing, size).advance *
        size) /
      1000
    );
  }

  heightOfFontAtSize(
    size: number,
    options: { descender?: boolean } = {},
  ): number {
    const { descender = true } = options;

    const { Ascender, Descender, FontBBox } = this.font;
    const yTop = Ascender || FontBBox[3];
    const yBottom = Descender || FontBBox[1];

    let height = yTop - yBottom;
    if (!descender) height += Descender || 0;

    return (height / 1000) * size;
  }

  sizeOfFontAtHeight(height: number): number {
    const { Ascender, Descender, FontBBox } = this.font;
    const yTop = Ascender || FontBBox[3];
    const yBottom = Descender || FontBBox[1];
    return (1000 * height) / (yTop - yBottom);
  }

  embedIntoContext(context: PDFContext, ref?: PDFRef): PDFRef {
    const fontDict = context.obj({
      Type: 'Font',
      Subtype: 'Type1',
      BaseFont: this.customName || this.fontName,

      Encoding:
        this.encoding === Encodings.WinAnsi ? 'WinAnsiEncoding' : undefined,
    });

    if (ref) {
      context.assign(ref, fontDict);
      return ref;
    } else {
      return context.register(fontDict);
    }
  }

  private widthOfGlyph(glyphName: string): number {
    // Default to 250 if font doesn't specify a width
    return this.font.getWidthOfGlyph(glyphName) || 250;
  }

  private encodeTextAsGlyphs(text: string): Glyph[] {
    const codePoints = Array.from(text);
    const glyphs: Glyph[] = new Array(codePoints.length);
    for (let idx = 0, len = codePoints.length; idx < len; idx++) {
      const codePoint = toCodePoint(codePoints[idx]!)!;
      try {
        glyphs[idx] = this.encoding.encodeUnicodeCodePoint(codePoint);
      } catch {
        // Replace non-WinAnsi characters with a placeholder
        glyphs[idx] = this.encoding.encodeUnicodeCodePoint(toCodePoint('?')!);
      }
    }
    return glyphs;
  }
}

export default StandardFontEmbedder;
