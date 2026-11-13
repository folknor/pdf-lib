import type { DecodeStream } from '../../vendors/restructure/index.js';
import * as r from '../../vendors/restructure/index.js';
import BBox from './BBox.js';
import Glyph, { type GlyphMetrics } from './Glyph.js';
import Path from './Path.js';

export interface DecodedGlyph {
  numberOfContours: number;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  points?: Point[];
  instructions?: number[];
  components?: Component[];
  phantomPoints?: Point[];
}

// The header for both simple and composite glyphs
const GlyfHeader = new r.Struct({
  numberOfContours: r.int16, // if negative, this is a composite glyph
  xMin: r.int16,
  yMin: r.int16,
  xMax: r.int16,
  yMax: r.int16,
});

// Flags for simple glyphs
const ON_CURVE = 1 << 0;
const X_SHORT_VECTOR = 1 << 1;
const Y_SHORT_VECTOR = 1 << 2;
const REPEAT = 1 << 3;
const SAME_X = 1 << 4;
const SAME_Y = 1 << 5;

// Flags for composite glyphs
const ARG_1_AND_2_ARE_WORDS = 1 << 0;
// Note: These flags are defined in the spec but not currently used in this implementation
// const ARGS_ARE_XY_VALUES = 1 << 1;
// const ROUND_XY_TO_GRID = 1 << 2;
const WE_HAVE_A_SCALE = 1 << 3;
const MORE_COMPONENTS = 1 << 5;
const WE_HAVE_AN_X_AND_Y_SCALE = 1 << 6;
const WE_HAVE_A_TWO_BY_TWO = 1 << 7;
const WE_HAVE_INSTRUCTIONS = 1 << 8;
const USE_MY_METRICS = 1 << 9;
// const OVERLAP_COMPOUND = 1 << 10;
// const SCALED_COMPONENT_OFFSET = 1 << 11;
// const UNSCALED_COMPONENT_OFFSET = 1 << 12;

// Represents a point in a simple glyph
export class Point {
  onCurve: boolean;
  endContour: boolean;
  x: number;
  y: number;

  constructor(
    onCurve: boolean,
    endContour: boolean,
    x: number = 0,
    y: number = 0,
  ) {
    this.onCurve = onCurve;
    this.endContour = endContour;
    this.x = x;
    this.y = y;
  }

  copy(): Point {
    return new Point(this.onCurve, this.endContour, this.x, this.y);
  }
}

// Represents a component in a composite glyph
class Component {
  glyphID: number;
  dx: number;
  dy: number;
  pos: number;
  scaleX: number;
  scaleY: number;
  scale01: number;
  scale10: number;
  // The composite takes this component's metrics (its phantom points).
  useMyMetrics: boolean;

  constructor(glyphID: number, dx: number, dy: number) {
    this.glyphID = glyphID;
    this.dx = dx;
    this.dy = dy;
    this.pos = 0;
    this.useMyMetrics = false;
    this.scaleX = this.scaleY = 1;
    this.scale01 = this.scale10 = 0;
  }
}

/**
 * Represents a TrueType glyph.
 */
export default class TTFGlyph extends Glyph {
  type = 'TTF';

  // Parses just the glyph header and returns the bounding box
  override _getCBox(internal?: boolean): BBox {
    // We need to decode the glyph if variation processing is requested,
    // so it's easier just to recompute the path's cbox after decoding.
    if (this._font._variationProcessor && !internal) {
      return this.path.cbox;
    }

    // An empty glyph has no header; reading one would take the next glyph's
    // bytes, or run off the end of glyf.
    const offsets = this._font.loca.offsets;
    if (offsets[this.id] === offsets[this.id + 1]) {
      return Object.freeze(new BBox(0, 0, 0, 0));
    }

    const stream = this._font._getTableStream('glyf');
    stream.pos += offsets[this.id];
    const glyph = GlyfHeader.decode(stream) as {
      xMin: number;
      yMin: number;
      xMax: number;
      yMax: number;
    };

    const cbox = new BBox(glyph.xMin, glyph.yMin, glyph.xMax, glyph.yMax);
    return Object.freeze(cbox);
  }

  // Parses a single glyph coordinate
  _parseGlyphCoord(
    stream: DecodeStream,
    prev: number,
    short: number,
    same: number,
  ): number {
    let val;
    if (short) {
      val = stream.readUInt8();
      if (!same) {
        val = -val;
      }

      val += prev;
    } else {
      if (same) {
        val = prev;
      } else {
        val = prev + stream.readInt16BE();
      }
    }

    return val;
  }

