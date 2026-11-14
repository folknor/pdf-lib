import fs from 'node:fs';
import fontkit from '../../src/fontkit.js';
import { composeCanonical } from '../../src/fontkit/layout/CanonicalCompose.js';

const font = (...mapped: number[]) => {
  const set = new Set(mapped);
  return (cp: number) => set.has(cp);
};

describe('canonical composition', () => {
  it('composes a mark onto its base when the font maps the composite', () => {
    expect(composeCanonical([0x69, 0x300], font(0x69, 0x300, 0xec))).toEqual([0xec]);
    expect(composeCanonical([0x62, 0x300], font(0x62, 0x300))).toEqual([0x62, 0x300]);
  });

  it('composes greedily through intermediate composites', () => {
    const hasGlyph = font(0x65, 0x302, 0x301, 0xea, 0x1ebf);
    expect(composeCanonical([0x65, 0x302, 0x301], hasGlyph)).toEqual([0x1ebf]);
  });

  it('leaves a composite unused when the font lacks it', () => {
    expect(composeCanonical([0x65, 0x301], font(0x65, 0x301))).toEqual([0x65, 0x301]);
  });

  it('is blocked by any earlier mark of equal or higher class', () => {
    // a + acute (230) + dot below (220) + ring (230): the acute blocks the
    // ring even though the dot below right before it has a lower class.
    const hasGlyph = font(0x61, 0x301, 0x323, 0x30a, 0xe5);
    expect(composeCanonical([0x61, 0x301, 0x323, 0x30a], hasGlyph)).toEqual([
      0x61, 0x301, 0x323, 0x30a,
    ]);
    // A lower-class mark in between does not block.
    expect(composeCanonical([0x61, 0x323, 0x30a], hasGlyph)).toEqual([0xe5, 0x323]);
  });

  it('is blocked by CGJ', () => {
    const hasGlyph = font(0x61, 0x301, 0xe1);
    expect(composeCanonical([0x61, 0x34f, 0x301], hasGlyph)).toEqual([0x61, 0x34f, 0x301]);
    expect(composeCanonical([0x61, 0x34f, 0x301], font(0x61, 0x34f, 0x301, 0xe1))).toEqual([
      0x61, 0x34f, 0x301,
    ]);
  });

  it('never composes a class-0 mark or onto a mark', () => {
    // Balinese A + TEDUNG (a vowel sign of class 0).
    expect(composeCanonical([0x1b05, 0x1b35], font(0x1b05, 0x1b35, 0x1b06))).toEqual([
      0x1b05, 0x1b35,
    ]);
    // Oriya split vowel E + AA starts at a mark.
    expect(
      composeCanonical([0x0b15, 0x0b47, 0x0b3e], font(0x0b15, 0x0b47, 0x0b3e, 0x0b4b)),
    ).toEqual([0x0b15, 0x0b47, 0x0b3e]);
  });

  it('honours the full composition exclusions', () => {
    // Explicit list: Devanagari QA, Hebrew ALEF WITH PATAH.
    expect(composeCanonical([0x915, 0x93c], font(0x915, 0x93c, 0x958))).toEqual([0x915, 0x93c]);
    expect(composeCanonical([0x5d0, 0x5b7], font(0x5d0, 0x5b7, 0xfb2e))).toEqual([0x5d0, 0x5b7]);
    // Non-starter decomposition: Tibetan II.
    expect(composeCanonical([0xf40, 0xf71, 0xf72], font(0xf40, 0xf71, 0xf72, 0xf73))).toEqual([
      0xf40, 0xf71, 0xf72,
    ]);
    // Not excluded: Devanagari NNNA.
    expect(composeCanonical([0x928, 0x93c], font(0x928, 0x93c, 0x929))).toEqual([0x929]);
  });

  it('leaves a cluster with a variation selector as typed', () => {
    const hasGlyph = font(0x61, 0x301, 0xe1, 0xfe00);
    expect(composeCanonical([0x61, 0x301, 0xfe00], hasGlyph)).toEqual([0x61, 0x301, 0xfe00]);
    expect(composeCanonical([0x2126, 0xfe00], font(0x3a9))).toEqual([0x2126, 0xfe00]);
  });

  it('decomposes an unmapped code point into the shortest mapped form', () => {
    // A WITH RING ABOVE AND ACUTE, font has A-WITH-RING and acute only.
    expect(composeCanonical([0x1fa], font(0xc5, 0x301))).toEqual([0xc5, 0x301]);
    expect(composeCanonical([0x1fa], font(0x41, 0x30a, 0x301))).toEqual([0x41, 0x30a, 0x301]);
    // No fully mapped form: kept as typed.
    expect(composeCanonical([0x1fa], font(0xc5))).toEqual([0x1fa]);
    // Singleton: OHM SIGN to OMEGA.
    expect(composeCanonical([0x2126], font(0x3a9))).toEqual([0x3a9]);
    // Tibetan II splits for a font without it.
    expect(composeCanonical([0xf40, 0xf73], font(0xf40, 0xf71, 0xf72))).toEqual([
      0xf40, 0xf71, 0xf72,
    ]);
  });

  it('never decomposes a mapped code point', () => {
    expect(composeCanonical([0xe9], font(0xe9, 0x65, 0x301))).toEqual([0xe9]);
  });

  it('leaves Hangul syllables alone', () => {
    expect(composeCanonical([0xac00], font(0x1100, 0x1161))).toEqual([0xac00]);
  });

  it('reaches fonts through layout', () => {
    const ubuntu: any = fontkit.create(fs.readFileSync('./assets/fonts/ubuntu/Ubuntu-R.ttf'));
    // e + COMBINING ACUTE becomes the font's precomposed glyph.
    const run = ubuntu.layout(String.fromCodePoint(0x65, 0x301));
    expect(run.glyphs.map((g: any) => g.codePoints)).toEqual([[0xe9]]);
  });
});
