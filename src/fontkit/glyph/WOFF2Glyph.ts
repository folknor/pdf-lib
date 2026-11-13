import BBox from './BBox.js';
import TTFGlyph, { type DecodedGlyph } from './TTFGlyph.js';

/**
 * Represents a TrueType glyph in the WOFF2 format, which compresses glyphs differently.
 */
export default class WOFF2Glyph extends TTFGlyph {
  override type = 'WOFF2';

  override _decode(): DecodedGlyph {
    // Glyphs are decoded in advance (WOFF2Font._transformGlyfTable) and shared
    // by every instance of the font, so vary a copy, never the cached one.
    const decoded: DecodedGlyph = this._font._transformedGlyphs[this.id];
    if (!this._font._variationProcessor) {
      return decoded;
    }

    const glyph: DecodedGlyph = { ...decoded };
    if (decoded.points) {
      glyph.points = decoded.points.map((point) => point.copy());
    }
    if (decoded.components) {
      glyph.components = decoded.components.map((component) =>
        Object.assign(
          Object.create(Object.getPrototypeOf(component)),
          component,
        ),
      );
    }
    this._applyVariation(glyph);
    return glyph;
  }

  // The transformed glyf table's bbox stands in for the glyph header it does
  // not have.
  override _getGlyfBox(): BBox {
    const { xMin, yMin, xMax, yMax } = this._font._transformedGlyphs[this.id];
    return Object.freeze(new BBox(xMin, yMin, xMax, yMax));
  }
}
