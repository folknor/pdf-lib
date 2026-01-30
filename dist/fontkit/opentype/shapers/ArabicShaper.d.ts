import type GlyphInfo from '../GlyphInfo.js';
import type ShapingPlan from '../ShapingPlan.js';
import DefaultShaper from './DefaultShaper.js';
/**
 * This is a shaper for Arabic, and other cursive scripts.
 * It uses data from ArabicShaping.txt in the Unicode database,
 * compiled to a UnicodeTrie by generate-data.coffee.
 *
 * The shaping state machine was ported from Harfbuzz.
 * https://github.com/behdad/harfbuzz/blob/master/src/hb-ot-shape-complex-arabic.cc
 */
export default class ArabicShaper extends DefaultShaper {
    static planFeatures(plan: ShapingPlan): void;
    static assignFeatures(plan: ShapingPlan, glyphs: GlyphInfo[]): void;
}
//# sourceMappingURL=ArabicShaper.d.ts.map