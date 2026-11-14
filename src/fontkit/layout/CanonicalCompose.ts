// Font-aware canonical composition and decomposition, run on code points
// before cmap mapping (LayoutEngine.layout), for every font and script.
//
// Contract: the output is canonically equivalent to the input, and the only
// choice made is which equivalent representation the font can draw.
// - A code point the font does not map is replaced by its canonical
//   decomposition, taking at each level the shortest form whose parts the font
//   maps (an unmapped A WITH RING ABOVE AND ACUTE becomes A-WITH-RING + acute
//   when the font has those). If no form is fully mapped it stays as typed.
//   A code point the font maps is never decomposed, so marks inside a mapped
//   composite stay out of the reorder below.
// - Each run of code points with nonzero combining class is then stably
//   sorted by shaping rank (MarkOrder.ts), not by plain class: fonts and the
//   USE grammar expect some marks out of canonical order. Class-0 code points
//   (CGJ, Indic matras, a mapped U+0F73) bound runs and keep typed order, so
//   CGJ is the way to force an order. Runs with Hebrew or Arabic marks or
//   base are frozen (left as typed) until those scripts get their ranks.
// - A combining mark is then composed onto the preceding starter (a non-mark
//   with combining class 0) when the pair has a primary composite outside
//   Full_Composition_Exclusion, the font maps that composite, and no class-0
//   mark is in between (so CGJ blocks), nor any mark of the candidate's own
//   class: it commutes past the others. Frozen runs keep the classic rule,
//   blocked also by a higher class. Sorting before composing makes every
//   spelling with the same exposed marks compose alike. Marks with class 0
//   never compose, and nothing composes onto a mark, which keeps Indic and
//   USE split vowels apart for the shapers.
// - A cluster (non-mark plus following marks) containing a variation selector
//   is left exactly as typed, since the selector addresses its base.
//
// This is not NFC: supported characters are never decomposed to find a
// "more composed" form, and marks are ordered by rank. Hangul syllables have no
// table decomposition and are left to HangulShaper. Data is Unicode 8, the
// version of the vendored unicode-properties (scripts/gen-canonical-data.mjs).
//
// Composed glyphs carry the composite code point, so their ToUnicode mapping
// is a canonically equivalent spelling; the clusters carried through here let
// the embedder write the typed one as /ActualText where they differ.

import { isMark } from '../../vendors/unicode-properties/index.js';
import {
  COMBINING_CLASSES,
  COMPOSITION_EXCLUSIONS,
  DECOMPOSITIONS,
} from './canonicalData.js';
import { isFrozenRun, shapingRank } from './MarkOrder.js';

interface Tables {
  decompositions: Map<number, number[]>;
  classes: Map<number, number>;
  compositions: Map<number, Map<number, number>>;
}

let tables: Tables | undefined;

const load = (): Tables => {
  if (tables) return tables;
  const decompositions = new Map<number, number[]>();
  for (const entry of DECOMPOSITIONS.split(';')) {
    const [cp, parts] = entry.split(':') as [string, string];
    decompositions.set(
      parseInt(cp, 16),
      parts.split(',').map((h) => parseInt(h, 16)),
    );
  }
  const classes = new Map<number, number>();
  for (const entry of COMBINING_CLASSES.split(';')) {
    const [range, cls] = entry.split(':') as [string, string];
    const [a, b = a] = range.split('-') as [string, string?];
    for (let cp = parseInt(a, 16); cp <= parseInt(b!, 16); cp++) {
      classes.set(cp, Number(cls));
    }
  }
  const excluded = new Set(
    COMPOSITION_EXCLUSIONS.split(',').map((h) => parseInt(h, 16)),
  );
  const compositions = new Map<number, Map<number, number>>();
  for (const [cp, parts] of decompositions) {
    if (parts.length !== 2 || excluded.has(cp)) continue;
    const [first, second] = parts as [number, number];
    let bySecond = compositions.get(first);
    if (!bySecond) compositions.set(first, (bySecond = new Map()));
    bySecond.set(second, cp);
  }
  tables = { decompositions, classes, compositions };
  return tables;
};

/** Canonical combining class (Unicode 8). */
export const combiningClass = (cp: number): number =>
  load().classes.get(cp) ?? 0;

const isVariationSelector = (cp: number) =>
  (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef);

/**
 * Rewrites `codePoints` into the canonically equivalent sequence the font
 * draws best by the rules above. `hasGlyph` is the font's cmap test.
 * `clusters` (one per code point, see Clusters.ts) is carried along: a
 * decomposition's parts keep their code point's cluster, a composite takes
 * the smaller of its starter's and mark's.
 */
