import BBox from './BBox.js';
import Glyph from './Glyph.js';

interface COLRColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

class COLRLayer {
  glyph: Glyph | null;
  color: COLRColor;

  constructor(glyph: Glyph | null, color: COLRColor) {
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

  override _getBBox(): BBox {
    const layers = this.layers;
    if (!layers) {
      const g = this._font._getBaseGlyph(this.id);
      return g ? g.bbox : new BBox(0, 0, 0, 0);
    }

    const bbox = new BBox();
    for (const layer of layers) {
      if (!layer.glyph) continue;
      const b = layer.glyph.bbox;
      bbox.addPoint(b.minX, b.minY);
      bbox.addPoint(b.maxX, b.maxY);
    }

    return bbox;
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
      const color = cpal.colorRecords[rec.paletteIndex];
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
      ctx.fillColor(
        [color.red, color.green, color.blue],
        (color.alpha / 255) * 100,
      );
      glyph.render(ctx, size);
    }

    return;
  }
}
