import fs from 'fs';

import fontkit from 'src/fontkit.js';
import BBox from '../../src/fontkit/glyph/BBox';
import CBDTGlyph from '../../src/fontkit/glyph/CBDTGlyph';
import COLRGlyph from '../../src/fontkit/glyph/COLRGlyph';
import TTFGlyph from '../../src/fontkit/glyph/TTFGlyph';
import GPOSProcessor from '../../src/fontkit/opentype/GPOSProcessor';

const ubuntuBytes = fs.readFileSync('./assets/fonts/ubuntu/Ubuntu-R.ttf');
const openUbuntu = () => fontkit.create(new Uint8Array(ubuntuBytes));

const firstCompositeGlyph = (font: any) => {
  for (let id = 0; id < font.numGlyphs; id++) {
    const decoded = font.getGlyph(id)._decode();
    if (decoded && decoded.numberOfContours < 0) return { id, decoded };
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

  it('keeps outline glyphs for fonts with embedded bitmaps next to glyf', () => {
    const font = openUbuntu();
    font.directory.tables = { ...font.directory.tables, EBLC: {} };
    expect(font.getGlyph(36)).toBeInstanceOf(TTFGlyph);
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
