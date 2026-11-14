import type { EncodeStream } from '../../vendors/restructure/index.js';
import * as r from '../../vendors/restructure/index.js';
import type PathType from './Path.js';

// Flags for simple glyphs
const ON_CURVE = 1 << 0;
const X_SHORT_VECTOR = 1 << 1;
const Y_SHORT_VECTOR = 1 << 2;
const REPEAT = 1 << 3;
const SAME_X = 1 << 4;
const SAME_Y = 1 << 5;

class PointEncoder {
  static size(val: number): number {
    return val >= 0 && val <= 255 ? 1 : 2;
  }

  static encode(stream: EncodeStream, value: number): void {
    if (value >= 0 && value <= 255) {
      stream.writeUInt8(value);
    } else {
      stream.writeInt16BE(value);
    }
  }
}

const Glyf = new r.Struct({
  numberOfContours: r.int16, // if negative, this is a composite glyph
  xMin: r.int16,
  yMin: r.int16,
  xMax: r.int16,
  yMax: r.int16,
  endPtsOfContours: new r.Array(r.uint16, 'numberOfContours'),
  instructions: new r.Array(r.uint8, r.uint16),
  flags: new r.Array(r.uint8, 0),
  xPoints: new r.Array(PointEncoder as unknown as r.Base<number>, 0),
  yPoints: new r.Array(PointEncoder as unknown as r.Base<number>, 0),
});

/**
 * Encodes TrueType glyph outlines
 */
const OVERLAP_SIMPLE = 1 << 6;

const INT16_MIN = -32768;
const INT16_MAX = 32767;

const checkInt16 = (value: number, what: string): void => {
  if (value < INT16_MIN || value > INT16_MAX) {
    throw new Error(`Glyph ${what} ${value} does not fit a glyf int16`);
  }
};

export interface EncodeSimpleOptions {
  instructions?: number[];
  /** Set OVERLAP_SIMPLE: the contours may overlap (nonzero fill). */
  overlapping?: boolean;
}

