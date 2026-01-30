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
    _addGlyph(gid: number): number;
    encode(): Uint8Array;
}
export {};
//# sourceMappingURL=TTFSubset.d.ts.map