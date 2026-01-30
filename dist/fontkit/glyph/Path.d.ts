import BBox from './BBox.js';
export type PathCommandName = 'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'bezierCurveTo' | 'closePath';
export interface PathCommand {
    command: PathCommandName;
    args: number[];
}
/**
 * Path objects are returned by glyphs and represent the actual
 * vector outlines for each glyph in the font. Paths can be converted
 * to SVG path data strings, or to functions that can be applied to
 * render the path to a graphics context.
 */
export default class Path {
    commands: PathCommand[];
    _bbox: BBox | null;
    _cbox: BBox | null;
    moveTo: (...args: number[]) => this;
    lineTo: (...args: number[]) => this;
    quadraticCurveTo: (...args: number[]) => this;
    bezierCurveTo: (...args: number[]) => this;
    closePath: (...args: number[]) => this;
    constructor();
    /**
     * Compiles the path to a JavaScript function that can be applied with
     * a graphics context in order to render the path.
     */
    toFunction(): (ctx: CanvasRenderingContext2D) => void;
    /**
     * Converts the path to an SVG path data string
     */
    toSVG(): string;
    /**
     * Gets the "control box" of a path.
     * This is like the bounding box, but it includes all points including
     * control points of bezier segments and is much faster to compute than
     * the real bounding box.
     */
    get cbox(): BBox;
    /**
     * Gets the exact bounding box of the path by evaluating curve segments.
     * Slower to compute than the control box, but more accurate.
     */
    get bbox(): BBox;
    /**
     * Applies a mapping function to each point in the path.
     */
    mapPoints(fn: (x: number, y: number) => [number, number]): Path;
    /**
     * Transforms the path by the given matrix.
     */
    transform(m0: number, m1: number, m2: number, m3: number, m4: number, m5: number): Path;
    /**
     * Translates the path by the given offset.
     */
    translate(x: number, y: number): Path;
    /**
     * Rotates the path by the given angle (in radians).
     */
    rotate(angle: number): Path;
    /**
     * Scales the path.
     */
    scale(scaleX: number, scaleY?: number): Path;
}
//# sourceMappingURL=Path.d.ts.map