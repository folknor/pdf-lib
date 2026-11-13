import BBox from './BBox.js';
import Glyph from './Glyph.js';
import Path from './Path.js';

interface COLRColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

/** COLR palette index meaning "the text foreground colour". */
const FOREGROUND_PALETTE_INDEX = 0xffff;

class COLRLayer {
  glyph: Glyph | null;
  /** null: draw in the caller's current (foreground) colour. */
  color: COLRColor | null;

  constructor(glyph: Glyph | null, color: COLRColor | null) {
    this.glyph = glyph;
    this.color = color;
  }
}

/**
 * Represents a color (e.g. emoji) glyph in Microsoft's COLR format.
 * Each glyph in this format contain a list of colored layers, each
 * of which  is another vector glyph.
 */
export default class COLRGlyph extends Glyph {
  type = 'COLR';

  // path, cbox and bbox are the base (glyf/CFF) outline's geometry: that
  // outline is what a PDF embeds and draws for a colour font (TTFSubset and
  // CFFSubset both take it from _getBaseGlyph). The layer artwork drawn by
  // render() can extend beyond these bounds; no geometry API describes it.
  override _getPath(): Path {
    return this._font._getBaseGlyph(this.id)?.path ?? new Path();
  }

  override _getCBox(): BBox {
    return this._font._getBaseGlyph(this.id)?.cbox ?? new BBox(0, 0, 0, 0);
  }

  override _getBBox(): BBox {
    return this._font._getBaseGlyph(this.id)?.bbox ?? new BBox(0, 0, 0, 0);
  }

  /**
   * Returns an array of objects containing the glyph and color for
   * each layer in the composite color glyph, or null for COLR v1 fonts,
   * whose paint graphs have no v0 base glyph records.
   */
  get layers(): COLRLayer[] | null {
    const cpal = this._font.CPAL;
    const colr = this._font.COLR;
    if (!colr?.baseGlyphRecord) {
      return null;
    }

    let low = 0;
    let high = colr.baseGlyphRecord.length - 1;
    let baseLayer = null;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const rec = colr.baseGlyphRecord[mid];

      if (this.id < rec.gid) {
        high = mid - 1;
      } else if (this.id > rec.gid) {
        low = mid + 1;
      } else {
        baseLayer = rec;
        break;
      }
    }

    // if base glyph not found in COLR table,
    // default to normal glyph from glyf or CFF
    if (baseLayer == null) {
      const g = this._font._getBaseGlyph(this.id);
      const color = {
        red: 0,
        green: 0,
        blue: 0,
        alpha: 255,
      };

      return [new COLRLayer(g, color)];
    }

    // otherwise, return an array of all the layers
    const layers = [];
    for (
      let i = baseLayer.firstLayerIndex;
      i < baseLayer.firstLayerIndex + baseLayer.numLayers;
      i++
    ) {
      const rec = colr.layerRecords[i];
      if (!rec) continue;
      let color: COLRColor | null = null;
      if (rec.paletteIndex !== FOREGROUND_PALETTE_INDEX) {
        // Palette indices are relative to the palette's first colour record;
        // layers use the default palette (0).
        color =
          cpal?.colorRecords?.[
            (cpal.colorRecordIndices?.[0] ?? 0) + rec.paletteIndex
          ] ?? null;
        // A record outside the colour array is malformed; skip the layer
        // rather than paint it in the foreground colour.
        if (!color) continue;
      }
      const g = this._font._getBaseGlyph(rec.gid);
      layers.push(new COLRLayer(g, color));
    }

    return layers;
  }

  override render(ctx: any, size: number): void {
    const layers = this.layers;
    if (!layers) {
      // COLR v1 paint graphs are not supported; draw the plain outline, as
      // v0 does for glyphs without a base glyph record.
      this._font._getBaseGlyph(this.id)?.render(ctx, size);
      return;
    }

    for (const { glyph, color } of layers) {
      if (!glyph) continue;
      // Each layer restores the caller's state, so a foreground layer after a
      // palette layer draws in the caller's colour, not the previous layer's.
      ctx.save();
      try {
        if (color) {
          ctx.fillColor(
            [color.red, color.green, color.blue],
            (color.alpha / 255) * 100,
          );
        }
        glyph.render(ctx, size);
      } finally {
        ctx.restore();
      }
    }

    return;
  }
}
