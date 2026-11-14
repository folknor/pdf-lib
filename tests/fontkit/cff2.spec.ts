import fs from 'fs';
import fontkit from 'src/fontkit.js';
import Path from '../../src/fontkit/glyph/Path';
import { toTrueTypeOutline } from '../../src/fontkit/glyph/quadraticOutline';

// AdobeVFPrototype-Subset.otf: CFF2 outlines, HVAR, fvar (wght 0..1000,
// default 1000), no glyf. Glyph 1 is a dollar sign whose bar overlaps the S.
const load = (): any =>
  fontkit.create(
    new Uint8Array(
      fs.readFileSync('./assets/fonts/fonttest/AdobeVFPrototype-Subset.otf'),
    ),
  );

const encodeSubset = (font: any, gids: number[]): any => {
  const subset = font.createSubset();

  for (const gid of gids) subset.includeGlyph(gid);

  return fontkit.create(subset.encode());
};

type Pt = [number, number];

// Polygons approximating each contour, curves sampled finely.
const polygons = (path: Path, steps = 32): Pt[][] => {
  const out: Pt[][] = [];
  let poly: Pt[] = [];
  let cur: Pt = [0, 0];

  for (const { command, args: a } of path.commands) {
    if (command === 'moveTo') {
      if (poly.length) out.push(poly);
      cur = [a[0]!, a[1]!];
      poly = [cur];
    } else if (command === 'lineTo') {
      cur = [a[0]!, a[1]!];
      poly.push(cur);
    } else if (command === 'quadraticCurveTo') {
      const [x0, y0] = cur;

      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        poly.push([
          u * u * x0 + 2 * u * t * a[0]! + t * t * a[2]!,
          u * u * y0 + 2 * u * t * a[1]! + t * t * a[3]!,
        ]);
      }

      cur = [a[2]!, a[3]!];
    } else if (command === 'bezierCurveTo') {
      const [x0, y0] = cur;

      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        poly.push([
          u * u * u * x0 +
            3 * u * u * t * a[0]! +
            3 * u * t * t * a[2]! +
            t * t * t * a[4]!,
          u * u * u * y0 +
            3 * u * u * t * a[1]! +
            3 * u * t * t * a[3]! +
            t * t * t * a[5]!,
        ]);
      }

      cur = [a[4]!, a[5]!];
    } else if (command === 'closePath') {
      if (poly.length) out.push(poly);
      poly = [];
    }
  }

  if (poly.length) out.push(poly);

  return out;
};

const winding = (polys: Pt[][], [px, py]: Pt): number => {
  let w = 0;

  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const [x0, y0] = poly[i]!;
      const [x1, y1] = poly[(i + 1) % poly.length]!;

      if (y0 <= py && y1 > py) {
        if ((x1 - x0) * (py - y0) - (px - x0) * (y1 - y0) > 0) w++;
      } else if (y0 > py && y1 <= py) {
        if ((x1 - x0) * (py - y0) - (px - x0) * (y1 - y0) < 0) w--;
      }
    }
  }

  return w;
};

const distanceToEdges = (polys: Pt[][], [px, py]: Pt): number => {
  let best = Infinity;

  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const [x0, y0] = poly[i]!;
      const [x1, y1] = poly[(i + 1) % poly.length]!;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = dx * dx + dy * dy;

      const t = len
        ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len))
        : 0;

      best = Math.min(best, Math.hypot(px - x0 - t * dx, py - y0 - t * dy));
    }
  }

  return best;
};

// Every grid point clear of the outline edges is filled (nonzero) in the
// converted outline exactly when it is in the source. Returns how many points
// the overlap makes even-odd disagree with nonzero, to show the case is live.
const expectSameFill = (source: Path, converted: Path): number => {
  const a = polygons(source);
  const b = polygons(converted);
  const { minX, minY, maxX, maxY } = source.cbox;
  let overlapPoints = 0;

  for (let x = minX - 5; x <= maxX + 5; x += 3) {
    for (let y = minY - 5; y <= maxY + 5; y += 3) {
      const p: Pt = [x, y];

      if (distanceToEdges(a, p) < 2) continue;
      const wa = winding(a, p);
      const wb = winding(b, p);
      expect(wb !== 0).toBe(wa !== 0);

      if (wa !== 0 && wa % 2 === 0) overlapPoints++;
    }
  }

  return overlapPoints;
};

