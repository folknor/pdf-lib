import type { DecodeStream } from '../../vendors/restructure/index.js';
import BBox from './BBox.js';
import Glyph, { type GlyphMetrics } from './Glyph.js';
import Path from './Path.js';
export interface DecodedGlyph {
    numberOfContours: number;
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
    points?: Point[];
    instructions?: number[];
    components?: Component[];
    phantomPoints?: Point[];
}
export declare class Point {
    onCurve: boolean;
    endContour: boolean;
    x: number;
    y: number;
    constructor(onCurve: boolean, endContour: boolean, x?: number, y?: number);
    copy(): Point;
}
declare class Component {
    glyphID: number;
    dx: number;
    dy: number;
    pos: number;
    scaleX: number;
    scaleY: number;
    scale01: number;
    scale10: number;
    constructor(glyphID: number, dx: number, dy: number);
}
/**
 * Represents a TrueType glyph.
 */
export default class TTFGlyph extends Glyph {
    type: string;
    _getCBox(internal?: boolean): BBox;
    _parseGlyphCoord(stream: DecodeStream, prev: number, short: number, same: number): number;
    _decode(): DecodedGlyph | null;
    _decodeSimple(glyph: DecodedGlyph, stream: DecodeStream): void;
    _decodeComposite(glyph: DecodedGlyph, stream: DecodeStream, offset?: number): boolean;
    _getPhantomPoints(glyph: DecodedGlyph): Point[];
    _getContours(): Point[][];
    _getMetrics(): GlyphMetrics;
    _getPath(): Path;
}
export {};
//# sourceMappingURL=TTFGlyph.d.ts.map