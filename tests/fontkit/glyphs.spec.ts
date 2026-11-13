import fs from 'fs';

import fontkit from 'src/fontkit.js';
import BBox from '../../src/fontkit/glyph/BBox';
import CBDTGlyph from '../../src/fontkit/glyph/CBDTGlyph';
import COLRGlyph from '../../src/fontkit/glyph/COLRGlyph';
import Path from '../../src/fontkit/glyph/Path';
import TTFGlyph from '../../src/fontkit/glyph/TTFGlyph';
import GPOSProcessor from '../../src/fontkit/opentype/GPOSProcessor';

const ubuntuBytes = fs.readFileSync('./assets/fonts/ubuntu/Ubuntu-R.ttf');
const openUbuntu = () => fontkit.create(new Uint8Array(ubuntuBytes));

const firstCompositeGlyph = (font: any) => {
  for (let id = 0; id < font.numGlyphs; id++) {
    const decoded = font.getGlyph(id)._decode();
    if (decoded.numberOfContours < 0) return { id, decoded };
  }
  throw new Error('no composite glyph in test font');
};

describe('color and bitmap glyphs', () => {
  it('_getBaseGlyph returns the outline glyph but keeps a cached COLR glyph', () => {
    const font = openUbuntu();
    const colr = new COLRGlyph(36, [], font);
    font._glyphs[36] = colr;

    const base = font._getBaseGlyph(36);
    expect(base).toBeInstanceOf(TTFGlyph);
    expect(font._glyphs[36]).toBe(colr);
    // Outline glyphs already in the cache are reused.
    expect(font._getBaseGlyph(37)).toBe(font._getBaseGlyph(37));
  });

  it('resolves composite components through their outline glyphs', () => {
    const reference = openUbuntu();
    const { id, decoded } = firstCompositeGlyph(reference);
    const expected = reference.getGlyph(id).path.toSVG();

    const font = openUbuntu();
    for (const component of decoded.components) {
      font._glyphs[component.glyphID] = new COLRGlyph(
        component.glyphID,
        [],
        font,
      );
    }
    expect(font.getGlyph(id).path.toSVG()).toBe(expected);
  });

  it('returns null layers and a fallback bbox for COLR v1 glyphs', () => {
    const fakeFont = {
      COLR: { version: 1 },
      CPAL: {},
      _getBaseGlyph: () => null,
    };
    const glyph = new COLRGlyph(1, [], fakeFont);
    expect(glyph.layers).toBeNull();
    expect(glyph.bbox).toEqual(new BBox(0, 0, 0, 0));
    expect(() => glyph.render({ fillColor: () => {} }, 12)).not.toThrow();
  });

  it('gives COLR glyphs the geometry of their base outline', () => {
    const font = openUbuntu();
    const base = font._getBaseGlyph(36);
    const colr = new COLRGlyph(36, [], font);
    expect(colr.path.toSVG()).toBe(base.path.toSVG());
    expect(colr.path.commands.length).toBeGreaterThan(0);
    expect(colr.cbox).toEqual(base.cbox);
    expect(colr.bbox).toEqual(base.bbox);

    const empty = new COLRGlyph(1, [], { _getBaseGlyph: () => null });
    expect(empty.path.commands).toEqual([]);
    expect(empty.cbox).toEqual(new BBox(0, 0, 0, 0));
  });

  it('keeps CFF subroutines when subsetting a COLR font', () => {
    const bytes = fs.readFileSync(
      './assets/fonts/source_hans_jp/SourceHanSerifJP-Regular.otf',
    );
    const encodeSubset = (colour: boolean) => {
      const font = fontkit.create(new Uint8Array(bytes)) as any;
      if (colour) {
        font.directory.tables = {
          ...font.directory.tables,
          COLR: {},
          CPAL: {},
        };
        Object.defineProperty(font, 'COLR', { value: { version: 1 } });
        Object.defineProperty(font, 'CPAL', { value: {} });
        expect(font.getGlyph(1000)).toBeInstanceOf(COLRGlyph);
      }
      const subset = font.createSubset();
      for (const gid of [1000, 2000, 3000]) subset.includeGlyph(gid);
      return subset.encode();
    };
    expect(encodeSubset(true)).toEqual(encodeSubset(false));
  });

  it('renders the outline of COLR v1 glyphs', () => {
    const font = openUbuntu();
    font.directory.tables = { ...font.directory.tables, COLR: {}, CPAL: {} };
    Object.defineProperty(font, 'COLR', { value: { version: 1 } });
    Object.defineProperty(font, 'CPAL', { value: {} });

    const glyph = font.getGlyph(36);
    expect(glyph).toBeInstanceOf(COLRGlyph);
    expect(glyph.layers).toBeNull();

    const calls: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get: (_target, name) => (..._args: unknown[]) => {
          calls.push(String(name));
        },
      },
    );
    glyph.render(ctx, 12);
    expect(calls).toContain('moveTo');
    expect(calls).toContain('fill');
  });

  it('creates stub CBDT glyphs for bitmap-only fonts', () => {
    const font = openUbuntu();
    const { glyf: _glyf, ...tables } = font.directory.tables;
    font.directory.tables = { ...tables, CBLC: {} };

    const glyph = font.getGlyph(36);
    expect(glyph).toBeInstanceOf(CBDTGlyph);
    expect(glyph.advanceWidth).toBeGreaterThan(0);
    expect(glyph.path.commands).toEqual([]);
  });

  it('subsets bitmap-only fonts into empty glyphs with their metrics', () => {
    const font = openUbuntu();
    const { glyf: _glyf, loca: _loca, ...tables } = font.directory.tables;
    font.directory.tables = { ...tables, CBLC: {} };
    const widths = [36, 37].map((id) => font.getGlyph(id).advanceWidth);

    const subset = font.createSubset();
    subset.includeGlyph(36);
    subset.includeGlyph(37);
    const out = fontkit.create(subset.encode()) as any;

    expect(out.numGlyphs).toBe(3);
    expect(out.maxp.version).toBe(0x00010000);
    expect(out.maxp.maxZones).toBe(1);
    expect(out.loca.offsets).toEqual([0, 0, 0, 0]);
    expect(out.directory.tables.glyf.length).toBeGreaterThan(0);
    expect(out.directory.tables.fpgm).toBeUndefined();
    expect([1, 2].map((id) => out.getGlyph(id).advanceWidth)).toEqual(widths);
    expect(out.getGlyph(1).path.commands).toEqual([]);
  });

  it('reads back a one-glyph bitmap-only subset', () => {
    const font = openUbuntu();
    const { glyf: _glyf, loca: _loca, ...tables } = font.directory.tables;
    font.directory.tables = { ...tables, CBLC: {} };
    const out = fontkit.create(font.createSubset().encode()) as any;
    const glyph = out.getGlyph(0);
    expect(glyph.advanceWidth).toBe(font.getGlyph(0).advanceWidth);
    expect(glyph.cbox).toEqual(new BBox(0, 0, 0, 0));
  });

  it('reads a version 0.5 maxp as numGlyphs only', () => {
    const otf = fontkit.create(
      new Uint8Array(
        fs.readFileSync('./assets/fonts/source_hans_jp/SourceHanSerifJP-Regular.otf'),
      ),
    ) as any;
    expect(otf.maxp.version).toBe(0x00005000);
    expect(Object.keys(otf.maxp)).not.toContain('maxPoints');
    expect(otf.numGlyphs).toBeGreaterThan(0);
  });

  it('gives empty CFF glyphs a zero cbox and finite metrics', () => {
    const otf = fontkit.create(
      new Uint8Array(
        fs.readFileSync('./assets/fonts/source_hans_jp/SourceHanSerifJP-Regular.otf'),
      ),
    ) as any;
    const space = otf.glyphForCodePoint(0x20);
    expect(space.path.commands).toHaveLength(0);
    expect(space.cbox).toEqual(new BBox(0, 0, 0, 0));
    expect(Number.isFinite(space._getMetrics().topBearing)).toBe(true);
    // bbox keeps the empty sentinel so runs leave spaces out of their bounds.
    expect(space.bbox.minX).toBe(Infinity);
  });

  it('keeps cbox points of move-only paths and zeroes point-free ones', () => {
    const empty = new Path();
    empty.closePath();
    expect(empty.cbox).toEqual(new BBox(0, 0, 0, 0));
    const moved = new Path();
    moved.moveTo(12, 34);
    expect(moved.cbox).toEqual(new BBox(12, 34, 12, 34));
  });

  it('refuses to subset an sbix font without outlines', () => {
    const font = openUbuntu();
    const { glyf: _glyf, ...tables } = font.directory.tables;
    font.directory.tables = { ...tables, sbix: {} };
    const subset = font.createSubset();
    subset.includeGlyph(36);
    expect(() => subset.encode()).toThrow(/neither outlines nor CBDT/);
  });

  it('keeps outline glyphs for fonts with embedded bitmaps next to glyf', () => {
    const font = openUbuntu();
    font.directory.tables = { ...font.directory.tables, EBLC: {} };
    expect(font.getGlyph(36)).toBeInstanceOf(TTFGlyph);
  });
});