describe('CFF2 subsetting', () => {
  it('converts the outlines into a TrueType subset', () => {
    const font = load();
    const embedded = encodeSubset(font, [1]);
    expect(embedded.directory.tables.glyf).toBeDefined();
    expect(embedded.directory.tables.CFF2).toBeUndefined();
    expect(embedded.numGlyphs).toBe(2);

    const source = font.getGlyph(1);
    const actual = embedded.getGlyph(1);
    expect(actual.advanceWidth).toBe(Math.round(source.advanceWidth));
    // xMin is the left side bearing, so the outline keeps its origin.
    expect(actual._getMetrics().leftBearing).toBe(actual._decode().xMin);

    const overlap = expectSameFill(source.path, actual.path);
    expect(overlap).toBeGreaterThan(0);
    // Overlapping contours are flagged OVERLAP_SIMPLE on the first point.
    const glyf = embedded._getTableStream('glyf');
    const offset = embedded.loca.offsets[1];

    const bytes: Uint8Array = glyf.buffer.subarray(
      glyf.pos + offset,
      glyf.pos + embedded.loca.offsets[2],
    );

    const view = new DataView(bytes.buffer, bytes.byteOffset);
    const contours = view.getInt16(0);
    const instructionLength = view.getUint16(10 + 2 * contours);
    expect(bytes[12 + 2 * contours + instructionLength]! & 0x40).toBe(0x40);
  });

  it('bakes the varied outline and advance into a variation subset', () => {
    const font = load();
    const instance = font.getVariation({ wght: 900 });
    const source = instance.getGlyph(1);
    // HVAR gives this instance a fractional advance; hmtx holds it rounded.
    expect(Number.isInteger(source.advanceWidth)).toBe(false);
    const actual = encodeSubset(instance, [1]).getGlyph(1);
    expect(actual.advanceWidth).toBe(Math.round(source.advanceWidth));
    expect(actual.advanceWidth).not.toBe(font.getGlyph(1).advanceWidth);
    expectSameFill(source.path, actual.path);
  });

  it('encodes a subset whose glyphs are all empty', () => {
    const font = load();
    // Give the subset's only glyph an empty outline.
    const subset = font.createSubset();
    const glyph = font._getBaseGlyph(0);
    Object.defineProperty(glyph, 'path', { value: new Path() });
    const embedded = fontkit.create(subset.encode()) as any;
    expect(embedded.numGlyphs).toBe(1);
    expect(embedded.getGlyph(0).path.commands).toEqual([]);
    expect(embedded.head.xMax).toBe(0);
  });

  it('keeps every glyph id when encoding the whole font', () => {
    const font = load();
    const gids = Array.from({ length: font.numGlyphs }, (_, i) => i);
    const embedded = encodeSubset(font, gids.slice(1));
    expect(embedded.numGlyphs).toBe(font.numGlyphs);

    for (const gid of gids) {
      expectSameFill(font.getGlyph(gid).path, embedded.getGlyph(gid).path);
    }
  });
});

describe('toTrueTypeOutline', () => {
  it('keeps every cubic within the tolerance', () => {
    const path = new Path();
    path.moveTo(0, 0);
    path.bezierCurveTo(0, 900, 1000, -900, 1000, 0);
    path.closePath();
    const tolerance = 0.5;
    const out = toTrueTypeOutline(path, tolerance);
    expect(out.commands.some((c) => c.command === 'bezierCurveTo')).toBe(
      false,
    );
    // Every point of the converted contour lies within the tolerance of the
    // source contour (and the closing line both share).
    // Sampled finely enough that the chords add well under 0.05.
    const source = polygons(path, 4096);

    for (const poly of polygons(out)) {
      for (const p of poly) {
        expect(distanceToEdges(source, p)).toBeLessThan(tolerance + 0.05);
      }
    }
  });

  it('reverses each contour and drops a duplicate closing point', () => {
    const path = new Path();
    path.moveTo(0, 0);
    path.lineTo(10, 0);
    path.lineTo(10, 10);
    path.lineTo(0, 0);
    path.closePath();
    expect(toTrueTypeOutline(path, 0.5).commands).toEqual([
      { command: 'moveTo', args: [0, 0] },
      { command: 'lineTo', args: [10, 10] },
      { command: 'lineTo', args: [10, 0] },
      { command: 'closePath', args: [] },
    ]);
  });
});