export function composeCanonical(
  codePoints: number[],
  hasGlyph: (cp: number) => boolean,
  clusters: number[] = codePoints.map((_, i) => i),
): { codePoints: number[]; clusters: number[] } {
  const { decompositions, compositions } = load();

  // Clusters holding a variation selector, judged on the typed sequence.
  const protectedAt = new Array<boolean>(codePoints.length).fill(false);
  for (let start = 0; start < codePoints.length; ) {
    let end = start + 1;
    while (end < codePoints.length && isMark(codePoints[end]!)) end++;
    let selector = false;
    for (let i = start; i < end; i++) {
      if (isVariationSelector(codePoints[i]!)) selector = true;
    }
    if (selector) protectedAt.fill(true, start, end);
    start = end;
  }

  // Shortest mapped decomposition of cp, or null when none is fully mapped.
  const decompose = (cp: number): number[] | null => {
    if (hasGlyph(cp)) return [cp];
    const parts = decompositions.get(cp);
    if (!parts) return null;
    const out: number[] = [];
    for (const part of parts) {
      const sub = decompose(part);
      if (!sub) return null;
      out.push(...sub);
    }
    return out;
  };

  const cps: number[] = [];
  const cpClusters: number[] = [];
  const locked: boolean[] = [];
  for (let i = 0; i < codePoints.length; i++) {
    const cp = codePoints[i]!;
    const parts =
      protectedAt[i] || hasGlyph(cp) || !decompositions.has(cp)
        ? null
        : decompose(cp);
    for (const part of parts ?? [cp]) {
      cps.push(part);
      cpClusters.push(clusters[i]!);
      locked.push(protectedAt[i]!);
    }
  }

  // Sort each run of unlocked nonzero-class code points by shaping rank
  // (MarkOrder.ts), stably, unless the run is frozen. Decided once here, on
  // the decomposed sequence, before anything composes.
  const frozen = new Array<boolean>(cps.length).fill(false);
  for (let start = 0; start < cps.length; ) {
    if (locked[start] || combiningClass(cps[start]!) === 0) {
      start++;
      continue;
    }
    let end = start + 1;
    while (
      end < cps.length &&
      !locked[end] &&
      combiningClass(cps[end]!) !== 0
    ) {
      end++;
    }
    if (isFrozenRun(cps, start, end)) {
      frozen.fill(true, start, end);
    } else if (end - start > 1) {
      const run = [];
      for (let i = start; i < end; i++) run.push([cps[i]!, cpClusters[i]!]);
      run.sort(([a], [b]) => shapingRank(a!) - shapingRank(b!));
      run.forEach(([cp, cluster], k) => {
        cps[start + k] = cp!;
        cpClusters[start + k] = cluster!;
      });
    }
    start = end;
  }

  const out: number[] = [];
  const outClusters: number[] = [];
  let starter = -1; // index in out of the open starter, -1 if none
  let blockedByZero = false;
  let highestBetween = 0; // highest class left between starter and here
  const classesBetween = new Set<number>();
  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i]!;
    const mark = isMark(cp);
    const cls = combiningClass(cp);
    if (locked[i]) {
      out.push(cp);
      outClusters.push(cpClusters[i]!);
      starter = -1;
      continue;
    }
    // A mark reaches the starter if it commutes past every mark left in
    // between (all nonzero classes other than its own). Frozen runs keep the
    // classic rule, which also blocks on a higher class.
    const reaches = frozen[i] ? highestBetween < cls : !classesBetween.has(cls);
    if (mark && cls !== 0 && starter >= 0 && !blockedByZero && reaches) {
      const composite = compositions.get(out[starter]!)?.get(cp);
      if (composite !== undefined && hasGlyph(composite)) {
        out[starter] = composite;
        outClusters[starter] = Math.min(outClusters[starter]!, cpClusters[i]!);
        continue;
      }
    }
    out.push(cp);
    outClusters.push(cpClusters[i]!);
    if (!mark && cls === 0) {
      starter = out.length - 1;
      blockedByZero = false;
      highestBetween = 0;
      classesBetween.clear();
    } else if (cls === 0) {
      blockedByZero = true;
    } else {
      highestBetween = Math.max(highestBetween, cls);
      classesBetween.add(cls);
    }
  }
  return { codePoints: out, clusters: outClusters };
}