describe('composite variation metrics', () => {
  // No variable fixture has a USE_MY_METRICS composite, so a stand-in
  // variation processor varies Ubuntu: it moves only the given glyph's
  // phantom points, +50 on the right origin and -30 on the bottom origin.
  const varyPhantomsOf = (font: any, gid: number) => {
    Object.defineProperty(font, '_variationProcessor', {
      value: {
        transformPoints: (id: number, points: any[]) => {
          if (id !== gid) return;
          points[points.length - 3].x += 50;
          points[points.length - 1].y -= 30;
        },
      },
    });
  };

  const flaggedComposite = (font: any) => {
    for (let id = 0; id < font.numGlyphs; id++) {
      const decoded = font.getGlyph(id)._decode();
      if (decoded.numberOfContours >= 0) continue;
      const flagged = decoded.components.filter((c: any) => c.useMyMetrics);
      if (flagged.length !== 1) continue;
      // An unflagged component that is a different glyph from the flagged one.
      const other = decoded.components.find(
        (c: any) => c.glyphID !== flagged[0].glyphID,
      );
      if (other) return { id, flagged: flagged[0].glyphID, other: other.glyphID };
    }
    throw new Error('no USE_MY_METRICS composite in test font');
  };

  it('takes the USE_MY_METRICS component phantom points', () => {
    const { id, flagged } = flaggedComposite(openUbuntu());
    const unvaried = openUbuntu().getGlyph(id);

    const font: any = openUbuntu();
    varyPhantomsOf(font, flagged);
    const glyph = font.getGlyph(id);
    expect(glyph.advanceWidth).toBe(unvaried.advanceWidth + 50);
    expect(glyph.advanceHeight).toBe(unvaried.advanceHeight + 30);
  });

  it("ignores the composite's own and unflagged components' phantom points", () => {
    const { id, other } = flaggedComposite(openUbuntu());
    const unvaried = openUbuntu().getGlyph(id);

    for (const gid of [id, other]) {
      const font: any = openUbuntu();
      varyPhantomsOf(font, gid);
      const glyph = font.getGlyph(id);
      expect(glyph.advanceWidth).toBe(unvaried.advanceWidth);
      expect(glyph.advanceHeight).toBe(unvaried.advanceHeight);
    }
  });
});