  // Decodes the glyph data into points for simple glyphs,
  // or components for composite glyphs
  // A glyph with no glyf data decodes as zero contours with zero extents (the
  // shape WOFF2Font._transformGlyfTable gives it), so that it still goes
  // through _applyVariation: its phantom points carry its varied advance.
  _decode(): DecodedGlyph {
    const glyfPos = this._font.loca.offsets[this.id];
    const nextPos = this._font.loca.offsets[this.id + 1];

    if (glyfPos === nextPos) {
      const empty: DecodedGlyph = {
        numberOfContours: 0,
        xMin: 0,
        yMin: 0,
        xMax: 0,
        yMax: 0,
      };
      this._applyVariation(empty);
      return empty;
    }

    const stream = this._font._getTableStream('glyf');
    stream.pos += glyfPos;
    const startPos = stream.pos;

    const glyphHeader = GlyfHeader.decode(stream) as {
      numberOfContours: number;
      xMin: number;
      yMin: number;
      xMax: number;
      yMax: number;
    };

    const glyph: DecodedGlyph = {
      numberOfContours: glyphHeader.numberOfContours,
      xMin: glyphHeader.xMin,
      yMin: glyphHeader.yMin,
      xMax: glyphHeader.xMax,
      yMax: glyphHeader.yMax,
    };

    if (glyph.numberOfContours > 0) {
      this._decodeSimple(glyph, stream);
    } else if (glyph.numberOfContours < 0) {
      this._decodeComposite(glyph, stream, startPos);
    }

    this._applyVariation(glyph);
    return glyph;
  }

  _decodeSimple(glyph: DecodedGlyph, stream: DecodeStream): void {
    // this is a simple glyph
    glyph.points = [];

    const endPtsOfContours = new r.Array(
      r.uint16,
      glyph.numberOfContours,
    ).decode(stream) as number[];
    glyph.instructions = new r.Array(r.uint8, r.uint16).decode(
      stream,
    ) as number[];

    const flags: number[] = [];
    const lastEndPt = endPtsOfContours[endPtsOfContours.length - 1];
    const numCoords = (lastEndPt ?? -1) + 1;

    while (flags.length < numCoords) {
      const flag = stream.readUInt8();
      flags.push(flag);

      // check for repeat flag
      if (flag & REPEAT) {
        const count = stream.readUInt8();
        for (let j = 0; j < count; j++) {
          flags.push(flag);
        }
      }
    }

    for (let i = 0; i < flags.length; i++) {
      const flag = flags[i] ?? 0;
      const point = new Point(
        !!(flag & ON_CURVE),
        endPtsOfContours.indexOf(i) >= 0,
        0,
        0,
      );
      glyph.points.push(point);
    }

    let px = 0;
    for (let i = 0; i < flags.length; i++) {
      const flag = flags[i] ?? 0;
      const pt = glyph.points[i];
      if (pt) {
        pt.x = px = this._parseGlyphCoord(
          stream,
          px,
          flag & X_SHORT_VECTOR,
          flag & SAME_X,
        );
      }
    }

    let py = 0;
    for (let i = 0; i < flags.length; i++) {
      const flag = flags[i] ?? 0;
      const pt = glyph.points[i];
      if (pt) {
        pt.y = py = this._parseGlyphCoord(
          stream,
          py,
          flag & Y_SHORT_VECTOR,
          flag & SAME_Y,
        );
      }
    }

    return;
  }

  _decodeComposite(
    glyph: DecodedGlyph,
    stream: DecodeStream,
    offset: number = 0,
  ): boolean {
    // this is a composite glyph
    glyph.components = [];
    let haveInstructions = false;
    let flags = MORE_COMPONENTS;

    while (flags & MORE_COMPONENTS) {
      flags = stream.readUInt16BE();
      const gPos = stream.pos - offset;
      const glyphID = stream.readUInt16BE();
      if (!haveInstructions) {
        haveInstructions = (flags & WE_HAVE_INSTRUCTIONS) !== 0;
      }

      let dx;
      let dy;
      if (flags & ARG_1_AND_2_ARE_WORDS) {
        dx = stream.readInt16BE();
        dy = stream.readInt16BE();
      } else {
        dx = stream.readInt8();
        dy = stream.readInt8();
      }

      const component = new Component(glyphID, dx, dy);
      component.pos = gPos;
      component.useMyMetrics = (flags & USE_MY_METRICS) !== 0;

      if (flags & WE_HAVE_A_SCALE) {
        // fixed number with 14 bits of fraction
        component.scaleX = component.scaleY =
          ((stream.readUInt8() << 24) | (stream.readUInt8() << 16)) /
          1073741824;
      } else if (flags & WE_HAVE_AN_X_AND_Y_SCALE) {
        component.scaleX =
          ((stream.readUInt8() << 24) | (stream.readUInt8() << 16)) /
          1073741824;
        component.scaleY =
          ((stream.readUInt8() << 24) | (stream.readUInt8() << 16)) /
          1073741824;
      } else if (flags & WE_HAVE_A_TWO_BY_TWO) {
        component.scaleX =
          ((stream.readUInt8() << 24) | (stream.readUInt8() << 16)) /
          1073741824;
        component.scale01 =
          ((stream.readUInt8() << 24) | (stream.readUInt8() << 16)) /
          1073741824;
        component.scale10 =
          ((stream.readUInt8() << 24) | (stream.readUInt8() << 16)) /
          1073741824;
        component.scaleY =
          ((stream.readUInt8() << 24) | (stream.readUInt8() << 16)) /
          1073741824;
      }

      glyph.components.push(component);
    }

    return haveInstructions;
  }

