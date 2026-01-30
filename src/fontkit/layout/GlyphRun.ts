import BBox from '../glyph/BBox.js';
import type Glyph from '../glyph/Glyph.js';
import type GlyphPosition from './GlyphPosition.js';
import * as Script from './Script.js';

/**
 * Represents a run of Glyph and GlyphPosition objects.
 * Returned by the font layout method.
 */
export default class GlyphRun {
  /**
   * An array of Glyph objects in the run
   */
  glyphs: Glyph[];

  /**
   * An array of GlyphPosition objects for each glyph in the run
   */
  positions: GlyphPosition[] | null;

  /**
   * The script that was requested for shaping. This was either passed in or detected automatically.
   */
  script: string;

  /**
   * The language requested for shaping, as passed in. If `null`, the default language for the
   * script was used.
   */
  language: string | null;

  /**
   * The direction requested for shaping, as passed in (either ltr or rtl).
   * If `null`, the default direction of the script is used.
   */
  direction: string;

  /**
   * The features requested during shaping. This is a combination of user
   * specified features and features chosen by the shaper.
   */
  features: Record<string, boolean>;

  constructor(
    glyphs: Glyph[],
    features: string[] | Record<string, boolean>,
    script: string,
    language: string | null,
    direction: string | null,
  ) {
    this.glyphs = glyphs;
    this.positions = null;
    this.script = script;
    this.language = language || null;
    this.direction = direction || Script.direction(script);
    this.features = {};

    // Convert features to an object
    if (Array.isArray(features)) {
      for (const tag of features) {
        this.features[tag] = true;
      }
    } else if (typeof features === 'object') {
      this.features = features;
    }
  }

  /**
   * The total advance width of the run.
   */
  get advanceWidth(): number {
    let width = 0;
    for (const position of this.positions ?? []) {
      width += position.xAdvance;
    }

    return width;
  }

  /**
   * The total advance height of the run.
   */
  get advanceHeight(): number {
    let height = 0;
    for (const position of this.positions ?? []) {
      height += position.yAdvance;
    }

    return height;
  }

  /**
   * The bounding box containing all glyphs in the run.
   */
  get bbox(): BBox {
    const bbox = new BBox();

    let x = 0;
    let y = 0;
    const positions = this.positions ?? [];
    for (let index = 0; index < this.glyphs.length; index++) {
      const glyph = this.glyphs[index]!;
      const p = positions[index]!;
      const b = glyph.bbox;

      bbox.addPoint(b.minX + x + p.xOffset, b.minY + y + p.yOffset);
      bbox.addPoint(b.maxX + x + p.xOffset, b.maxY + y + p.yOffset);

      x += p.xAdvance;
      y += p.yAdvance;
    }

    return bbox;
  }
}
