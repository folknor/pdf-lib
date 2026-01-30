// @ts-nocheck
import type BBox from './BBox.js';
import TTFGlyph, { type DecodedGlyph } from './TTFGlyph.js';

/**
 * Represents a TrueType glyph in the WOFF2 format, which compresses glyphs differently.
 */
export default class WOFF2Glyph extends TTFGlyph {
  type = 'WOFF2';

  override _decode(): DecodedGlyph | null {
    // We have to decode in advance (in WOFF2Font), so just return the pre-decoded data.
    return this._font._transformedGlyphs[this.id];
  }

  override _getCBox(): BBox {
    return this.path.bbox;
  }
}
