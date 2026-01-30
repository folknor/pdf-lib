// @ts-nocheck
import { isDigit } from '../../../vendors/unicode-properties/index.js';
import type GlyphInfo from '../GlyphInfo.js';
import type ShapingPlan from '../ShapingPlan.js';

const VARIATION_FEATURES: string[] = ['rvrn'];
const COMMON_FEATURES: string[] = ['ccmp', 'locl', 'rlig', 'mark', 'mkmk'];
const FRACTIONAL_FEATURES: string[] = ['frac', 'numr', 'dnom'];
const HORIZONTAL_FEATURES: string[] = [
  'calt',
  'clig',
  'liga',
  'rclt',
  'curs',
  'kern',
];
const _VERTICAL_FEATURES: string[] = ['vert'];
const DIRECTIONAL_FEATURES: Record<string, string[]> = {
  ltr: ['ltra', 'ltrm'],
  rtl: ['rtla', 'rtlm'],
};

export default class DefaultShaper {
  static zeroMarkWidths = 'AFTER_GPOS';
  static plan(
    plan: ShapingPlan,
    glyphs: GlyphInfo[],
    features: string[] | Record<string, boolean>,
  ): void {
    // Plan the features we want to apply
    DefaultShaper.planPreprocessing(plan);
    DefaultShaper.planFeatures(plan);
    DefaultShaper.planPostprocessing(plan, features);

    // Assign the global features to all the glyphs
    plan.assignGlobalFeatures(glyphs);

    // Assign local features to glyphs
    DefaultShaper.assignFeatures(plan, glyphs);
  }

  static planPreprocessing(plan: ShapingPlan): void {
    plan.add({
      global: [...VARIATION_FEATURES, ...DIRECTIONAL_FEATURES[plan.direction]],
      local: FRACTIONAL_FEATURES,
    });
  }

  static planFeatures(_plan: ShapingPlan): void {
    // Do nothing by default. Let subclasses override this.
  }

  static planPostprocessing(
    plan: ShapingPlan,
    userFeatures: string[] | Record<string, boolean>,
  ): void {
    plan.add([...COMMON_FEATURES, ...HORIZONTAL_FEATURES]);
    plan.setFeatureOverrides(userFeatures);
  }

  static assignFeatures(_plan: ShapingPlan, glyphs: GlyphInfo[]): void {
    // Enable contextual fractions
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i];
      if (glyph.codePoints[0] === 0x2044) {
        // fraction slash
        let start = i;
        let end = i + 1;

        // Apply numerator
        while (start > 0 && isDigit(glyphs[start - 1].codePoints[0])) {
          glyphs[start - 1].features.numr = true;
          glyphs[start - 1].features.frac = true;
          start--;
        }

        // Apply denominator
        while (end < glyphs.length && isDigit(glyphs[end].codePoints[0])) {
          glyphs[end].features.dnom = true;
          glyphs[end].features.frac = true;
          end++;
        }

        // Apply fraction slash
        glyph.features.frac = true;
        i = end - 1;
      }
    }
  }
}
