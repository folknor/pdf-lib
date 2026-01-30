import GlyphInfo from '../GlyphInfo.js';
import type ShapingPlan from '../ShapingPlan.js';
import DefaultShaper from './DefaultShaper.js';
/**
 * This shaper is an implementation of the Universal Shaping Engine, which
 * uses Unicode data to shape a number of scripts without a dedicated shaping engine.
 * See https://www.microsoft.com/typography/OpenTypeDev/USE/intro.htm.
 */
export default class UniversalShaper extends DefaultShaper {
    static zeroMarkWidths: string;
    static planFeatures(plan: ShapingPlan): void;
    static assignFeatures(plan: ShapingPlan, glyphs: GlyphInfo[]): void;
}
//# sourceMappingURL=UniversalShaper.d.ts.map