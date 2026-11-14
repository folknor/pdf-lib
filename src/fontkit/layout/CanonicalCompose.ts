// Font-aware canonical composition and decomposition, run on code points
// before cmap mapping (LayoutEngine.layout), for every font and script.
//
// Contract: the output is canonically equivalent to the input, and the only
// choice made is which equivalent representation the font can draw.
// - A code point the font does not map is replaced by its canonical
//   decomposition, taking at each level the shortest form whose parts the font
//   maps (an unmapped A WITH RING ABOVE AND ACUTE becomes A-WITH-RING + acute
//   when the font has those). If no form is fully mapped it stays as typed.
//   A code point the font maps is never decomposed.
// - A combining mark is composed onto the preceding starter (a non-mark with
//   combining class 0) when the pair has a primary composite outside
//   Full_Composition_Exclusion, the font maps that composite, and no mark in
//   between has class 0 or a class at least the candidate's (so CGJ blocks).
//   Marks with class 0 never compose, and nothing composes onto a mark, which
//   keeps Indic and USE split vowels apart for the shapers.
// - A cluster (non-mark plus following marks) containing a variation selector
//   is left exactly as typed, since the selector addresses its base.
//
// Deliberately NOT done: reordering marks. A sort by Unicode combining class
// is not the order fonts are built for: HarfBuzz sorts by its own shaping
// ranks (shadda before Arabic vowels, Hebrew dagesh and shin dots before
// vowels, Tibetan TSA -PHRU before and U before the other vowels) and adds
// contextual Hebrew and Arabic reorders, so a plain canonical sort would
// break sequences that shape correctly as typed. That stage, with its own
// versioned rank data, is open in notes/fontkit-findings.md.
//
// This is not NFC: supported characters are never decomposed to find a
// "more composed" form, and nothing is reordered. Hangul syllables have no
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

  const out: number[] = [];
  const outClusters: number[] = [];
  let starter = -1; // index in out of the open starter, -1 if none
  let blockedByZero = false;
  let highestBetween = 0;
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
    if (
      mark &&
      cls !== 0 &&
      starter >= 0 &&
      !blockedByZero &&
      highestBetween < cls
    ) {
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
    } else if (cls === 0) {
      blockedByZero = true;
    } else if (cls > highestBetween) {
      highestBetween = cls;
    }
  }
  return { codePoints: out, clusters: outClusters };
}