export default class TTFGlyphEncoder {
  /**
   * Encodes a path of lines and quadratic curves as a simple glyph. Cubic
   * curves have no glyf form; convert them first (quadraticOutline.ts).
   * Coordinates are rounded to integers; a glyph whose coordinates, deltas,
   * contour or point counts exceed what glyf can hold is refused rather than
   * wrapped.
   */
  encodeSimple(
    path: PathType,
    { instructions = [], overlapping = false }: EncodeSimpleOptions = {},
  ): Uint8Array {
    const endPtsOfContours: number[] = [];
    const xPoints: number[] = [];
    const yPoints: number[] = [];
    const flags: number[] = [];
    let same = 0;

    let lastX = 0,
      lastY = 0,
      lastFlag = 0;

    let pointCount = 0;
    // The glyf header bbox spans every encoded point, off-curve included.
    let xMin = Infinity;
    let yMin = Infinity;
    let xMax = -Infinity;
    let yMax = -Infinity;

    for (let i = 0; i < path.commands.length; i++) {
      const c = path.commands[i];

      if (!c) continue;

      if (c.command === 'bezierCurveTo') {
        throw new Error('glyf cannot hold cubic curves; convert them first');
      }

      for (let j = 0; j < c.args.length; j += 2) {
        // glyf stores integer coordinates. Paths can hold fractions (scaled
        // composite components, variation deltas); writing fractional deltas
        // would truncate each one and let the error accumulate.
        const x = Math.round(c.args[j] ?? 0);
        const y = Math.round(c.args[j + 1] ?? 0);
        let flag = 0;

        // If the ending point of a quadratic curve is the midpoint between
        // its control point and the next quadratic's, it can be omitted: a
        // decoder implies it. The decoder implies the midpoint of the rounded
        // controls, so omit the point when that midpoint is the point itself
        // or its rounding (it is then at least as close as writing it).
        if (c.command === 'quadraticCurveTo' && j === 2) {
          const next = path.commands[i + 1];

          if (next && next.command === 'quadraticCurveTo') {
            const rawX = c.args[j] ?? 0;
            const rawY = c.args[j + 1] ?? 0;
            const midX2 = lastX + Math.round(next.args[0] ?? 0);
            const midY2 = lastY + Math.round(next.args[1] ?? 0);

            if (
              (2 * rawX === midX2 || 2 * x === midX2) &&
              (2 * rawY === midY2 || 2 * y === midY2)
            ) {
              continue;
            }
          }
        }

        checkInt16(x, 'x coordinate');
        checkInt16(y, 'y coordinate');
        checkInt16(x - lastX, 'x delta');
        checkInt16(y - lastY, 'y delta');

        if (pointCount === 0 && overlapping) flag |= OVERLAP_SIMPLE;

        // All points except control points are on curve.
        if (!(c.command === 'quadraticCurveTo' && j === 0)) {
          flag |= ON_CURVE;
        }

        flag = this._encodePoint(
          x,
          lastX,
          xPoints,
          flag,
          X_SHORT_VECTOR,
          SAME_X,
        );
        flag = this._encodePoint(
          y,
          lastY,
          yPoints,
          flag,
          Y_SHORT_VECTOR,
          SAME_Y,
        );

        if (flag === lastFlag && same < 255) {
          const lastFlagIdx = flags.length - 1;

          if (flags[lastFlagIdx] !== undefined) {
            flags[lastFlagIdx] |= REPEAT;
          }

          same++;
        } else {
          if (same > 0) {
            flags.push(same);
            same = 0;
          }

          flags.push(flag);
          lastFlag = flag;
        }

        lastX = x;
        lastY = y;

        if (x < xMin) xMin = x;

        if (y < yMin) yMin = y;

        if (x > xMax) xMax = x;

        if (y > yMax) yMax = y;
        pointCount++;
      }

      if (c.command === 'closePath') {
        endPtsOfContours.push(pointCount - 1);
      }
    }

    // Flush the repeat count of a run that lasts until the final point.
    // Without it the REPEAT bit on the last flag makes decoders consume the
    // first coordinate byte as the count.
    if (same > 0) {
      flags.push(same);
    }

    // Close the path if the last command didn't already
    const lastCmd = path.commands[path.commands.length - 1];

    if (
      path.commands.length > 1 &&
      lastCmd &&
      lastCmd.command !== 'closePath'
    ) {
      endPtsOfContours.push(pointCount - 1);
    }

    // numberOfContours is signed, and maxp.maxPoints caps a glyph's points.
    if (endPtsOfContours.length > INT16_MAX || pointCount > 0xffff) {
      throw new Error(
        `Glyph has ${endPtsOfContours.length} contours and ${pointCount} points, more than glyf can hold`,
      );
    }

    if (pointCount === 0) xMin = yMin = xMax = yMax = 0;

    const glyf = {
      numberOfContours: endPtsOfContours.length,
      xMin,
      yMin,
      xMax,
      yMax,
      endPtsOfContours: endPtsOfContours,
      instructions: instructions,
      flags: flags,
      xPoints: xPoints,
      yPoints: yPoints,
    };

    const size = Glyf.size(glyf);
    // Pad each glyph record to a 4-byte length (none when already aligned),
    // so loca offsets stay aligned (and even, as short loca requires).
    const tail = (4 - (size % 4)) % 4;

    const stream = new r.EncodeStream(new Uint8Array(size + tail));
    Glyf.encode(stream, glyf);

    if (tail !== 0) {
      stream.fill(0, tail);
    }

    return stream.buffer;
  }

  _encodePoint(
    value: number,
    last: number,
    points: number[],
    flag: number,
    shortFlag: number,
    sameFlag: number,
  ): number {
    let diff = value - last;

    if (value === last) {
      flag |= sameFlag;
    } else {
      if (-255 <= diff && diff <= 255) {
        flag |= shortFlag;

        if (diff < 0) {
          diff = -diff;
        } else {
          flag |= sameFlag;
        }
      }

      points.push(diff);
    }

    return flag;
  }
}
