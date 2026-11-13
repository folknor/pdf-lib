import TTFGlyphEncoder from '../glyph/TTFGlyphEncoder.js';
import Subset from './Subset.js';
interface LocaTable {
    offsets: number[];
    version: number;
}
interface HmtxTable {
    metrics: {
        advance: number;
        bearing: number;
    }[];
    bearings: number[];
}
export default class TTFSubset extends Subset {
    glyphEncoder: TTFGlyphEncoder;
    glyf: Uint8Array[];
    offset: number;
    loca: LocaTable;
    hmtx: HmtxTable;
    constructor(font: any);
    get _glyfTransformed(): boolean;
    _addGlyph(gid: number): number;
    /**
     * Re-encoded (flattened) glyphs can have more points and contours than the
     * source's simple glyphs, and contain no composites, so recompute those
     * limits from the encoded glyf data. The instruction-related limits stay:
     * they remain valid upper bounds for the kept fpgm/prep programs, and the
     * glyphs themselves carry no instructions.
     */
    _updateMaxpForFlattenedGlyphs(maxp: any): void;
    _pushGlyph(glyph: any, buffer: Uint8Array): void;
    encode(): Uint8Array;
}
export {};
//# sourceMappingURL=TTFSubset.d.ts.map