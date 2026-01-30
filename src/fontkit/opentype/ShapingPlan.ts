// @ts-nocheck

import type GlyphPosition from '../layout/GlyphPosition.js';
import type GlyphInfo from './GlyphInfo.js';
import type OTProcessor from './OTProcessor.js';

type StageFunction = (
  font: any,
  glyphs: GlyphInfo[],
  plan: ShapingPlan,
) => void;
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

  constructor(font: any, script: string, direction: string) {
    this.font = font;
    this.script = script;
    this.direction = direction;
    this.stages = [];
    this.globalFeatures = {};
    this.allFeatures = {};
  }

  /**
   * Adds the given features to the last stage.
   * Ignores features that have already been applied.
   */
  _addFeatures(features: string[], global: boolean): void {
    const stageIndex = this.stages.length - 1;
    const stage = this.stages[stageIndex];
    for (const feature of features) {
      if (this.allFeatures[feature] == null) {
        stage.push(feature);
        this.allFeatures[feature] = stageIndex;

        if (global) {
          this.globalFeatures[feature] = true;
        }
      }
    }
  }

  /**
   * Add features to the last stage
   */
  add(arg: string | string[] | FeatureSpec, global: boolean = true): void {
    if (this.stages.length === 0) {
      this.stages.push([]);
    }

    if (typeof arg === 'string') {
      arg = [arg];
    }

    if (Array.isArray(arg)) {
      this._addFeatures(arg, global);
    } else if (typeof arg === 'object') {
      this._addFeatures(arg.global || [], true);
      this._addFeatures(arg.local || [], false);
    } else {
      throw new Error('Unsupported argument to ShapingPlan#add');
    }
  }

  /**
   * Add a new stage
   */
  addStage(
    arg: string | string[] | FeatureSpec | StageFunction,
    global?: boolean,
  ): void {
    if (typeof arg === 'function') {
      this.stages.push(arg, []);
    } else {
      this.stages.push([]);
      this.add(arg, global);
    }
  }

  setFeatureOverrides(features: string[] | Record<string, boolean>): void {
    if (Array.isArray(features)) {
      this.add(features);
    } else if (typeof features === 'object') {
      for (const tag in features) {
        if (features[tag]) {
          this.add(tag);
        } else if (this.allFeatures[tag] != null) {
          const stage = this.stages[this.allFeatures[tag]];
          stage.splice(stage.indexOf(tag), 1);
          delete this.allFeatures[tag];
          delete this.globalFeatures[tag];
        }
      }
    }
  }

  /**
   * Assigns the global features to the given glyphs
   */
  assignGlobalFeatures(glyphs: GlyphInfo[]): void {
    for (const glyph of glyphs) {
      for (const feature in this.globalFeatures) {
        glyph.features[feature] = true;
      }
    }
  }

  /**
   * Executes the planned stages using the given OTProcessor
   */
  process(
    processor: OTProcessor,
    glyphs: GlyphInfo[],
    positions?: GlyphPosition[],
  ): void {
    for (const stage of this.stages) {
      if (typeof stage === 'function') {
        if (!positions) {
          stage(this.font, glyphs, this);
        }
      } else if (stage.length > 0) {
        processor.applyFeatures(stage, glyphs, positions);
      }
    }
  }
}
