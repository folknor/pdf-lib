import { toTrueTypeOutline } from '../glyph/quadraticOutline.js';
import TTFGlyphEncoder from '../glyph/TTFGlyphEncoder.js';
import { encodeSfnt } from '../tables/directory.js';
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
      this._fromCFF2 ||
      !!this.font.directory.tables.glyf?.transformed ||
      !!this.font._variationProcessor
    );
  }

  // A CFF2 font becomes a TrueType subset. CFF v1 is the other format PDF
  // embeds, but its charstrings fill even-odd, while CFF2 fills nonzero and
  // variable outlines overlap routinely, so a CFF v1 copy would need overlap
  // removal (a cubic Boolean union). glyf fills nonzero, so each instanced
  // outline converts with its overlaps intact: cubics become quadratics within
  // _cff2Tolerance and contours are reversed (quadraticOutline.ts). Hints are
  // not carried over.
  get _fromCFF2(): boolean {
    const tables = this.font.directory.tables;
    return !!tables.CFF2 && !tables.glyf;
  }

  // Half a unit at 1000 units per em, before rounding to the integer grid.
  get _cff2Tolerance(): number {
    return this.font.unitsPerEm / 2000;
  }

  // A bitmap-only (CBDT/EBDT) font has no glyf, loca, or CFF to copy from.
  // Its subset is a TrueType font whose glyphs are all empty but keep their
  // hmtx metrics: PDF renders TrueType from glyf, so the bitmaps are not
  // drawn either way, the same as embedding the whole font.
  get _outlineless(): boolean {
    const tables = this.font.directory.tables;
    return !tables.glyf && !tables['CFF '] && !tables.CFF2;
  }

  _addGlyph(gid: number): number {
    if (this._outlineless) {
      const glyph = this.font.getGlyph(gid);
      // Only CBDT stubs get metrics without outline tables; an sbix glyph
      // reads its bounding box from glyf.
      if (glyph?.type !== 'CBDT') {
        throw new Error(
          'Cannot subset a font with neither outlines nor CBDT/EBDT bitmaps',
        );
      }
      this._pushGlyph(glyph, new Uint8Array(0));
      return this.glyf.length - 1;
    }

    // getGlyph() returns a COLR wrapper in color fonts; the outline glyph is
    // what goes into glyf.
    const glyph = this.font._getBaseGlyph(gid) ?? this.font.getGlyph(gid);

    if (this._fromCFF2) {
      const outline = toTrueTypeOutline(glyph.path, this._cff2Tolerance);
      const buffer =
        outline.commands.length > 0
          ? this.glyphEncoder.encodeSimple(outline, { overlapping: true })
          : new Uint8Array(0);
      this._pushGlyph(glyph, buffer, TTFSubset._encodedXMin(buffer));
      return this.glyf.length - 1;
    }

    const glyf = glyph._decode();

    let buffer: Uint8Array;
    if (this._flattenGlyphs) {
      // Composite glyphs are flattened into simple ones, so their components
      // need not be included. Hinting instructions are not preserved.
      buffer =
        glyf.numberOfContours !== 0
          ? this.glyphEncoder.encodeSimple(glyph.path)
          : new Uint8Array(0);
      // The path is placed relative to the glyph's left origin (varied or
      // not), so its bearing is the written xMin: the rounded left bearing,
      // or for a static WOFF2 glyph whose hmtx lsb differs from its xMin,
      // the source lsb that FreeType would have placed it by.
      this._pushGlyph(glyph, buffer, TTFSubset._encodedXMin(buffer));
      return this.glyf.length - 1;
    }

    // get the offset to the glyph from the loca table
    const curOffset = this.font.loca.offsets[gid];
    const nextOffset = this.font.loca.offsets[gid + 1];

    const stream = this.font._getTableStream('glyf');
    stream.pos += curOffset;

    buffer = stream.readBuffer(nextOffset - curOffset);

    // if it is a compound glyph, include its components
    if (glyf.numberOfContours < 0) {
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

  /**
   * Re-encoded glyphs (instanced, converted, rounded) no longer have the
   * source font's extents, so head's bounding box and hhea's extremes are
   * recomputed from the glyf headers and hmtx entries actually written.
   */
  _updateExtents(head: any, hhea: any): void {
    let xMin = Infinity;
    let yMin = Infinity;
    let xMax = -Infinity;
    let yMax = -Infinity;
    let advanceWidthMax = 0;
    let minLeftSideBearing = Infinity;
    let minRightSideBearing = Infinity;
    let xMaxExtent = -Infinity;
    this.glyf.forEach((buffer, i) => {
      const { advance, bearing } = this.hmtx.metrics[i]!;
      advanceWidthMax = Math.max(advanceWidthMax, advance);
      if (buffer.length < 10) return;
      const view = new DataView(buffer.buffer, buffer.byteOffset, 10);
      const gxMin = view.getInt16(2);
      const gxMax = view.getInt16(6);
      xMin = Math.min(xMin, gxMin);
      yMin = Math.min(yMin, view.getInt16(4));
      xMax = Math.max(xMax, gxMax);
      yMax = Math.max(yMax, view.getInt16(8));
      minLeftSideBearing = Math.min(minLeftSideBearing, bearing);
      minRightSideBearing = Math.min(
        minRightSideBearing,
        advance - (bearing + gxMax - gxMin),
      );
      xMaxExtent = Math.max(xMaxExtent, bearing + gxMax - gxMin);
    });
    const any = xMin !== Infinity;
    head.xMin = any ? xMin : 0;
    head.yMin = any ? yMin : 0;
    head.xMax = any ? xMax : 0;
    head.yMax = any ? yMax : 0;
    hhea.advanceWidthMax = advanceWidthMax;
    hhea.minLeftSideBearing = any ? minLeftSideBearing : 0;
    hhea.minRightSideBearing = any ? minRightSideBearing : 0;
    hhea.xMaxExtent = any ? xMaxExtent : 0;
    for (const key of [
      'minLeftSideBearing',
      'minRightSideBearing',
      'xMaxExtent',
    ] as const) {
      if (hhea[key] < -32768 || hhea[key] > 32767) {
        throw new Error(`hhea ${key} ${hhea[key]} does not fit an int16`);
      }
    }
  }

  // A TrueType font needs a version 1.0 maxp; a bitmap-only source may carry
  // version 0.5, and its outline limits are all zero anyway.
  static _emptyMaxp(numGlyphs: number): any {
    return {
      version: 0x00010000,
      numGlyphs,
      maxPoints: 0,
      maxContours: 0,
      maxComponentPoints: 0,
      maxComponentContours: 0,
      maxZones: 1,
      maxTwilightPoints: 0,
      maxStorage: 0,
      maxFunctionDefs: 0,
      maxInstructionDefs: 0,
      maxStackElements: 0,
      maxSizeOfInstructions: 0,
      maxComponentElements: 0,
      maxComponentDepth: 0,
    };
  }

  // For instanced or converted outlines the hmtx left side bearing is the
  // encoded glyph's own xMin (zero for an empty glyph), so the left phantom
  // point is at zero: a renderer that translates the outline by it (FreeType)
  // and one that draws glyf coordinates as they are (pdf.js) place the glyph
  // identically. Reading it back from the header takes the encoder's
  // rounding and all written points, off-curve ones included. This also
  // keeps a cloned head.flags bit 1 (lsb equals xMin) true.
  static _encodedXMin(buffer: Uint8Array): number {
    return buffer.length > 0
      ? new DataView(buffer.buffer, buffer.byteOffset).getInt16(2)
      : 0;
  }

  _pushGlyph(
    glyph: any,
    buffer: Uint8Array,
    bearing: number = glyph._getMetrics().leftBearing,
  ): void {
    this.glyf.push(buffer);
    this.loca.offsets.push(this.offset);

    // hmtx holds integers; a varied (HVAR or phantom point) advance can be
    // fractional, and the serializer would truncate it.
    const advance = Math.round(glyph.advanceWidth);
    if (advance < 0 || advance > 0xffff) {
      throw new Error(`Glyph advance ${advance} does not fit hmtx`);
    }
    const lsb = Math.round(bearing);
    if (lsb < -32768 || lsb > 32767) {
      throw new Error(`Glyph left side bearing ${lsb} does not fit hmtx`);
    }
    this.hmtx.metrics.push({ advance, bearing: lsb });

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
      // Outlineless subsets have no loca to follow; every offset is 0.
      version: this._outlineless
        ? 0
        : this._flattenGlyphs
          ? 1
          : this.font.loca.version,
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

    const outlineless = this._outlineless;
    // Neither a bitmap-only nor a CFF2 font has a TrueType maxp to clone
    // (CFF fonts carry version 0.5).
    const maxp =
      outlineless || this._fromCFF2
        ? TTFSubset._emptyMaxp(this.glyf.length)
        : structuredClone(this.font.maxp);
    maxp.numGlyphs = this.glyf.length;
    if (this._flattenGlyphs) this._updateMaxpForFlattenedGlyphs(maxp);

    this.loca.offsets.push(this.offset);

    const head = structuredClone(this.font.head);
    head.indexToLocFormat = this.loca.version;

    const hhea = structuredClone(this.font.hhea);
    hhea.numberOfMetrics = this.hmtx.metrics.length;

    // Before the padding below, which is not a glyph entry.
    if (this._flattenGlyphs) this._updateExtents(head, hhea);

    // A zero-length glyf table is rejected by some consumers (OTS pads it
    // the same way); loca still marks every glyph empty.
    if (this.offset === 0) this.glyf.push(new Uint8Array(1));

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
    return encodeSfnt({
      head,
      hhea,
      loca: this.loca,
      maxp,
      // The synthesized maxp declares no instruction resources, so no
      // programs go with it.
      'cvt ': outlineless ? undefined : this.font['cvt '],
      prep: outlineless ? undefined : this.font.prep,
      glyf: this.glyf,
      hmtx: this.hmtx,
      fpgm: outlineless ? undefined : this.font.fpgm,

      // name: clone @font.name
      // 'OS/2': clone @font['OS/2']
      // post: clone @font.post
      // cmap: cmap
    });
  }
}
