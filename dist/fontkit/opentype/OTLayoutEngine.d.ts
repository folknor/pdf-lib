import type GlyphPosition from '../layout/GlyphPosition.js';
import type GlyphRun from '../layout/GlyphRun.js';
import GlyphInfo from './GlyphInfo.js';
import GPOSProcessor from './GPOSProcessor.js';
import GSUBProcessor from './GSUBProcessor.js';
import ShapingPlan from './ShapingPlan.js';
export default class OTLayoutEngine {
    font: any;
    glyphInfos: GlyphInfo[] | null;
    plan: ShapingPlan | null;
    GSUBProcessor: GSUBProcessor | null;
    GPOSProcessor: GPOSProcessor | null;
    fallbackPosition: boolean;
    shaper: any;
    constructor(font: any);
    setup(glyphRun: GlyphRun): void;
    substitute(glyphRun: GlyphRun): void;
    position(glyphRun: GlyphRun): Record<string, any> | undefined;
    zeroMarkAdvances(positions: GlyphPosition[]): void;
    cleanup(): void;
    getAvailableFeatures(script: string, language?: string): string[];
}
//# sourceMappingURL=OTLayoutEngine.d.ts.map