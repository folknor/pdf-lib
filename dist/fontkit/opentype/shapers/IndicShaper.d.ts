import GlyphInfo from '../GlyphInfo.js';
import type ShapingPlan from '../ShapingPlan.js';
import DefaultShaper from './DefaultShaper.js';
/**
 * The IndicShaper supports indic scripts e.g. Devanagari, Kannada, etc.
 * Based on code from Harfbuzz: https://github.com/behdad/harfbuzz/blob/master/src/hb-ot-shape-complex-indic.cc
 */
export default class IndicShaper extends DefaultShaper {
    static zeroMarkWidths: string;
    static planFeatures(plan: ShapingPlan & {
        unicodeScript?: string;
        indicConfig?: any;
        isOldSpec?: boolean;
    }): void;
    static assignFeatures(plan: ShapingPlan, glyphs: GlyphInfo[]): void;
}
//# sourceMappingURL=IndicShaper.d.ts.map