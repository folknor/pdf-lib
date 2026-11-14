import type {
  Font,
  Fontkit,
  Glyph,
  Subset,
  TypeFeatures,
} from '../../types/fontkit.js';
import type { ToUnicodeEntry } from './CMap.js';
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
    this.glyphIdMap = new Map();
  }

  // A subset holds only encoded glyphs, so ToUnicode is what encoding
  // recorded (subset id 0, .notdef, is never mapped).
  protected override toUnicodeEntries(): ToUnicodeEntry[] {
    return this.recordedEntries();
  }

  // Only encoding adds a glyph to the subset; measuring (positionedLayout)
  // does not, so rejected line-break candidates never enter it.
  protected override codeForGlyph(glyph: Glyph): number {
    const subsetGlyphId = this.subset.includeGlyph(glyph);
    // Indexed by subset id, 0 included: the subset always holds .notdef at
    // id 0, and a code shown for it needs its /W entry like any other (with
    // none and no /DW the PDF advances it by 1000).
    this.glyphs[subsetGlyphId] = glyph;
    this.glyphIdMap.set(glyph.id, subsetGlyphId);

    return subsetGlyphId;
  }

  protected override isCFF(): boolean {
    return !!(this.subset as any).cff;
  }

  protected override glyphId(glyph?: Glyph): number {
    return glyph ? this.glyphIdMap.get(glyph.id)! : -1;
  }

  // A subset only carries the glyphs actually used, all of which encodeText recorded.
  protected override glyphsForWidths(): Glyph[] {
    return this.glyphs.filter((glyph) => glyph !== undefined);
  }

  protected override serializeFont(): Promise<Uint8Array> {
    return encodeSubset(this.subset);
  }
}

export default CustomFontSubsetEmbedder;
