import type GlyphPosition from '../layout/GlyphPosition.js';
import type GlyphInfo from './GlyphInfo.js';
import type OTProcessor from './OTProcessor.js';
type StageFunction = (font: any, glyphs: GlyphInfo[], plan: ShapingPlan) => void;
type Stage = string[] | StageFunction;
interface FeatureSpec {
    global?: string[];
    local?: string[];
}
/**
 * ShapingPlans are used by the OpenType shapers to store which
 * features should by applied, and in what order to apply them.
 * The features are applied in groups called stages. A feature
 * can be applied globally to all glyphs, or locally to only
 * specific glyphs.
 *
 * @private
 */
export default class ShapingPlan {
    font: any;
    script: string;
    direction: string;
    stages: Stage[];
    globalFeatures: Record<string, boolean>;
    allFeatures: Record<string, number>;
    constructor(font: any, script: string, direction: string);
    /**
     * Adds the given features to the last stage.
     * Ignores features that have already been applied.
     */
    _addFeatures(features: string[], global: boolean): void;
    /**
     * Add features to the last stage
     */
    add(arg: string | string[] | FeatureSpec, global?: boolean): void;
    /**
     * Add a new stage
     */
    addStage(arg: string | string[] | FeatureSpec | StageFunction, global?: boolean): void;
    setFeatureOverrides(features: string[] | Record<string, boolean>): void;
    /**
     * Assigns the global features to the given glyphs
     */
    assignGlobalFeatures(glyphs: GlyphInfo[]): void;
    /**
     * Executes the planned stages using the given OTProcessor
     */
    process(processor: OTProcessor, glyphs: GlyphInfo[], positions?: GlyphPosition[]): void;
}
export {};
//# sourceMappingURL=ShapingPlan.d.ts.map