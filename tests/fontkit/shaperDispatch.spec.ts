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
    expect(run.codePoints).toEqual([[0x11191], [0x111c2]]);
    // A CGJ between them changes neither the cluster nor the reorder.
    const withCgj = font.layout(String.fromCodePoint(0x111c2, 0x034f, 0x11191));
    expect(withCgj.codePoints.flat()).not.toContain(0x25cc);
    expect(withCgj.codePoints.at(-1)).toEqual([0x111c2]);
    // Nor does a CGJ before them.
    const leading = font.layout(String.fromCodePoint(0x034f, 0x111c2, 0x11191));
    expect(leading.codePoints.at(-1)).toEqual([0x111c2]);
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
    font.layout(String.fromCodePoint(...cps)).codePoints;

  const dotted = (...cps: number[]) =>
    shape(...cps).some((c: number[]) => c.includes(0x25cc));

  it('keeps AA before a vowel sign in one cluster', () => {
    expect(shape(0x0f40, 0x0f71, 0x0f72)).toEqual([[0x0f40, 0x0f71], [0x0f72]]);
    // The font maps II: preserve it through the canonical stage and let
    // the font's own multiple substitution split its drawing, not its text.
    expect(shape(0x0f40, 0x0f73).flat()).toEqual([0x0f40, 0x0f73]);

    for (const v of [0x0f74, 0x0f7a, 0x0f7c, 0x0f80]) {
      expect(dotted(0x0f40, 0x0f71, v)).toBe(false);
    }

    expect(dotted(0x0f40, 0x0f75)).toBe(false);
    expect(dotted(0x0f40, 0x0f81)).toBe(false);
  });

  // The mark reorder (CanonicalCompose.ts) puts AA first, and TSA -PHRU
  // (a CMAbv) before AA (a CMBlw), as the grammar takes them.
  it('reorders a vowel sign or TSA -PHRU typed around AA', () => {
    expect(dotted(0x0f40, 0x0f72, 0x0f71)).toBe(false);
    expect(dotted(0x0f40, 0x0f71, 0x0f39)).toBe(false);
    expect(dotted(0x0f40, 0x0f39, 0x0f71)).toBe(false);
  });

  it('shapes U before every other vowel in either typed order', () => {
    for (const v of [0x0f72, 0x0f7a, 0x0f7b, 0x0f7c, 0x0f7d, 0x0f80]) {
      const a = font.layout(String.fromCodePoint(0x0f40, v, 0x0f74));
      const b = font.layout(String.fromCodePoint(0x0f40, 0x0f74, v));
      expect(a.codePoints.flat()).not.toContain(0x25cc);
      expect(a.glyphs.map((g: any) => g.id)).toEqual(b.glyphs.map((g: any) => g.id));
      expect(a.positions).toEqual(b.positions);
      expect(a.positions.at(-1).attachedTo).toBe(0);
      expect(a.text.flat().sort()).toEqual([0x0f40, v, 0x0f74].sort());
      expect(a.clusters).toEqual(a.glyphs.map(() => 0));
    }

    const run = font.layout(String.fromCodePoint(0x0f40, 0x0f7a, 0x0f74));
    expect(run.glyphs.map((g: any) => g.id)).toEqual([157, 1337]);
    expect(run.positions.map((p: any) => [p.xAdvance, p.xOffset, p.yOffset]))
      .toEqual([[704, 0, 0], [0, -599, 0]]);
  });

  it('stacks repeated vowels without losing occurrences', () => {
    for (const v of [0x0f74, 0x0f72, 0x0f7a]) {
      const run = font.layout(String.fromCodePoint(0x0f40, v, v));
      expect(run.codePoints).toEqual([[0x0f40], [v], [v]]);
      expect(run.text.flat()).toEqual([0x0f40, v, v]);
      expect(run.positions.map((p: any) => p.attachedTo)).toEqual([null, 0, 1]);
      expect(run.positions[2].yOffset).not.toBe(run.positions[1].yOffset);
    }

    expect(dotted(0x0f40, 0x0f7a, 0x0f74, 0x0f7a, 0x0f74)).toBe(false);
  });

  it('places HALANTA after vowels and attaches it to the KA+U ligature', () => {
    for (const v of [0x0f72, 0x0f74, 0x0f7a, 0x0f7c, 0x0f80]) {
      const a = font.layout(String.fromCodePoint(0x0f40, 0x0f84, v));
      const b = font.layout(String.fromCodePoint(0x0f40, v, 0x0f84));
      expect(a.codePoints.flat()).not.toContain(0x25cc);
      expect(a.glyphs.map((g: any) => g.id)).toEqual(b.glyphs.map((g: any) => g.id));
      expect(a.positions).toEqual(b.positions);
      expect(a.positions.at(-1).attachedTo).toBe(0);
    }

    const run = font.layout(String.fromCodePoint(0x0f40, 0x0f84, 0x0f74));
    expect(run.glyphs.map((g: any) => g.id)).toEqual([157, 1352]);
    expect([run.positions.at(-1).xOffset, run.positions.at(-1).yOffset])
      .toEqual([-364, -472]);
  });

  it('keeps mapped II followed by TSA -PHRU out of broken clusters', () => {
    expect(font.hasGlyphForCodePoint(0x0f73)).toBe(true);
    const run = font.layout(String.fromCodePoint(0x0f40, 0x0f73, 0x0f39));
    expect(run.codePoints.flat()).not.toContain(0x25cc);
    expect(run.text.flat()).toEqual([0x0f40, 0x0f73, 0x0f39]);
    expect(run.clusters).toEqual(run.glyphs.map(() => 0));
    // The exception requires an existing standard cluster: a lone II is
    // still broken, and cannot give the following TSA -PHRU a base.
    expect(dotted(0x0f73, 0x0f39)).toBe(true);
  });

  // The inserted dotted circle is shaped as U+25CC but stands for no
  // typed character, so it contributes nothing to the run's text. A vowel
  // sign with no base is a broken cluster.
  it('keeps an inserted dotted circle out of the text', () => {
    const run = font.layout(String.fromCodePoint(0x0f72, 0x0f40));
    const all = (arrays: number[][]) => arrays.flat();
    expect(all(run.codePoints)).toContain(0x25cc);
    // The circle is the base, so it comes before the vowel sign.
    expect(run.codePoints).toEqual([[0x25cc], [0x0f72], [0x0f40]]);
    expect(all(run.text)).not.toContain(0x25cc);
    expect(all(run.text).sort()).toEqual([0x0f40, 0x0f72].sort());
  });

  // A glyph no syllable takes (a lone joiner) is shaped on its own,
  // untouched by the reordering.
  it('shapes a glyph outside every syllable', () => {
    expect(shape(0x200d, 0x0f40).flat()).toEqual(
      expect.arrayContaining([0x200d, 0x0f40]),
    );
    expect(shape(0x200d).flat()).toEqual([0x200d]);
  });

  // CGJ has no effect on clustering (USE specification) though the grammar
  // has no place for it: KA CGJ I stays one cluster, and the CGJ the user
  // typed to keep I before AA leaves AA a broken cluster of its own (AA,
  // a nukta, goes before vowel signs), with its circle before it.
  it('treats CGJ as transparent to clustering', () => {
    expect(dotted(0x0f40, 0x034f, 0x0f72)).toBe(false);
    expect(shape(0x0f40, 0x0f72, 0x034f, 0x0f71).slice(-2)).toEqual([
      [0x25cc],
      [0x0f71],
    ]);
    expect(shape(0x034f).flat()).toEqual([0x034f]);
    expect(dotted(0x034f, 0x0f40, 0x0f72)).toBe(false);
  });
});
