import type Glyph from './glyph/Glyph.js';
import { Point } from './glyph/TTFGlyph.js';
import TTFFont from './TTFFont.js';
interface TransformedGlyph {
    numberOfContours: number;
    points?: Point[];
    components?: any[];
}
/**
 * Subclass of TTFFont that represents a TTF/OTF font compressed by WOFF2
 * See spec here: http://www.w3.org/TR/WOFF2/
 */
export default class WOFF2Font extends TTFFont {
    type: string;
    _dataPos: number;
    _decompressed?: boolean;
    _transformedGlyphs?: TransformedGlyph[];
    static probe(buffer: Uint8Array): boolean;
    _decodeDirectory(): void;
    _decompress(): void;
    _decodeTable(table: any): any;
    _getBaseGlyph(glyph: number, characters?: number[]): Glyph | null;
    _transformGlyfTable(): void;
}
export {};
//# sourceMappingURL=WOFF2Font.d.ts.map