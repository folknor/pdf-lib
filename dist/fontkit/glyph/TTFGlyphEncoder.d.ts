import type PathType from './Path.js';
/**
 * Encodes TrueType glyph outlines
 */
export default class TTFGlyphEncoder {
    encodeSimple(path: PathType, instructions?: number[]): Uint8Array;
    _encodePoint(value: number, last: number, points: number[], flag: number, shortFlag: number, sameFlag: number): number;
}
//# sourceMappingURL=TTFGlyphEncoder.d.ts.map