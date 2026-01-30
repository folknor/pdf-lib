import type GlyphInfo from '../GlyphInfo.js';
import type ShapingPlan from '../ShapingPlan.js';
export default class DefaultShaper {
    static zeroMarkWidths: string;
    static plan(plan: ShapingPlan, glyphs: GlyphInfo[], features: string[] | Record<string, boolean>): void;
    static planPreprocessing(plan: ShapingPlan): void;
    static planFeatures(_plan: ShapingPlan): void;
    static planPostprocessing(plan: ShapingPlan, userFeatures: string[] | Record<string, boolean>): void;
    static assignFeatures(_plan: ShapingPlan, glyphs: GlyphInfo[]): void;
}
//# sourceMappingURL=DefaultShaper.d.ts.map