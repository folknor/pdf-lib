// Contextual lookup records address the rule's input sequence as matched and
// as earlier records edited it, never a re-walk of the buffer; a forward pass
// resumes after what an application consumed.
import GSUBProcessor from '../../src/fontkit/opentype/GSUBProcessor.js';

const cov = (...glyphs: number[]) => ({ version: 1, glyphs });
const glyph = (id: number, isMark = false) => ({
  id,
  features: { test: true },
  isMark,
  isBase: !isMark,
  codePoints: [id],
  text: [id],
  cluster: id,
  components: 1,
});

const processor = (lookups: any[]) => {
  const p = Object.create(GSUBProcessor.prototype);
  p.table = { lookupList: { get: (i: number) => lookups[i] } };
  p.font = { GDEF: { markGlyphSetsDef: { coverage: [cov(10)] } } };
  p.ligatureID = 1;
  return p;
};

const run = (lookups: any[], glyphs: any[]) => {
  processor(lookups).applyLookups([{ features: ['test'], index: 0, lookup: lookups[0] }], glyphs);
  return glyphs.map((g) => g.id);
};

const singles = (from: number[], to: number[], flags: any = {}) => ({
  lookupType: 1,
  flags,
  subTables: [{ version: 2, coverage: cov(...from), substitute: { get: (i: number) => to[i] } }],
});
const context = (flags: any, coverages: number[][], records: number[][], markFilteringSet?: number) => ({
  lookupType: 5,
  flags,
  markFilteringSet,
  subTables: [
    {
      version: 3,
      coverages: coverages.map((c) => cov(...c)),
      lookupRecords: records.map(([sequenceIndex, lookupListIndex]) => ({ sequenceIndex, lookupListIndex })),
    },
  ],
});

describe('contextual lookup records', () => {
  it('keep a member the outer rules would now skip', () => {
    // The outer lookup sees only mark 10; record 1 turns it into mark 12.
    const outer = context({ flags: { useMarkFilteringSet: true } }, [[1], [10], [2]], [[1, 1], [2, 1]], 0);
    const glyphs = [glyph(1), glyph(10, true), glyph(2)];
    expect(run([outer, singles([10, 2], [12, 99])], glyphs)).toEqual([1, 12, 99]);
  });

  it('count glyphs a multiple substitution inserted for a member', () => {
    const multiple = { lookupType: 2, flags: {}, subTables: [{ coverage: cov(1), sequences: { get: () => [5, 6] } }] };
    const outer = context({}, [[1], [2]], [[0, 1], [2, 2]]);
    expect(run([outer, multiple, singles([2], [99])], [glyph(1), glyph(2)])).toEqual([5, 6, 99]);
  });

  it('drop members a nested ligature consumed', () => {
    const ligature = {
      lookupType: 4,
      flags: { flags: { ignoreMarks: true } },
      subTables: [{ coverage: cov(1), ligatureSets: { get: () => [{ glyph: 50, components: [2] }] } }],
    };
    const outer = context({ flags: { ignoreMarks: true } }, [[1], [2], [3]], [[0, 1], [1, 2]]);
    const glyphs = [glyph(1), glyph(10, true), glyph(2), glyph(3)];
    expect(run([outer, ligature, singles([3], [99])], glyphs)).toEqual([50, 10, 99]);
  });

  it('skip a record past the end of the sequence', () => {
    const outer = context({}, [[1]], [[3, 1], [0, 1]]);
    expect(run([outer, singles([1], [99])], [glyph(1)])).toEqual([99]);
  });
});

describe('lookup pass resumption', () => {
  it('resumes after a context input sequence', () => {
    const outer = context({}, [[1], [1]], [[0, 1]]);
    expect(run([outer, singles([1], [99])], [glyph(1), glyph(1), glyph(1)])).toEqual([99, 1, 1]);
  });

  it('does not revisit glyphs a multiple substitution inserted', () => {
    const multiple = { lookupType: 2, flags: {}, subTables: [{ coverage: cov(1), sequences: { get: () => [2, 1] } }] };
    expect(run([multiple], [glyph(1)])).toEqual([2, 1]);
  });

  it('visits the glyph that slid into a deleted one', () => {
    const multiple = { lookupType: 2, flags: {}, subTables: [{ coverage: cov(1), sequences: { get: () => [] } }] };
    expect(run([multiple], [glyph(1), glyph(1), glyph(3)])).toEqual([3]);
  });
});
