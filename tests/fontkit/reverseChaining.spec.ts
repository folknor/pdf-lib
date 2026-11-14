// GSUB lookup type 8, reverse chaining contextual single substitution.
import fs from 'node:fs';
import fontkit from '../../src/fontkit.js';
import GPOSProcessor from '../../src/fontkit/opentype/GPOSProcessor.js';
import GSUBProcessor from '../../src/fontkit/opentype/GSUBProcessor.js';

const cov = (...glyphs: number[]) => ({ version: 1, glyphs });
const glyph = (id: number, extra: object = {}) => ({ id, features: { test: true }, ...extra });

const reverse = (
  coverage: number[],
  substitute: number[],
  backtrack: number[][] = [],
  lookahead: number[][] = [],
) => ({
  substFormat: 1,
  coverage: cov(...coverage),
  backtrackGlyphCount: backtrack.length,
  backtrackCoverage: backtrack.map((g) => cov(...g)),
  lookaheadGlyphCount: lookahead.length,
  lookaheadCoverage: lookahead.map((g) => cov(...g)),
  glyphCount: substitute.length,
  substitute: { get: (i: number) => substitute[i] },
});

const processor = (Class: any, lookups: any[] = []) => {
  const p = Object.create(Class.prototype);
  p.table = { lookupList: { get: (i: number) => lookups[i] } };

  return p;
};

const run = (lookup: any, glyphs: any[], lookups: any[] = []) => {
  processor(GSUBProcessor, lookups).applyLookups([{ features: ['test'], index: 0, lookup }], glyphs);

  return glyphs.map((g) => g.id);
};

describe('GSUB reverse chaining', () => {
  // a -> b before b, walked end to start, so each substitution feeds the next.
  const propagating = reverse([1], [2], [], [[2]]);

  it('propagates from the end of the run', () => {
    expect(run({ lookupType: 8, flags: {}, subTables: [propagating] }, [glyph(1), glyph(1), glyph(2)])).toEqual([2, 2, 2]);
  });

  it('runs end to start behind an Extension', () => {
    const lookup = { lookupType: 7, flags: {}, subTables: [{ lookupType: 8, extension: propagating }] };
    expect(run(lookup, [glyph(1), glyph(1), glyph(2)])).toEqual([2, 2, 2]);
  });

  it('matches backtrack coverage closest glyph first', () => {
    const lookup = { lookupType: 8, flags: {}, subTables: [reverse([3], [9], [[2], [1]])] };
    expect(run(lookup, [glyph(1), glyph(2), glyph(3)])).toEqual([1, 2, 9]);
    expect(run(lookup, [glyph(2), glyph(1), glyph(3)])).toEqual([2, 1, 3]);
  });

  it('skips glyphs the lookup flags ignore and targets without the feature', () => {
    const lookup = { lookupType: 8, flags: { flags: { ignoreMarks: true } }, subTables: [propagating] };
    const glyphs = [glyph(1), glyph(5, { isMark: true }), glyph(2), glyph(1, { isMark: true })];
    expect(run(lookup, glyphs)).toEqual([2, 5, 2, 1]);
    const off = [glyph(1, { features: {} }), glyph(2)];
    expect(run({ lookupType: 8, flags: {}, subTables: [propagating] }, off)).toEqual([1, 2]);
  });

  it('is not applied from a contextual rule, but later records still run', () => {
    const single = { lookupType: 1, flags: {}, subTables: [{ version: 2, coverage: cov(1), substitute: { get: () => 7 } }] };

    const lookups = [
      { lookupType: 8, flags: {}, subTables: [reverse([1], [4])] },
      single,
    ];

    const context = {
      lookupType: 5,
      flags: {},
      subTables: [
        {
          version: 3,
          coverages: [cov(1)],
          lookupRecords: [
            { sequenceIndex: 0, lookupListIndex: 0 },
            { sequenceIndex: 0, lookupListIndex: 1 },
          ],
        },
      ],
    };

    expect(run(context, [glyph(1)], lookups)).toEqual([7]);
  });

  it('honours lookup flags on the first glyph of a forward lookup', () => {
    const single = {
      lookupType: 1,
      flags: { flags: { ignoreMarks: true } },
      subTables: [{ version: 2, coverage: cov(1), substitute: { get: () => 7 } }],
    };

    expect(run(single, [glyph(1, { isMark: true }), glyph(1)])).toEqual([1, 7]);
  });

  it('leaves GPOS lookup type 8 forward', () => {
    expect(processor(GPOSProcessor).isReverseLookup({ lookupType: 8, subTables: [] })).toBe(false);
  });

  // Noto Sans Coptic's ccmp picks the .cap macron over capitals with type 8.
  it('decodes and applies Noto Sans Coptic', () => {
    const font: any = fontkit.create(
      fs.readFileSync('./assets/fonts/noto_sans_coptic/NotoSansCoptic-Regular.ttf'),
    );

    const glyphs = font.layout('Ⲁ̅ⲁ̅').glyphs;
    expect(glyphs.map((g: any) => g.name)).toEqual([
      'uni2C80',
      'uni0305.large.cap',
      'uni2C81',
      'uni0305.cap',
    ]);
    // The ids cantoo-scribe/fontkit's shaping test expects for this string.
    expect(glyphs.map((g: any) => g.id)).toEqual([33, 196, 34, 199]);
  });
});
