import fs from 'node:fs';
import fontkit from '../../src/fontkit.js';
import { initialClusters, mergeClusters } from '../../src/fontkit/layout/Clusters.js';

// Source Han Serif JP draws U+002D, U+00AD and U+2011 with one glyph. Glyph
// objects are shared per id, so whatever is decided from code points must
// come from the occurrence: a soft hyphen laid out first used to hide every
// later hyphen, and a hyphen laid out first made soft hyphens visible.
const han = fs.readFileSync(
  './assets/fonts/source_hans_jp/SourceHanSerifJP-Regular.otf',
);

const hidden = (font: any, text: string) =>
  font.layout(text).positions.map((p: any) => !!p.hidden);

describe('per-occurrence code points', () => {
  it('shapes a shared glyph by the occurrence, whatever came first', () => {
    const afterSoft: any = fontkit.create(han);
    hidden(afterSoft, 'a­b');
    expect(hidden(afterSoft, 'a-b')).toEqual([false, false, false]);

    const afterHyphen: any = fontkit.create(han);
    hidden(afterHyphen, 'a-b');
    expect(hidden(afterHyphen, 'a­b')).toEqual([false, true, false]);
  });

  it('reports the code points of each occurrence', () => {
    const font: any = fontkit.create(han);
    const run = font.layout('-­‑');
    // The soft hyphen is hidden, so drawn as the space glyph.
    expect(run.glyphs[0].id).toBe(run.glyphs[2].id);
    expect(run.codePoints).toEqual([[0x2d], [0xad], [0x2011]]);
    expect(run.glyphs[0].codePoints).toBeUndefined();
  });

  it('gives a ligature the code points of all its components', () => {
    const ubuntu: any = fontkit.create(
      fs.readFileSync('./assets/fonts/ubuntu/Ubuntu-R.ttf'),
    );

    const run = ubuntu.layout('Stuff');
    expect(run.codePoints.flat()).toEqual([...'Stuff'].map((c) => c.codePointAt(0)));
    expect(run.codePoints.some((cps: number[]) => cps.length > 1)).toBe(true);
    expect(run.text).toEqual(run.codePoints);
  });

  it('gives a ligature the smallest cluster of its components and counts them', () => {
    const ubuntu: any = fontkit.create(
      fs.readFileSync('./assets/fonts/ubuntu/Ubuntu-R.ttf'),
    );

    const run = ubuntu.layout('Stuff');
    const ligature = run.codePoints.findIndex((cps: number[]) => cps.length > 1);
    expect(run.clusters[ligature]).toBe(3);
    expect(run.components[ligature]).toBe(2);
    expect(run.clusters.slice(0, ligature)).toEqual([0, 1, 2]);
    expect(run.characters).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('source clusters', () => {
  it('joins what continues a character and counts characters to space', () => {
    // a + acute, ZWJ, A, flag (two regional indicators), b
    const string = 'a\u0301\u200dA\u{1f1f3}\u{1f1f4}b';
    const { clusters, characters } = initialClusters(string);
    expect(clusters).toEqual([0, 0, 0, 3, 4, 4, 8]);
    expect(characters).toEqual([0, 3, 4, 8]);
    // A leading mark still counts; a default-ignorable never does.
    expect(initialClusters('\u0301a').characters).toEqual([0, 1]);
    expect(initialClusters('\u200da').characters).toEqual([1]);
  });

  it('merges clusters that reordering moved past each other', () => {
    const merged = [2, 5, 3, 7];
    mergeClusters(merged);
    expect(merged).toEqual([0, 3, 3, 7]);
    const reversed = [7, 3, 5, 2];
    mergeClusters(reversed, true);
    expect(reversed).toEqual([7, 3, 3, 0]);
  });
});
