import TTFGlyphEncoder from '../glyph/TTFGlyphEncoder.js';
import Directory from '../tables/directory.js';
import Subset from './Subset.js';

interface LocaTable {
  offsets: number[];
  version: number;
}

interface HmtxTable {
  metrics: { advance: number; bearing: number }[];
  bearings: number[];
}

export default class TTFSubset extends Subset {
  glyphEncoder: TTFGlyphEncoder;
  glyf!: Uint8Array[];
  offset!: number;
  loca!: LocaTable;
  hmtx!: HmtxTable;

  constructor(font: any) {
    super(font);
    this.glyphEncoder = new TTFGlyphEncoder();
  }

  // Glyphs are re-encoded from their decoded path, not copied as raw glyf
  // bytes, when the raw bytes are not the glyph: WOFF2 usually stores
  // glyf/loca in a transformed layout with nothing to copy, and a variation
  // instance's outlines (including composite component offsets moved by gvar)
  // exist only after decoding, while the subset carries no gvar.
  get _flattenGlyphs(): boolean {
    return (
      !!this.font.directory.tables.glyf?.transformed ||
      !!this.font._variationProcessor
    );
  }

  _addGlyph(gid: number): number {
    // getGlyph() returns a COLR wrapper in color fonts; the outline glyph is
    // what goes into glyf.
    const glyph = this.font._getBaseGlyph(gid) ?? this.font.getGlyph(gid);
    const glyf = glyph._decode();

    let buffer: Uint8Array;
    if (this._flattenGlyphs) {
      // Composite glyphs are flattened into simple ones, so their components
      // need not be included. Hinting instructions are not preserved.
      buffer =
        glyf && glyf.numberOfContours !== 0
          ? this.glyphEncoder.encodeSimple(glyph.path)
          : new Uint8Array(0);
      this._pushGlyph(glyph, buffer);
      return this.glyf.length - 1;
    }

    // get the offset to the glyph from the loca table
    const curOffset = this.font.loca.offsets[gid];
    const nextOffset = this.font.loca.offsets[gid + 1];

    const stream = this.font._getTableStream('glyf');
    stream.pos += curOffset;

    buffer = stream.readBuffer(nextOffset - curOffset);

    // if it is a compound glyph, include its components
    if (glyf && glyf.numberOfContours < 0) {
      buffer = new Uint8Array(buffer);
      const view = new DataView(buffer.buffer);
      for (const component of glyf.components) {
        gid = this.includeGlyph(component.glyphID);
        view.setUint16(component.pos, gid);
      }
    }

    this._pushGlyph(glyph, buffer);
    return this.glyf.length - 1;
  }

  /**
   * Re-encoded (flattened) glyphs can have more points and contours than the
   * source's simple glyphs, and contain no composites, so recompute those
   * limits from the encoded glyf data. The instruction-related limits stay:
   * they remain valid upper bounds for the kept fpgm/prep programs, and the
   * glyphs themselves carry no instructions.
   */
  _updateMaxpForFlattenedGlyphs(maxp: any): void {
    let maxPoints = 0;
    let maxContours = 0;
    for (const buffer of this.glyf) {
      if (buffer.length < 10) continue;
      const view = new DataView(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength,
      );
      const contours = view.getInt16(0);
      if (contours <= 0) continue;
      const points = view.getUint16(10 + 2 * (contours - 1)) + 1;
      maxContours = Math.max(maxContours, contours);
      maxPoints = Math.max(maxPoints, points);
    }
    maxp.maxPoints = maxPoints;
    maxp.maxContours = maxContours;
    maxp.maxComponentPoints = 0;
    maxp.maxComponentContours = 0;
    maxp.maxComponentElements = 0;
    maxp.maxComponentDepth = 0;
  }

  _pushGlyph(glyph: any, buffer: Uint8Array): void {
    this.glyf.push(buffer);
    this.loca.offsets.push(this.offset);

    this.hmtx.metrics.push({
      advance: glyph.advanceWidth,
      bearing: glyph._getMetrics().leftBearing,
    });

    this.offset += buffer.length;
  }

  override encode(): Uint8Array {
    // tables required by PDF spec:
    //   head, hhea, loca, maxp, cvt , prep, glyf, hmtx, fpgm
    //
    // additional tables required for standalone fonts:
    //   name, cmap, OS/2, post

    this.glyf = [];
    this.offset = 0;
    this.loca = {
      offsets: [],
      // Flattened glyphs have new sizes (and a transformed WOFF2 loca is
      // empty); long offsets are always valid.
      version: this._flattenGlyphs ? 1 : this.font.loca.version,
    };

    this.hmtx = {
      metrics: [],
      bearings: [],
    };

    // include all the glyphs
    // not using a for loop because we need to support adding more
    // glyphs to the array as we go, and CoffeeScript caches the length.
    let i = 0;
    while (i < this.glyphs.length) {
      this._addGlyph(this.glyphs[i++]!);
    }

    const maxp = structuredClone(this.font.maxp);
    maxp.numGlyphs = this.glyf.length;
    if (this._flattenGlyphs) this._updateMaxpForFlattenedGlyphs(maxp);

    this.loca.offsets.push(this.offset);

    const head = structuredClone(this.font.head);
    head.indexToLocFormat = this.loca.version;

    const hhea = structuredClone(this.font.hhea);
    hhea.numberOfMetrics = this.hmtx.metrics.length;

    // map = []
    // for index in [0...256]
    //     if index < @numGlyphs
    //         map[index] = index
    //     else
    //         map[index] = 0
    //
    // cmapTable =
    //     version: 0
    //     length: 262
    //     language: 0
    //     codeMap: map
    //
    // cmap =
    //     version: 0
    //     numSubtables: 1
    //     tables: [
    //         platformID: 1
    //         encodingID: 0
    //         table: cmapTable
    //     ]

    // TODO: subset prep, cvt, fpgm?
    return Directory.toBuffer({
      tables: {
        head,
        hhea,
        loca: this.loca,
        maxp,
        'cvt ': this.font['cvt '],
        prep: this.font.prep,
        glyf: this.glyf,
        hmtx: this.hmtx,
        fpgm: this.font.fpgm,

        // name: clone @font.name
        // 'OS/2': clone @font['OS/2']
        // post: clone @font.post
        // cmap: cmap
      },
    });
  }
}
