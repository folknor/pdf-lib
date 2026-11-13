import type {
  Font,
  Fontkit,
  Glyph,
  TypeFeatures,
} from '../../types/fontkit.js';
import {
  byAscendingId,
  Cache,
  sortedUniq,
  toHexStringOfMinLength,
} from '../../utils/index.js';
import PDFHexString from '../objects/PDFHexString.js';
import type PDFRef from '../objects/PDFRef.js';
import PDFString from '../objects/PDFString.js';
import type PDFContext from '../PDFContext.js';
import { createCmap } from './CMap.js';
import { deriveFontFlags } from './FontFlags.js';

/**
 * A note of thanks to the developers of https://github.com/foliojs/pdfkit, as
 * this class borrows from:
 *   https://github.com/devongovett/pdfkit/blob/e71edab0dd4657b5a767804ba86c94c58d01fbca/lib/image/jpeg.coffee
 */
class CustomFontEmbedder {
  static async for(
    fontkit: Fontkit,
    fontData: Uint8Array,
    customName?: string,
    fontFeatures?: TypeFeatures,
  ) {
    const font = await fontkit.create(fontData);
    return new CustomFontEmbedder(font, fontData, customName, fontFeatures);
  }

  readonly font: Font;
  readonly scale: number;
  readonly fontData: Uint8Array;
  readonly fontName: string;
  readonly customName: string | undefined;
  readonly fontFeatures: TypeFeatures | undefined;

  protected baseFontName: string;
  protected glyphCache: Cache<Glyph[]>;

  // Track refs to embedded objects to avoid orphans on re-embedding
  protected cidFontDictRef?: PDFRef;
  protected fontDescriptorRef?: PDFRef;
  protected fontStreamRef?: PDFRef;
  protected unicodeCmapRef?: PDFRef;

  protected constructor(
    font: Font,
    fontData: Uint8Array,
    customName?: string,
    fontFeatures?: TypeFeatures,
  ) {
    this.font = font;
    this.scale = 1000 / this.font.unitsPerEm;
    this.fontData = fontData;
    this.fontName = this.font.postscriptName || 'Font';
    this.customName = customName;
    this.fontFeatures = fontFeatures;

    this.baseFontName = '';
    this.glyphCache = Cache.populatedBy(this.allGlyphsInFontSortedById);
  }

  /**
   * Encode the JavaScript string into this font. (JavaScript encodes strings in
   * Unicode, but embedded fonts use their own custom encodings)
   */
  encodeText(text: string): PDFHexString {
    const { glyphs } = this.font.layout(text, this.fontFeatures);
    const hexCodes = new Array(glyphs.length);
    for (let idx = 0, len = glyphs.length; idx < len; idx++) {
      hexCodes[idx] = toHexStringOfMinLength(glyphs[idx]!.id, 4);
    }
    return PDFHexString.of(hexCodes.join(''));
  }

  // Use glyphsForString instead of font.layout for width measurement.
  // font.layout() applies full OpenType shaping which is much slower
  // and unnecessary when only raw advance widths are needed. This does
  // not apply ligatures, but the width difference is negligible and
  // the performance gain is significant (~50x faster).
  widthOfTextAtSize(text: string, size: number): number {
    const glyphs = this.font.glyphsForString(text);
    let totalWidth = 0;
    for (let idx = 0, len = glyphs.length; idx < len; idx++) {
      totalWidth += glyphs[idx]!.advanceWidth;
    }
    return (totalWidth * size) / this.font.unitsPerEm;
  }

  heightOfFontAtSize(
    size: number,
    options: { descender?: boolean } = {},
  ): number {
    const { descender = true } = options;

    const { ascent, descent, bbox } = this.font;
    const yTop = (ascent || bbox.maxY) * this.scale;
    const yBottom = (descent || bbox.minY) * this.scale;

    let height = yTop - yBottom;
    if (!descender) height -= Math.abs(descent) || 0;

    return (height / 1000) * size;
  }

