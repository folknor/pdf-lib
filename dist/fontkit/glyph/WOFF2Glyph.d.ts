import type BBox from './BBox.js';
import TTFGlyph, { type DecodedGlyph } from './TTFGlyph.js';
/**
 * Represents a TrueType glyph in the WOFF2 format, which compresses glyphs differently.
 */
export default class WOFF2Glyph extends TTFGlyph {
    type: string;
    _decode(): DecodedGlyph | null;
    _getCBox(): BBox;
}
//# sourceMappingURL=WOFF2Glyph.d.ts.map