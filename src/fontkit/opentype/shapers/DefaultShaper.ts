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
// @ts-ignore - Reserved for future vertical feature support
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
    // Every hook is dispatched through `this`, the shaper class choose()
    // selected, so subclass overrides (Arabic joining features, Indic and
    // USE reordering, Hangul composition) run. Naming DefaultShaper here
    // silently skips them all; the TypeScript migration did exactly that.
    // biome-ignore lint/complexity/noThisInStatic: dispatch to the subclass is the point
    this.planPreprocessing(plan);
    // biome-ignore lint/complexity/noThisInStatic: dispatch to the subclass is the point
    this.planFeatures(plan);
    // biome-ignore lint/complexity/noThisInStatic: dispatch to the subclass is the point
    this.planPostprocessing(plan, features);

    // Assign the global features to all the glyphs
    plan.assignGlobalFeatures(glyphs);

    // Assign local features to glyphs
    // biome-ignore lint/complexity/noThisInStatic: dispatch to the subclass is the point
    this.assignFeatures(plan, glyphs);
  }

  static planPreprocessing(plan: ShapingPlan): void {
    plan.add({
      global: [
        ...VARIATION_FEATURES,
        ...(DIRECTIONAL_FEATURES[plan.direction] || []),
      ],
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

  // Canonical composition does not live here (the cantoo fontkit fork put
  // NFC in this hook): Indic, USE and Hangul shapers override it without
  // chaining, fonts without GSUB/GPOS never reach a shaper, and
  // String.prototype.normalize ties output to the runtime's Unicode version.
  // It runs on code points in LayoutEngine.layout (CanonicalCompose.ts).
  static assignFeatures(_plan: ShapingPlan, glyphs: GlyphInfo[]): void {
    // Enable contextual fractions
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i]!;
      if (glyph.codePoints[0] === 0x2044) {
        // fraction slash
        let start = i;
        let end = i + 1;

        // Apply numerator
        while (start > 0 && isDigit(glyphs[start - 1]!.codePoints[0]!)) {
          glyphs[start - 1]!.features['numr'] = true;
          glyphs[start - 1]!.features['frac'] = true;
          start--;
        }

        // Apply denominator
        while (end < glyphs.length && isDigit(glyphs[end]!.codePoints[0]!)) {
          glyphs[end]!.features['dnom'] = true;
          glyphs[end]!.features['frac'] = true;
          end++;
        }

        // Apply fraction slash
        glyph.features['frac'] = true;
        i = end - 1;
      }
    }
  }
}
