// GSUB lookup type 3, alternate substitution, chosen by a numeric feature value.
import fs from 'node:fs';
import fontkit from '../../src/fontkit.js';
import { normalizeFeatures } from '../../src/fontkit/layout/FeatureValues.js';
import GSUBProcessor from '../../src/fontkit/opentype/GSUBProcessor.js';

const cov = (...glyphs: number[]) => ({ version: 1, glyphs });
const glyph = (id: number, features: object = { test: true }) => ({ id, features });
const alternates = (coverage: number[], sets: number[][]) => ({
  coverage: cov(...coverage),
  alternateSet: { get: (i: number) => sets[i] },
});

const run = (lookup: any, glyphs: any[], values: Record<string, number> = {}, lookups: any[] = []) => {
  const p = Object.create(GSUBProcessor.prototype);
  p.table = { lookupList: { get: (i: number) => lookups[i] } };
  p.featureValues = values;
  p.applyLookups([{ feature: 'test', index: 0, lookup }], glyphs);
  return glyphs.map((g) => g.id);
};

describe('GSUB alternate substitution', () => {
  const lookup = { lookupType: 3, flags: {}, subTables: [alternates([1], [[5, 6, 7]])] };

  it('takes the first alternate by default and the Nth for value N', () => {
    expect(run(lookup, [glyph(1)])).toEqual([5]);
    expect(run(lookup, [glyph(1)], { test: 3 })).toEqual([7]);
  });

  it('substitutes nothing past the set, and tries the next subtable', () => {
    expect(run(lookup, [glyph(1)], { test: 4 })).toEqual([1]);
    const two = { lookupType: 3, flags: {}, subTables: [alternates([1], [[5]]), alternates([1], [[8, 9]])] };
    expect(run(two, [glyph(1)], { test: 2 })).toEqual([9]);
  });

  it('leaves a contextual target that lacks the feature alone', () => {
    const lookups = [lookup];
    const context = {
      lookupType: 5,
      flags: {},
      subTables: [
        {
          version: 3,
          coverages: [cov(2), cov(1)],
          lookupRecords: [{ sequenceIndex: 1, lookupListIndex: 0 }],
        },
      ],
    };
    expect(run(context, [glyph(2), glyph(1, {})], {}, lookups)).toEqual([2, 1]);
    expect(run(context, [glyph(2), glyph(1)], {}, lookups)).toEqual([2, 5]);
  });

  it('normalizes requests once', () => {
    expect(normalizeFeatures({ a: true, b: 1, c: 2, d: 0, e: -3, f: 2.5, g: false, h: undefined })).toEqual({
      a: true,
      b: true,
      c: 2,
      d: false,
      e: true,
      f: true,
      g: false,
    });
    expect(normalizeFeatures(['liga'])).toEqual({ liga: true });
  });

  // Nunito's aalt maps 'a' (gid 241) to the alternates 488 then 529.
  describe('with Nunito', () => {
    const font: any = fontkit.create(fs.readFileSync('./assets/fonts/nunito/Nunito-Regular.ttf'));
    const ids = (features: any) => font.layout('a', features).glyphs.map((g: any) => g.id);

    it('selects by value', () => {
      expect(ids({ aalt: true })).toEqual([488]);
      expect(ids({ aalt: 1 })).toEqual([488]);
      expect(ids({ aalt: 2 })).toEqual([529]);
      expect(ids({ aalt: 3 })).toEqual([241]);
      expect(ids({})).toEqual([241]);
    });

    it('reports the value and leaves the caller object alone', () => {
      const request = { aalt: 2 };
      const run = font.layout('a', request);
      expect(run.features.aalt).toBe(2);
      expect(run.features.liga).toBe(true);
      expect(request).toEqual({ aalt: 2 });
    });
  });
});
