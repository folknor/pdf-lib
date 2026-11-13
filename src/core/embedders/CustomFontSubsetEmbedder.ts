import type {
  Font,
  Fontkit,
  Glyph,
  Subset,
  TypeFeatures,
} from '../../types/fontkit.js';
import { Cache, toHexStringOfMinLength } from '../../utils/index.js';
import PDFHexString from '../objects/PDFHexString.js';
import CustomFontEmbedder, {
  asFont,
  encodeSubset,
} from './CustomFontEmbedder.js';

/**
 * A note of thanks to the developers of https://github.com/foliojs/pdfkit, as
 * this class borrows from:
 *   https://github.com/devongovett/pdfkit/blob/e71edab0dd4657b5a767804ba86c94c58d01fbca/lib/image/jpeg.coffee
 */
class CustomFontSubsetEmbedder extends CustomFontEmbedder {
  static override async for(
    fontkit: Fontkit,
    fontData: Uint8Array,
    customFontName?: string,
    fontFeatures?: TypeFeatures,
    postscriptName?: string,
    maxDecodedSize?: number,
  ) {
    const font = asFont(
      await fontkit.create(fontData, postscriptName, { maxDecodedSize }),
    );
    return new CustomFontSubsetEmbedder(
      font,
      fontData,
      customFontName,
      fontFeatures,
    );
  }

  private readonly subset: Subset;
  private readonly glyphs: Glyph[];
  private readonly glyphIdMap: Map<number, number>;

  private constructor(
    font: Font,
    fontData: Uint8Array,
    customFontName?: string,
    fontFeatures?: TypeFeatures,
  ) {
    super(font, fontData, customFontName, fontFeatures);

    this.subset = this.font.createSubset();
    this.glyphs = [];
    this.glyphCache = Cache.populatedBy(() => this.glyphs);
    this.glyphIdMap = new Map();
  }

  override encodeText(text: string): PDFHexString {
    const { glyphs } = this.font.layout(text, this.fontFeatures);
    const hexCodes = new Array(glyphs.length);

    for (let idx = 0, len = glyphs.length; idx < len; idx++) {
      const glyph = glyphs[idx]!;
      const subsetGlyphId = this.subset.includeGlyph(glyph);

      this.glyphs[subsetGlyphId - 1] = glyph;
      this.glyphIdMap.set(glyph.id, subsetGlyphId);

      hexCodes[idx] = toHexStringOfMinLength(subsetGlyphId, 4);
    }

    this.glyphCache.invalidate();
    return PDFHexString.of(hexCodes.join(''));
  }

  protected override isCFF(): boolean {
    return !!(this.subset as any).cff;
  }

  protected override glyphId(glyph?: Glyph): number {
    return glyph ? this.glyphIdMap.get(glyph.id)! : -1;
  }

  // A subset only carries the glyphs actually used, all of which are cached.
  protected override glyphsForWidths(): Glyph[] {
    return this.glyphCache.access();
  }

  protected override serializeFont(): Promise<Uint8Array> {
    return encodeSubset(this.subset);
  }
}

export default CustomFontSubsetEmbedder;