describe('GPOSProcessor.applyAnchor', () => {
  const makeProcessor = () => {
    const processor = Object.create(GPOSProcessor.prototype);
    processor.font = {};
    processor.positions = [
      { xOffset: 0, yOffset: 0 },
      { xOffset: 0, yOffset: 0 },
    ];
    processor.glyphIterator = { index: 1, cur: {} };
    return processor as GPOSProcessor & { positions: any[]; glyphIterator: any };
  };
  const anchor = (x: number, y: number) => ({ xCoordinate: x, yCoordinate: y });

  it('skips marks whose base anchor is NULL', () => {
    const processor = makeProcessor();
    const applied = processor.applyAnchor(
      { markAnchor: anchor(1, 2) },
      null,
      0,
    );
    expect(applied).toBe(false);
    expect(processor.positions[1]).toEqual({ xOffset: 0, yOffset: 0 });
    expect(processor.glyphIterator.cur.markAttachment).toBeUndefined();
  });

  it('skips marks whose mark anchor is NULL', () => {
    const processor = makeProcessor();
    expect(
      processor.applyAnchor({ markAnchor: null }, anchor(10, 20), 0),
    ).toBe(false);
  });

  it('positions marks when both anchors exist', () => {
    const processor = makeProcessor();
    expect(
      processor.applyAnchor({ markAnchor: anchor(1, 2) }, anchor(10, 20), 0),
    ).toBe(true);
    expect(processor.positions[1]).toEqual({ xOffset: 9, yOffset: 18 });
    expect(processor.glyphIterator.cur.markAttachment).toBe(0);
  });
});
