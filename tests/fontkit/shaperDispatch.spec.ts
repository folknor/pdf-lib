import fs from 'node:fs';
import fontkit from '../../src/fontkit.js';
import type GlyphInfo from '../../src/fontkit/opentype/GlyphInfo.js';
import ShapingPlan from '../../src/fontkit/opentype/ShapingPlan.js';
import ArabicShaper from '../../src/fontkit/opentype/shapers/ArabicShaper.js';
import DefaultShaper from '../../src/fontkit/opentype/shapers/DefaultShaper.js';
import HangulShaper from '../../src/fontkit/opentype/shapers/HangulShaper.js';
import UniversalShaper from '../../src/fontkit/opentype/shapers/UniversalShaper.js';

const glyphs = (codePoints: number[]) =>
  codePoints.map((c) => ({ codePoints: [c], features: {} })) as unknown as GlyphInfo[];

const planned = (shaper: typeof DefaultShaper, script: string, dir: string) => {
  const plan = new ShapingPlan(null, script, dir);
  shaper.plan(plan, [], []);
  return plan;
};

// DefaultShaper.plan once named DefaultShaper for every hook, so no
// subclass's planFeatures or assignFeatures ever ran.
describe('shaper hook dispatch', () => {
  it('runs a subclass planFeatures', () => {
    expect(planned(ArabicShaper, 'arab', 'rtl').allFeatures).toHaveProperty('init');
    expect(planned(HangulShaper, 'hang', 'ltr').allFeatures).toHaveProperty('ljmo');
    expect(planned(UniversalShaper, 'khmr', 'ltr').allFeatures).toHaveProperty('pref');
    expect(planned(DefaultShaper, 'latn', 'ltr').allFeatures).not.toHaveProperty('init');
  });

  it('runs a subclass assignFeatures', () => {
    const plan = new ShapingPlan(null, 'arab', 'rtl');
    const run = glyphs([0x0628, 0x0628, 0x0628]); // BEH BEH BEH
    ArabicShaper.plan(plan, run, []);
    expect(run.map((g) => Object.keys(g.features).filter((f) => /^(init|medi|fina|isol)$/.test(f))))
      .toEqual([['init'], ['medi'], ['fina']]);
  });

  it('composes Hangul jamo but leaves other letters alone', () => {
    // A font that has every glyph, its id being the code point.
    const font = {
      hasGlyphForCodePoint: () => true,
      glyphForCodePoint: (c: number) => ({ id: c, codePoints: [c] }),
    };
    const shape = (cps: number[]) => {
      const run = glyphs(cps);
      HangulShaper.plan(new ShapingPlan(font, 'hang', 'ltr'), run, []);
      return run.map((g) => g.codePoints);
    };
    // GA + JONGSEONG KIYEOK composes to GAG.
    expect(shape([0xac00, 0x11a8]).map((c) => c[0])).toEqual([0xac01]);
    // H, comma and d sit at multiples of 28 below U+AC00 and used to be
    // taken for LV syllables and "composed" into I, - and e.
    for (const c of [0x48, 0x2c, 0x64]) {
      expect(shape([c, 0x11a8])).toEqual([[c], [0x11a8]]);
    }
  });

  // The USE repha move spliced by an index into the already shortened array
  // and never removed the original repha, so a two-glyph syllable threw.
  it('moves a USE repha after its base', () => {
    const font: any = fontkit.create(
      fs.readFileSync('./assets/fonts/noto_sans_sharada/NotoSansSharada-Regular.ttf'),
    );
    // SHARADA SIGN JIHVAMULIYA (repha) + SHARADA LETTER KA
    const run = font.layout(String.fromCodePoint(0x111c2, 0x11191));
    expect(run.glyphs.map((g: any) => g.codePoints)).toEqual([[0x11191], [0x111c2]]);
  });
});

// Tibetan AA (U+0F71) is a nukta (CMBlw) per the USE specification's
// overrides, so it precedes the vowel signs as in Unicode canonical order.
// As a plain VBlw it came after them in the grammar, and KA + AA + I (also
// the decomposition of U+0F73) split into a broken cluster.
describe('USE Tibetan clusters', () => {
  const font: any = fontkit.create(
    fs.readFileSync('./assets/fonts/noto_serif_tibetan/NotoSerifTibetan[wght].ttf'),
  );
  const shape = (...cps: number[]) =>
    font.layout(String.fromCodePoint(...cps)).glyphs.map((g: any) => g.codePoints);
  const dotted = (...cps: number[]) =>
    shape(...cps).some((c: number[]) => c.includes(0x25cc));

  it('keeps AA before a vowel sign in one cluster', () => {
    expect(shape(0x0f40, 0x0f71, 0x0f72)).toEqual([[0x0f40, 0x0f71], [0x0f72]]);
    expect(shape(0x0f40, 0x0f73)).toEqual([[0x0f40, 0x0f71], [0x0f72]]);
    for (const v of [0x0f74, 0x0f7a, 0x0f7c, 0x0f80]) {
      expect(dotted(0x0f40, 0x0f71, v)).toBe(false);
    }
    expect(dotted(0x0f40, 0x0f75)).toBe(false);
    expect(dotted(0x0f40, 0x0f81)).toBe(false);
  });

  // Known cost, until a pre-shaping canonical reorder exists: the
  // non-canonical spelling with the vowel before AA is now broken.
  it('breaks a vowel sign before AA', () => {
    expect(dotted(0x0f40, 0x0f72, 0x0f71)).toBe(true);
  });
});
