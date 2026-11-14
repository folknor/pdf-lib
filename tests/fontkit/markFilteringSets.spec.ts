// lookupFlag UseMarkFilteringSet: marks outside the lookup's GDEF mark glyph
// set are skipped, marks inside it are seen.
import GSUBProcessor from '../../src/fontkit/opentype/GSUBProcessor.js';

const cov = (...glyphs: number[]) => ({ version: 1, glyphs });
const base = (id: number) => ({ id, features: { test: true }, isMark: false, isBase: true });
const mark = (id: number, markAttachmentType = 0) => ({
  id,
  features: { test: true },
  isMark: true,
  markAttachmentType,
});

const SET_0 = cov(10);

const processor = (lookups: any[], gdef: any = { markGlyphSetsDef: { coverage: [SET_0] } }) => {
  const p = Object.create(GSUBProcessor.prototype);
  p.table = { lookupList: { get: (i: number) => lookups[i] } };
  p.font = { GDEF: gdef };
  return p;
};

// Substitutes 99 for the base when the base is followed by mark 10.
const single = { lookupType: 1, flags: {}, subTables: [{ version: 2, coverage: cov(1), substitute: { get: () => 99 } }] };
const context = (flags: any, markFilteringSet?: number) => ({
  lookupType: 5,
  flags,
  markFilteringSet,
  subTables: [
    {
      version: 3,
      coverages: [cov(1), cov(10)],
      lookupRecords: [{ sequenceIndex: 0, lookupListIndex: 0 }],
    },
  ],
});

const run = (lookup: any, glyphs: any[], gdef?: any) => {
  const p = gdef === undefined ? processor([single]) : processor([single], gdef);
  p.applyLookups([{ feature: 'test', index: 0, lookup }], glyphs);
  return glyphs.map((g) => g.id);
};

const filtered = { flags: { useMarkFilteringSet: true } };

describe('mark filtering sets', () => {
  it('skips marks outside the set and sees marks inside it', () => {
    expect(run(context(filtered, 0), [base(1), mark(11), mark(10)])).toEqual([99, 11, 10]);
    expect(run(context({}), [base(1), mark(11), mark(10)])).toEqual([1, 11, 10]);
  });

  it('takes precedence over the mark attachment class', () => {
    const both = { markAttachmentType: 3, flags: { useMarkFilteringSet: true } };
    expect(run(context(both, 0), [base(1), mark(11, 3), mark(10, 5)])).toEqual([99, 11, 10]);
  });

  it('is overridden by ignoreMarks', () => {
    const lookup = context({ flags: { useMarkFilteringSet: true, ignoreMarks: true } }, 0);
    expect(run(lookup, [base(1), mark(10)])).toEqual([1, 10]);
  });

  it('treats a set it cannot find as empty', () => {
    expect(run(context(filtered, 5), [base(1), mark(10)])).toEqual([1, 10]);
    expect(run(context(filtered, 0), [base(1), mark(10)], {})).toEqual([1, 10]);
    // An empty set skips marks only; the base still matches.
    const solo = { ...single, flags: filtered, markFilteringSet: 5 };
    expect(run(solo, [base(1), mark(1)])).toEqual([99, 1]);
  });

  it('restores the outer lookup filter after a nested lookup', () => {
    const p = processor([single]);
    const outer = context(filtered, 0);
    p.applyLookups([{ feature: 'test', index: 0, lookup: outer }], [base(1), mark(10)]);
    expect(p.glyphIterator.markFilter?.(10)).toBe(true);
    expect(p.glyphIterator.markFilter?.(11)).toBe(false);
  });
});
