/**
 * Represents a glyph bounding box
 */
export default class BBox {
    /**
     * The minimum X position in the bounding box
     */
    minX: number;
    /**
     * The minimum Y position in the bounding box
     */
    minY: number;
    /**
     * The maxmimum X position in the bounding box
     */
    maxX: number;
    /**
     * The maxmimum Y position in the bounding box
     */
    maxY: number;
    constructor(minX?: number, minY?: number, maxX?: number, maxY?: number);
    /**
     * The width of the bounding box
     * @type {number}
     */
    get width(): number;
    /**
     * The height of the bounding box
     * @type {number}
     */
    get height(): number;
    addPoint(x: number, y: number): void;
    copy(): BBox;
}
//# sourceMappingURL=BBox.d.ts.map