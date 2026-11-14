// Font-aware canonical composition and decomposition, run on code points
// before cmap mapping (LayoutEngine.layout), for every font and script.
//
// Contract: choose the representation the font can draw; canonical
// decompositions plus the Indic/USE split vowels (SplitVowels.ts).
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
//   CGJ is the way to force an order. Arabic runs (an Arabic base or
//   Arabic marks) are ordered by UAX #53 AMTRA instead (MarkOrder.ts).
// - A combining mark is then composed onto the preceding starter (a non-mark
//   with combining class 0) when the pair has a primary composite outside
//   Full_Composition_Exclusion, the font maps that composite, and no class-0
//   mark is in between (so CGJ blocks), nor any mark of the candidate's own
//   class: it commutes past the others. In Arabic runs a mark composes only
//   directly after the starter, as AMTRA forbids recomposing across marks.
//   With `hebrewPresentationForms` the canonical Hebrew presentation forms
//   (U+FB1D..FB4E, composition exclusions) compose too, for fonts that
//   cannot position the points (see LayoutEngine). A composite is reached
//   only through mapped intermediates: SHIN + dagesh + shin dot becomes
//   U+FB2C only when the font also maps U+FB49. Sorting before composing makes every
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

import { isMark } from "../../vendors/unicode-properties/index.js";
import { COMBINING_CLASSES, COMPOSITION_EXCLUSIONS, DECOMPOSITIONS } from "./canonicalData.js";
import { arabicKeys, isArabicRun, shapingRank } from "./MarkOrder.js";
import { SPLIT_VOWELS } from "./SplitVowels.js";

interface Tables {
  decompositions: Map<number, number[]>;
  classes: Map<number, number>;
  compositions: Map<number, Map<number, number>>;
  hebrewForms: Map<number, Map<number, number>>;
}

const isHebrewPresentationForm = (cp: number) => cp >= 0xfb1d && cp <= 0xfb4e;

let tables: Tables | undefined;

const load = (): Tables => {
  if (tables) return tables;
  const decompositions = new Map<number, number[]>();

  for (const entry of DECOMPOSITIONS.split(";")) {
    const [cp, parts] = entry.split(":") as [string, string];
    decompositions.set(
      parseInt(cp, 16),
      parts.split(",").map((h) => parseInt(h, 16)),
    );
  }

  const classes = new Map<number, number>();

  for (const entry of COMBINING_CLASSES.split(";")) {
    const [range, cls] = entry.split(":") as [string, string];
    const [a, b = a] = range.split("-") as [string, string?];

    for (let cp = parseInt(a, 16); cp <= parseInt(b!, 16); cp++) {
      classes.set(cp, Number(cls));
    }
  }

  const excluded = new Set(COMPOSITION_EXCLUSIONS.split(",").map((h) => parseInt(h, 16)));

  const compositions = new Map<number, Map<number, number>>();
  const hebrewForms = new Map<number, Map<number, number>>();

  for (const [cp, parts] of decompositions) {
    if (parts.length !== 2) continue;

    const table = !excluded.has(cp)
      ? compositions
      : isHebrewPresentationForm(cp)
        ? hebrewForms
        : null;

    if (!table) continue;
    const [first, second] = parts as [number, number];
    let bySecond = table.get(first);

    if (!bySecond) table.set(first, (bySecond = new Map()));
    bySecond.set(second, cp);
  }

  tables = { decompositions, classes, compositions, hebrewForms };

  return tables;
};

/** Canonical combining class (Unicode 8). */
export const combiningClass = (cp: number): number => load().classes.get(cp) ?? 0;

const isVariationSelector = (cp: number) =>
  (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef);

/**
 * Rewrites `codePoints` into the equivalent shaping sequence the font
 * draws best by the rules above. `hasGlyph` is the font's cmap test.
 * `clusters` (one per code point, see Clusters.ts) is carried along: a
 * decomposition's parts keep their code point's cluster, a composite takes
 * the smaller of its starter's and mark's.
 */
export function composeCanonical(
  codePoints: number[],
  hasGlyph: (cp: number) => boolean,
  clusters: number[] = codePoints.map((_, i) => i),
  { hebrewPresentationForms = false } = {},
): { codePoints: number[]; clusters: number[] } {
  const { decompositions, compositions, hebrewForms } = load();

  // Clusters holding a variation selector, judged on the typed sequence.
  const protectedAt = new Array<boolean>(codePoints.length).fill(false);

  for (let start = 0; start < codePoints.length;) {
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
  const decompose = (cp: number, seen = new Set<number>()): number[] | null => {
    if (hasGlyph(cp)) return [cp];

    if (seen.has(cp)) return null;
    const parts = SPLIT_VOWELS.get(cp) ?? decompositions.get(cp);

    if (!parts) return null;
    const path = new Set(seen).add(cp);
    const out: number[] = [];

    for (const part of parts) {
      const sub = decompose(part, path);

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
      protectedAt[i] || hasGlyph(cp) || (!decompositions.has(cp) && !SPLIT_VOWELS.has(cp))
        ? null
        : decompose(cp);

    for (const part of parts ?? [cp]) {
      cps.push(part);
      cpClusters.push(clusters[i]!);
      locked.push(protectedAt[i]!);
    }
  }

  // Sort each run of unlocked nonzero-class code points by shaping rank
  // (MarkOrder.ts), stably, or by AMTRA in an Arabic run. Decided once
  // here, on the decomposed sequence, before anything composes.
  const arabic = new Array<boolean>(cps.length).fill(false);

  for (let start = 0; start < cps.length;) {
    if (locked[start] || combiningClass(cps[start]!) === 0) {
      start++;
      continue;
    }

    let end = start + 1;

    while (end < cps.length && !locked[end] && combiningClass(cps[end]!) !== 0) {
      end++;
    }

    const isArabic = isArabicRun(cps, start, end);

    if (isArabic) arabic.fill(true, start, end);

    if (end - start > 1) {
      const members = cps.slice(start, end);
      const keys = isArabic ? arabicKeys(members) : members.map(shapingRank);

      const run = members.map((cp, k) => ({
        cp,
        cluster: cpClusters[start + k]!,
        key: keys[k]!,
      }));

      run.sort((a, b) => a.key - b.key);
      run.forEach(({ cp, cluster }, k) => {
        cps[start + k] = cp;
        cpClusters[start + k] = cluster;
      });
    }

    start = end;
  }

  const out: number[] = [];
  const outClusters: number[] = [];
  let starter = -1; // index in out of the open starter, -1 if none
  let blockedByZero = false;
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
    // between (all nonzero classes other than its own). In an Arabic run it
    // must follow the starter directly: consumed marks are gone from out,
    // and any mark left there blocks.
    const reaches = arabic[i] ? starter === out.length - 1 : !classesBetween.has(cls);

    if (mark && cls !== 0 && starter >= 0 && !blockedByZero && reaches) {
      const base = out[starter]!;

      const composite =
        compositions.get(base)?.get(cp) ??
        (hebrewPresentationForms ? hebrewForms.get(base)?.get(cp) : undefined);

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
      classesBetween.clear();
    } else if (cls === 0) {
      blockedByZero = true;
    } else {
      classesBetween.add(cls);
    }
  }

  return { codePoints: out, clusters: outClusters };
}
