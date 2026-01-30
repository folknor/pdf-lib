import type BBox from './BBox.js';
import Path from './Path.js';
export interface GlyphMetrics {
    advanceWidth: number;
    advanceHeight: number;
    leftBearing: number;
    topBearing: number;
}
interface TableMetric {
    advance: number;
    bearing: number;
}
/**
 * Glyph objects represent a glyph in the font. They have various properties for accessing metrics and
 * the actual vector path the glyph represents, and methods for rendering the glyph to a graphics context.
 *
 * You do not create glyph objects directly. They are created by various methods on the font object.
 * There are several subclasses of the base Glyph class internally that may be returned depending
 * on the font format, but they all inherit from this class.
 */
export default class Glyph {
    /**
     * The glyph id in the font
     */
    id: number;
    /**
     * An array of unicode code points that are represented by this glyph.
     * There can be multiple code points in the case of ligatures and other glyphs
     * that represent multiple visual characters.
     */
    codePoints: number[];
    _font: any;
    isMark: boolean;
    isLigature: boolean;
    _metrics?: GlyphMetrics;
    constructor(id: number, codePoints: number[], font: any);
    _getPath(): Path;
    _getCBox(): BBox;
    _getBBox(): BBox;
    _getTableMetrics(table: any): TableMetric;
    _getMetrics(cbox?: BBox | null): GlyphMetrics;
    /**
     * The glyph's control box.
     * This is often the same as the bounding box, but is faster to compute.
     * Because of the way bezier curves are defined, some of the control points
     * can be outside of the bounding box. Where `bbox` takes this into account,
     * `cbox` does not. Thus, cbox is less accurate, but faster to compute.
     * See [here](http://www.freetype.org/freetype2/docs/glyphs/glyphs-6.html#section-2)
     * for a more detailed description.
     */
    get cbox(): BBox;
    /**
     * The glyph's bounding box, i.e. the rectangle that encloses the
     * glyph outline as tightly as possible.
     */
    get bbox(): BBox;
    /**
     * A vector Path object representing the glyph outline.
     */
    get path(): Path;
    /**
     * Returns a path scaled to the given font size.
     */
    getScaledPath(size: number): Path;
    /**
     * The glyph's advance width.
     */
    get advanceWidth(): number;
    /**
     * The glyph's advance height.
     */
    get advanceHeight(): number;
    get ligatureCaretPositions(): number[] | undefined;
    _getName(): string | null | undefined;
    /**
     * The glyph's name
     */
    get name(): string | null | undefined;
    /**
     * Renders the glyph to the given graphics context, at the specified font size.
     */
    render(ctx: CanvasRenderingContext2D, size: number): void;
}
export {};
//# sourceMappingURL=Glyph.d.ts.map