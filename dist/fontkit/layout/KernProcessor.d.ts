import type Glyph from '../glyph/Glyph.js';
import type GlyphPosition from './GlyphPosition.js';
export default class KernProcessor {
    kern: any;
    constructor(font: any);
    process(glyphs: Glyph[], positions: GlyphPosition[]): void;
    getKerning(left: number, right: number): number;
}
//# sourceMappingURL=KernProcessor.d.ts.map