  sizeOfFontAtHeight(height: number): number {
    const { ascent, descent, bbox } = this.font;
    const yTop = (ascent || bbox.maxY) * this.scale;
    const yBottom = (descent || bbox.minY) * this.scale;
    return (1000 * height) / (yTop - yBottom);
  }

  embedIntoContext(context: PDFContext, ref?: PDFRef): Promise<PDFRef> {
    this.baseFontName =
      this.customName || context.addRandomSuffix(this.fontName);
    return this.embedFontDict(context, ref);
  }

  protected async embedFontDict(
    context: PDFContext,
    ref?: PDFRef,
  ): Promise<PDFRef> {
    const cidFontDictRef = await this.embedCIDFontDict(context);
    const unicodeCMapRef = this.embedUnicodeCmap(context);

    const fontDict = context.obj({
      Type: 'Font',
      Subtype: 'Type0',
      BaseFont: this.baseFontName,
      Encoding: 'Identity-H',
      DescendantFonts: [cidFontDictRef],
      ToUnicode: unicodeCMapRef,
    });

    if (ref) {
      context.assign(ref, fontDict);
      return ref;
    } else {
      return context.register(fontDict);
    }
  }

  protected isCFF(): boolean {
    return this.font.cff;
  }

  protected async embedCIDFontDict(context: PDFContext): Promise<PDFRef> {
    const fontDescriptorRef = await this.embedFontDescriptor(context);

    const cidFontDict = context.obj({
      Type: 'Font',
      Subtype: this.isCFF() ? 'CIDFontType0' : 'CIDFontType2',
      CIDToGIDMap: 'Identity',
      BaseFont: this.baseFontName,
      CIDSystemInfo: {
        Registry: PDFString.of('Adobe'),
        Ordering: PDFString.of('Identity'),
        Supplement: 0,
      },
      FontDescriptor: fontDescriptorRef,
      W: this.computeWidths(),
    });

    // Reuse existing ref to avoid orphans on re-embedding
    if (this.cidFontDictRef) {
      context.assign(this.cidFontDictRef, cidFontDict);
    } else {
      this.cidFontDictRef = context.register(cidFontDict);
    }
    return this.cidFontDictRef;
  }

  protected async embedFontDescriptor(context: PDFContext): Promise<PDFRef> {
    const fontStreamRef = await this.embedFontStream(context);

    const { scale } = this;
    const { italicAngle, ascent, descent, capHeight, xHeight } = this.font;
    const { minX, minY, maxX, maxY } = this.font.bbox;

    const fontDescriptor = context.obj({
      Type: 'FontDescriptor',
      FontName: this.baseFontName,
      Flags: deriveFontFlags(this.font),
      FontBBox: [minX * scale, minY * scale, maxX * scale, maxY * scale],
      ItalicAngle: italicAngle,
      Ascent: ascent * scale,
      Descent: descent * scale,
      CapHeight: (capHeight || ascent) * scale,
      XHeight: (xHeight || 0) * scale,

      // Not sure how to compute/find this, nor is anybody else really:
      // https://stackoverflow.com/questions/35485179/stemv-value-of-the-truetype-font
      StemV: 0,

      [this.isCFF() ? 'FontFile3' : 'FontFile2']: fontStreamRef,
    });

    // Reuse existing ref to avoid orphans on re-embedding
    if (this.fontDescriptorRef) {
      context.assign(this.fontDescriptorRef, fontDescriptor);
    } else {
      this.fontDescriptorRef = context.register(fontDescriptor);
    }
    return this.fontDescriptorRef;
  }

  protected async serializeFont(): Promise<Uint8Array> {
    return this.fontData;
  }

  protected async embedFontStream(context: PDFContext): Promise<PDFRef> {
    const fontStream = context.flateStream(await this.serializeFont(), {
      Subtype: this.isCFF() ? 'CIDFontType0C' : undefined,
    });

    // Reuse existing ref to avoid orphans on re-embedding
    if (this.fontStreamRef) {
      context.assign(this.fontStreamRef, fontStream);
    } else {
      this.fontStreamRef = context.register(fontStream);
    }
    return this.fontStreamRef;
  }

