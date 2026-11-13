import Path from './Path.js';

type Point = [number, number];

interface Segment {
  // Control points then the end point; the start is the previous end.
  points: Point[];
}

interface Contour {
  start: Point;
  segments: Segment[];
}

const SQRT3_OVER_36 = Math.sqrt(3) / 36;

const lerp = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

/**
 * The part of cubic p0..p3 between parameters t0 and t1.
 */
const cubicPiece = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t0: number,
  t1: number,
): [Point, Point, Point, Point] => {
  const at = (t: number): [Point, Point, Point, Point] => {
    // de Casteljau split at t, keeping the right half.
    const a = lerp(p0, p1, t);
    const b = lerp(p1, p2, t);
    const c = lerp(p2, p3, t);
    const d = lerp(a, b, t);
    const e = lerp(b, c, t);
    const f = lerp(d, e, t);
    return [f, e, c, p3];
  };
  const [q0, q1, q2, q3] = at(t0);
  if (t1 >= 1) return [q0, q1, q2, q3];
  // Split the remainder at the parameter t1 maps to within it, keeping the
  // left half.
  const s = (t1 - t0) / (1 - t0);
  const a = lerp(q0, q1, s);
  const b = lerp(q1, q2, s);
  const c = lerp(q2, q3, s);
  const d = lerp(a, b, s);
  const e = lerp(b, c, s);
  return [q0, a, d, lerp(d, e, s)];
};

/**
 * Quadratic segments approximating cubic p0..p3 to within `tolerance` font
 * units everywhere along the curve. The cubic is cut into n equal-parameter
 * pieces, each replaced by the quadratic whose control point is
 * (3(p1 + p2) - (p0 + p3)) / 4. That quadratic differs from its cubic piece by
 * at most sqrt(3)/36 * |p3 - 3p2 + 3p1 - p0| at every parameter, and the
 * third difference of a piece is that of the whole cubic over n^3, so n is
 * the smallest count bringing the bound under the tolerance. Piece ends lie
 * on the cubic, so the segments join exactly.
 */
const cubicToQuadratics = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  tolerance: number,
): Segment[] => {
  const dx = p3[0] - 3 * p2[0] + 3 * p1[0] - p0[0];
  const dy = p3[1] - 3 * p2[1] + 3 * p1[1] - p0[1];
  const bound = SQRT3_OVER_36 * Math.hypot(dx, dy);
  const n = Math.max(1, Math.ceil(Math.cbrt(bound / tolerance)));

  const segments: Segment[] = [];
  for (let i = 0; i < n; i++) {
    const [a, b, c, d] =
      n === 1
        ? [p0, p1, p2, p3]
        : cubicPiece(p0, p1, p2, p3, i / n, (i + 1) / n);
    const control: Point = [
      (3 * (b[0] + c[0]) - (a[0] + d[0])) / 4,
      (3 * (b[1] + c[1]) - (a[1] + d[1])) / 4,
    ];
    segments.push({ points: [control, i === n - 1 ? p3 : d] });
  }
  return segments;
};

const contoursOf = (path: Path, tolerance: number): Contour[] => {
  const contours: Contour[] = [];
  let current: Contour | null = null;
  let point: Point = [0, 0];

  const close = () => {
    if (current && current.segments.length > 0) contours.push(current);
    current = null;
  };

  for (const { command, args } of path.commands) {
    const a = args.map((v) => v ?? 0);
    switch (command) {
      case 'moveTo':
        close();
        point = [a[0]!, a[1]!];
        current = { start: point, segments: [] };
        break;
      case 'lineTo': {
        const end: Point = [a[0]!, a[1]!];
        current ??= { start: point, segments: [] };
        current.segments.push({ points: [end] });
        point = end;
        break;
      }
      case 'quadraticCurveTo': {
        const end: Point = [a[2]!, a[3]!];
        current ??= { start: point, segments: [] };
        current.segments.push({ points: [[a[0]!, a[1]!], end] });
        point = end;
        break;
      }
      case 'bezierCurveTo': {
        const end: Point = [a[4]!, a[5]!];
        current ??= { start: point, segments: [] };
        current.segments.push(
          ...cubicToQuadratics(
            point,
            [a[0]!, a[1]!],
            [a[2]!, a[3]!],
            end,
            tolerance,
          ),
        );
        point = end;
        break;
      }
      case 'closePath':
        // A closed contour's current point stays where it was drawn to, as
        // Path and the charstring decoders treat it.
        close();
        break;
    }
  }
  close();
  return contours;
};

/**
 * A glyf-ready copy of a PostScript-convention outline: cubics become
 * quadratics within `tolerance` font units, and every contour is reversed,
 * since CFF fills to the left of a contour and TrueType to the right. Under
 * the nonzero winding rule both formats fill with, reversing every contour
 * keeps the filled region, overlaps included. Contours with no segments are
 * dropped; each kept contour ends with closePath, with no closing line back
 * to its start (glyf closes contours implicitly).
 */
export const toTrueTypeOutline = (path: Path, tolerance: number): Path => {
  const out = new Path();
  for (const { start, segments } of contoursOf(path, tolerance)) {
    // Walking the segments backwards, each one's start is the previous
    // segment's end (or the contour start).
    const ends = [start, ...segments.map((s) => s.points.at(-1)!)];
    const last = ends.at(-1)!;
    out.moveTo(last[0], last[1]);
    for (let i = segments.length - 1; i >= 0; i--) {
      const target = ends[i]!;
      const { points } = segments[i]!;
      if (points.length === 1) {
        out.lineTo(target[0], target[1]);
      } else {
        const control = points[0]!;
        out.quadraticCurveTo(control[0], control[1], target[0], target[1]);
      }
    }
    // The contour returns to `last` implicitly; drop an explicit closing line
    // that would duplicate the start point.
    const final = out.commands.at(-1)!;
    if (
      final.command === 'lineTo' &&
      final.args[0] === last[0] &&
      final.args[1] === last[1]
    ) {
      out.commands.pop();
    }
    out.closePath();
  }
  return out;
};
