// Fixes ported from cantoo-scribe/fontkit 65cbbca6 ("bugs the type checker
// surfaced") plus the chaining-context backtrack order.
import CmapProcessor from "../../src/fontkit/CmapProcessor";
import COLRGlyph from "../../src/fontkit/glyph/COLRGlyph";
import GlyphVariationProcessor from "../../src/fontkit/glyph/GlyphVariationProcessor";
import OTProcessor from "../../src/fontkit/opentype/OTProcessor";
import { DecodeStream } from "../../src/vendors/restructure/index.js";

describe("gvar packed point numbers", () => {
  it("reads word-sized point runs big-endian", () => {
    // 3 points; one run of 3 words (0x80 | 2): deltas 0x0100, 1, 2.
    const bytes = new Uint8Array([3, 0x82, 0x01, 0x00, 0x00, 0x01, 0x00, 0x02]);
    const fake = { font: { stream: new DecodeStream(bytes) } };

    const points = GlyphVariationProcessor.prototype.decodePoints.call(fake as any);

    expect(Array.from(points)).toEqual([256, 257, 259]);
  });
});

describe("OpenType context lookups", () => {
  it("treats a NULL ClassDef as class 0", () => {
    expect(OTProcessor.prototype.getClassID.call({} as any, 7, null)).toBe(0);
  });

  it("returns false for a missing context rule set instead of throwing", () => {
    const fake: any = {
      coverageIndex: () => 0,
      getClassID: () => 1,
      glyphIterator: { cur: { id: 1 } },
    };

    const apply = OTProcessor.prototype.applyContext;
    expect(apply.call(fake, { version: 1, ruleSets: [null] })).toBe(false);
    expect(apply.call(fake, { version: 2, classSet: [] })).toBe(false);
    const chain = OTProcessor.prototype.applyChainingContext;
    expect(chain.call(fake, { version: 1, chainRuleSets: [null] })).toBe(false);
  });

  it("matches chaining backtrack sequences closest glyph first", () => {
    const calls: any[][] = [];

    const fake: any = {
      coverageSequenceMatches: (index: number, seq: any[]) => {
        calls.push([index, seq]);

        return true;
      },
      applyLookupList: () => true,
    };

    const backtrackCoverage = ["closest", "middle", "furthest"];
    OTProcessor.prototype.applyChainingContext.call(fake, {
      version: 3,
      backtrackGlyphCount: 3,
      backtrackCoverage,
      inputCoverage: [],
      inputGlyphCount: 1,
      lookaheadCoverage: [],
    });
    expect(calls[0]).toEqual([-3, ["furthest", "middle", "closest"]]);
    // The decoded table is shared and must not be mutated.
    expect(backtrackCoverage).toEqual(["closest", "middle", "furthest"]);
  });
});

describe("cmap subtables", () => {
  const lazy = (values: number[]) => ({
    length: values.length,
    get: (i: number) => values[i],
    toArray: () => values,
  });

  it.each([0, 2])("reverse-maps wrapping format 4 deltas with range offset %i", (rangeOffset) => {
    const cmap = new CmapProcessor({
      tables: [
        {
          platformID: 3,
          encodingID: 1,
          table: {
            version: 4,
            segCount: 1,
            startCode: lazy([0xfffe]),
            endCode: lazy([0xffff]),
            idDelta: lazy([3]),
            idRangeOffset: lazy([rangeOffset]),
            glyphIndexArray: lazy([0xfffe, 0]),
          },
        },
      ],
    });

    expect(cmap.lookup(0xfffe)).toBe(1);
    expect(cmap.codePointsForGlyph(1)).toEqual([0xfffe]);
    expect(cmap.lookup(0xffff)).toBe(rangeOffset === 0 ? 2 : 0);
    expect(cmap.codePointsForGlyph(rangeOffset === 0 ? 2 : 0)).toEqual([0xffff]);
  });

  it("skips unreadable formats and reverse-maps format 10", () => {
    const cmap = new CmapProcessor({
      tables: [
        { platformID: 3, encodingID: 10, table: { version: 2 } },
        {
          platformID: 0,
          encodingID: 4,
          table: { version: 10, firstCode: 0x41, glyphIndices: lazy([5, 6, 5]) },
        },
      ],
    });

    expect(cmap.lookup(0x42)).toBe(6);
    expect(cmap.codePointsForGlyph(5)).toEqual([0x41, 0x43]);
  });

  it("keeps the format 14 variation-selector subtable", () => {
    const uvs = { version: 14, varSelectors: lazy([]) };

    const cmap = new CmapProcessor({
      tables: [
        {
          platformID: 3,
          encodingID: 1,
          table: { version: 6, firstCode: 0, glyphIndices: lazy([1]) },
        },
        { platformID: 0, encodingID: 5, table: uvs },
      ],
    });

    expect(cmap.uvs).toBe(uvs);
    expect(cmap.codePointsForGlyph(1)).toEqual([0]);
  });
});

describe("COLR layer colours", () => {
  const red = { red: 255, green: 0, blue: 0, alpha: 255 };
  const blue = { red: 0, green: 0, blue: 255, alpha: 255 };

  const makeFont = (rendered: string[]) => ({
    COLR: {
      baseGlyphRecord: [{ gid: 1, firstLayerIndex: 0, numLayers: 3 }],
      layerRecords: [
        { gid: 10, paletteIndex: 0 },
        { gid: 11, paletteIndex: 0xffff },
        { gid: 12, paletteIndex: 9 },
      ],
    },
    CPAL: { colorRecordIndices: [1], colorRecords: [red, blue] },
    _getBaseGlyph: (gid: number) => ({
      render: (ctx: any) => rendered.push(`${gid}:${ctx.color}`),
    }),
  });

  it("offsets by the palette base, keeps foreground layers, drops bad indices", () => {
    const layers = new COLRGlyph(1, makeFont([])).layers!;
    expect(layers.map((l) => l.color)).toEqual([blue, null]);
  });

  it("draws foreground layers in the caller colour", () => {
    const rendered: string[] = [];
    const stack: string[] = [];

    const ctx: any = {
      color: "caller",
      save() {
        stack.push(this.color);
      },
      restore() {
        this.color = stack.pop();
      },
      fillColor(rgb: number[]) {
        this.color = rgb.join(",");
      },
    };

    new COLRGlyph(1, makeFont(rendered)).render(ctx, 12);
    expect(rendered).toEqual(["10:0,0,255", "11:caller"]);
    expect(ctx.color).toBe("caller");
  });
});