  protected embedUnicodeCmap(context: PDFContext): PDFRef {
    // A bfchar entry with an empty destination (`<0003> <>`) is malformed.
    const glyphs = this.glyphCache
      .access()
      .filter((glyph) => glyph.codePoints.length > 0);
    const cmap = createCmap(glyphs, this.glyphId.bind(this));
    const cmapStream = context.flateStream(cmap);

    // Reuse existing ref to avoid orphans on re-embedding
    if (this.unicodeCmapRef) {
      context.assign(this.unicodeCmapRef, cmapStream);
    } else {
      this.unicodeCmapRef = context.register(cmapStream);
    }
    return this.unicodeCmapRef;
  }

  protected glyphId(glyph?: Glyph): number {
    return glyph ? glyph.id : -1;
  }

  /**
   * The glyphs whose widths go into /W. For a full (non-subset) embed this is
   * every glyph in the font, so glyphs reachable only through shaping
   * (ligatures, alternates) still get their real width instead of /DW.
   */
  protected glyphsForWidths(): Glyph[] {
    // fontkit caches glyph objects by id, and the first creation fixes their
    // codePoints. getGlyph(id) without code points would leave mapped glyphs
    // with empty codePoints and drop them from ToUnicode, so create the
    // characterSet glyphs (with their code points) first.
    this.glyphCache.access();
    const glyphs: Glyph[] = [];
    for (let id = 0, len = this.font.numGlyphs; id < len; id++) {
      const glyph = this.font.getGlyph(id);
      if (glyph) glyphs.push(glyph);
    }
    return glyphs;
  }

  protected computeWidths(): (number | number[])[] {
    return compressWidths(
      this.glyphsForWidths().map((glyph) => [
        this.glyphId(glyph),
        glyph.advanceWidth * this.scale,
      ]),
    );
  }

  private allGlyphsInFontSortedById = (): Glyph[] => {
    const glyphs: Glyph[] = new Array(this.font.characterSet.length);
    for (let idx = 0, len = glyphs.length; idx < len; idx++) {
      const codePoint = this.font.characterSet[idx]!;
      glyphs[idx] = this.font.glyphForCodePoint(codePoint);
    }
    return sortedUniq(glyphs.sort(byAscendingId), (g) => g.id);
  };
}

/** Runs of at least this many equal widths are written as `first last w`. */
const MIN_WIDTH_RANGE = 4;

/**
 * Build a CIDFont /W array from `[cid, width]` pairs (sorted by ascending,
 * unique cid). Consecutive cids go into `c [w1 w2 ...]` sections, and runs of
 * identical widths use the `cFirst cLast w` form (PDF 32000-1:2008 9.7.4.3),
 * which keeps /W small for large fonts with many same-width glyphs (CJK).
 */
export const compressWidths = (
  entries: [number, number][],
): (number | number[])[] => {
  const widths: (number | number[])[] = [];
  let section: number[] | undefined;
  let prevId = Number.NaN;

  let idx = 0;
  while (idx < entries.length) {
    const [id, width] = entries[idx]!;

    let end = idx;
    while (
      end + 1 < entries.length &&
      entries[end + 1]![0] === entries[end]![0] + 1 &&
      entries[end + 1]![1] === width
    ) {
      end++;
    }

    if (end - idx + 1 >= MIN_WIDTH_RANGE) {
      widths.push(id, entries[end]![0], width);
      section = undefined;
      prevId = entries[end]![0];
      idx = end + 1;
      continue;
    }

    if (section === undefined || id !== prevId + 1) {
      section = [];
      widths.push(id, section);
    }
    section.push(width);
    prevId = id;
    idx++;
  }

  return widths;
};

export default CustomFontEmbedder;