  // Applies the font's gvar deltas, in place, to a decoded glyph's points or
  // component offsets plus its four phantom points. Kept apart from parsing
  // so that WOFF2Glyph, whose glyphs are pre-decoded from the transformed
  // glyf table, varies them by the same rule.
  _applyVariation(glyph: DecodedGlyph): void {
    const processor = this._font._variationProcessor;
    if (!processor) return;

    // An empty glyph (zero contours) has only the phantom points to vary.
    if (glyph.numberOfContours >= 0) {
      const points = (glyph.points ?? []).slice();
      points.push(...this._getPhantomPoints(glyph));

      processor.transformPoints(this.id, points);
      glyph.phantomPoints = points.slice(-4);
    } else {
      const components = glyph.components ?? [];
      const points: Point[] = components.map(
        (comp) => new Point(true, true, comp.dx, comp.dy),
      );

      points.push(...this._getPhantomPoints(glyph));

      processor.transformPoints(this.id, points);
      glyph.phantomPoints = points.splice(-4, 4);

      for (let i = 0; i < points.length; i++) {
        const point = points[i]!;
        const comp = components[i]!;
        comp.dx = point.x;
        comp.dy = point.y;
      }
    }
  }

  // The four phantom points (left and right origin, top and bottom origin)
  // are always built from the unvaried table metrics. A component glyph is
  // decoded again for every composite that uses it, so building them from
  // the varied _metrics would apply its deltas once per decode.
  _getPhantomPoints(glyph: DecodedGlyph): Point[] {
    this._defaultMetrics ??= this._getDefaultMetrics(this._getCBox(true));
    const { advanceWidth, advanceHeight, leftBearing, topBearing } =
      this._defaultMetrics;

    const top = glyph.yMax + topBearing;
    return [
      new Point(false, true, glyph.xMin - leftBearing, 0),
      new Point(false, true, glyph.xMin - leftBearing + advanceWidth, 0),
      new Point(false, true, 0, top),
      new Point(false, true, 0, top - advanceHeight),
    ];
  }

  _defaultMetrics?: GlyphMetrics;

  // Decodes font data, resolves composite glyphs, and returns an array of contours
  _getContours(): Point[][] {
    return this._resolve().contours;
  }

