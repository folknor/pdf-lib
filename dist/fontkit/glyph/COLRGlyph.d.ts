import BBox from './BBox.js';
import Glyph from './Glyph.js';
interface COLRColor {
    red: number;
    green: number;
    blue: number;
    alpha: number;
}
declare class COLRLayer {
    glyph: Glyph | null;
    color: COLRColor;
    constructor(glyph: Glyph | null, color: COLRColor);
}
/**
 * Represents a color (e.g. emoji) glyph in Microsoft's COLR format.
 * Each glyph in this format contain a list of colored layers, each
 * of which  is another vector glyph.
 */
export default class COLRGlyph extends Glyph {
    type: string;
    _getBBox(): BBox;
    /**
     * Returns an array of objects containing the glyph and color for
     * each layer in the composite color glyph, or null for COLR v1 fonts,
     * whose paint graphs have no v0 base glyph records.
     */
    get layers(): COLRLayer[] | null;
    render(ctx: any, size: number): void;
}
export {};
//# sourceMappingURL=COLRGlyph.d.ts.map