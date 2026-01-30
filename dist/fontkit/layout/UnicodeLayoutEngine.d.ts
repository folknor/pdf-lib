import type Glyph from '../glyph/Glyph.js';
import type GlyphPosition from './GlyphPosition.js';
/**
 * This class is used when GPOS does not define 'mark' or 'mkmk' features
 * for positioning marks relative to base glyphs. It uses the unicode
 * combining class property to position marks.
 *
 * Based on code from Harfbuzz, thanks!
 * https://github.com/behdad/harfbuzz/blob/master/src/hb-ot-shape-fallback.cc
 */
export default class UnicodeLayoutEngine {
    font: any;
    constructor(font: any);
    positionGlyphs(glyphs: Glyph[], positions: GlyphPosition[]): GlyphPosition[];
    positionCluster(glyphs: Glyph[], positions: GlyphPosition[], clusterStart: number, clusterEnd: number): void;
    getCombiningClass(codePoint: number): string;
}
//# sourceMappingURL=UnicodeLayoutEngine.d.ts.map