  // Resolves the glyph's outline and the phantom points its metrics come
  // from. A composite with a USE_MY_METRICS component takes that component's
  // resolved phantom points in place of its own (the last flagged component
  // wins, and a flagged composite component passes on its own choice), as the
  // gvar spec and HarfBuzz do. They are the component's metrics, so they are
  // taken before its offset and scale are applied.
  _resolve(): { contours: Point[][]; phantoms: Point[] | undefined } {
    const glyph = this._decode();

    let points: Point[] = [];
    let phantoms = glyph.phantomPoints;

    if (glyph.numberOfContours < 0) {
      // resolve composite glyphs
      for (const component of glyph.components ?? []) {
        // getGlyph() may return a COLR glyph (no _getContours) in color fonts,
        // so ask for the outline glyph explicitly.
        const componentGlyph = this._font._getBaseGlyph(component.glyphID);
        if (!componentGlyph) continue;
        const resolved = componentGlyph._resolve();
        if (component.useMyMetrics && resolved.phantoms) {
          phantoms = resolved.phantoms;
        }
        const contours: Point[][] = resolved.contours;
        for (let i = 0; i < contours.length; i++) {
          const contour = contours[i];
          if (!contour) continue;
          for (let j = 0; j < contour.length; j++) {
            const point = contour[j];
            if (!point) continue;
            const x =
              point.x * component.scaleX +
              point.y * component.scale01 +
              component.dx;
            const y =
              point.y * component.scaleY +
              point.x * component.scale10 +
              component.dy;
            points.push(new Point(point.onCurve, point.endContour, x, y));
          }
        }
      }
    } else {
      points = glyph.points || [];
    }

    // Publish the varied metrics. Horizontal ones come from HVAR when the
    // font has it, else from the phantom points; vertical ones always come
    // from the phantom points, since VVAR is not read. Bearings are measured
    // from the varied outline's extents (every resolved point, off-curve and
    // composite-transformed ones included, as a glyf header's are) to the
    // selected phantom points, with or without HVAR: HVAR's LSB mapping is
    // not read, since the bearing it would supply must equal this one, and
    // without the mapping the spec derives it from the outline anyway. An
    // empty glyph's extents are zero, as its decoded header's are.
    const [ph0, ph1, ph2, ph3] = phantoms ?? [];
    if (ph0 && ph1 && ph2 && ph3) {
      let xMin = points.length > 0 ? Infinity : glyph.xMin;
      let yMax = points.length > 0 ? -Infinity : glyph.yMax;
      for (const point of points) {
        xMin = Math.min(xMin, point.x);
        yMax = Math.max(yMax, point.y);
      }
      this._metrics = {
        advanceWidth: this._font.HVAR
          ? this._defaultMetrics!.advanceWidth + this._getHVARAdjustment()
          : ph1.x - ph0.x,
        leftBearing: xMin - ph0.x,
        advanceHeight: ph2.y - ph3.y,
        topBearing: ph2.y - yMax,
      };
    }

    const contours: Point[][] = [];
    let cur: Point[] = [];
    for (let k = 0; k < points.length; k++) {
      const point = points[k];
      if (point) {
        cur.push(point);
        if (point.endContour) {
          contours.push(cur);
          cur = [];
        }
      }
    }

    return { contours, phantoms };
  }

  override _getMetrics(): GlyphMetrics {
    if (this._metrics) {
      return this._metrics;
    }

    if (this._font._variationProcessor) {
      // Varied metrics come from the decoded glyph's phantom points (vertical
      // always, horizontal without HVAR); _getContours publishes them.
      this._getContours();
      if (this._metrics) return this._metrics;
    }

    return super._getMetrics(this._getCBox(true));
  }

  // Converts contours to a Path object that can be rendered
  override _getPath(): Path {
    const contours = this._getContours();
    const path = new Path();

    for (let i = 0; i < contours.length; i++) {
      const contour = contours[i];
      if (!contour || contour.length === 0) continue;

      let firstPt = contour[0];
      const lastPt = contour[contour.length - 1];
      if (!firstPt || !lastPt) continue;

      let start = 0;

      let curvePt: Point | null;
      if (firstPt.onCurve) {
        // The first point will be consumed by the moveTo command, so skip in the loop
        curvePt = null;
        start = 1;
      } else {
        if (lastPt.onCurve) {
          // Start at the last point if the first point is off curve and the last point is on curve
          firstPt = lastPt;
        } else {
          // Start at the middle if both the first and last points are off curve
          firstPt = new Point(
            false,
            false,
            (firstPt.x + lastPt.x) / 2,
            (firstPt.y + lastPt.y) / 2,
          );
        }

        curvePt = firstPt;
      }

      path.moveTo(firstPt.x, firstPt.y);

      for (let j = start; j < contour.length; j++) {
        const pt = contour[j];
        const prevPt = j === 0 ? firstPt : contour[j - 1];
        if (!pt || !prevPt) continue;

        if (prevPt.onCurve && pt.onCurve) {
          path.lineTo(pt.x, pt.y);
        } else if (prevPt.onCurve && !pt.onCurve) {
          curvePt = pt;
        } else if (!prevPt.onCurve && !pt.onCurve) {
          const midX = (prevPt.x + pt.x) / 2;
          const midY = (prevPt.y + pt.y) / 2;
          path.quadraticCurveTo(prevPt.x, prevPt.y, midX, midY);
          curvePt = pt;
        } else if (!prevPt.onCurve && pt.onCurve) {
          if (curvePt) {
            path.quadraticCurveTo(curvePt.x, curvePt.y, pt.x, pt.y);
          }
          curvePt = null;
        } else {
          throw new Error('Unknown TTF path state');
        }
      }

      // Connect the first and last points
      if (curvePt) {
        path.quadraticCurveTo(curvePt.x, curvePt.y, firstPt.x, firstPt.y);
      }

      path.closePath();
    }

    return path;
  }
}
