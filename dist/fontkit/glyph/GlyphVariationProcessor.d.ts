import type { Point } from './TTFGlyph.js';
/**
 * This class is transforms TrueType glyphs according to the data from
 * the Apple Advanced Typography variation tables (fvar, gvar, and avar).
 * These tables allow infinite adjustments to glyph weight, width, slant,
 * and optical size without the designer needing to specify every exact style.
 *
 * Apple's documentation for these tables is not great, so thanks to the
 * Freetype project for figuring much of this out.
 *
 * @private
 */
export default class GlyphVariationProcessor {
    font: any;
    normalizedCoords: number[];
    blendVectors: Map<any, number[]>;
    constructor(font: any, coords: number[]);
    normalizeCoords(coords: number[]): number[];
    transformPoints(gid: number, glyphPoints: Point[]): void;
    decodePoints(): Uint16Array;
    decodeDeltas(count: number): Int16Array;
    tupleFactor(tupleIndex: number, tupleCoords: number[], startCoords: number[] | undefined, endCoords: number[] | undefined): number;
    interpolateMissingDeltas(points: Point[], inPoints: Point[], hasDelta: boolean[]): void;
    deltaInterpolate(p1: number, p2: number, ref1: number, ref2: number, inPoints: Point[], outPoints: Point[]): void;
    deltaShift(p1: number, p2: number, ref: number, inPoints: Point[], outPoints: Point[]): void;
    getAdvanceAdjustment(gid: number, table: any): number;
    getDelta(itemStore: any, outerIndex: number, innerIndex: number): number;
    getBlendVector(itemStore: any, outerIndex: number): number[];
}
//# sourceMappingURL=GlyphVariationProcessor.d.ts.map