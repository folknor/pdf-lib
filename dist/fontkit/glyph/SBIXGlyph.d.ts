import TTFGlyph from './TTFGlyph.js';
interface SBIXImageData {
    originX: number;
    originY: number;
    type: string;
    data: Uint8Array;
}
/**
 * Represents a color (e.g. emoji) glyph in Apple's SBIX format.
 */
export default class SBIXGlyph extends TTFGlyph {
    type: string;
    /**
     * Returns an object representing a glyph image at the given point size.
     * The object has a data property with a Buffer containing the actual image data,
     * along with the image type, and origin.
     */
    getImageForSize(size: number): SBIXImageData | null;
    render(ctx: any, size: number): void;
}
export {};
//# sourceMappingURL=SBIXGlyph.d.ts.map