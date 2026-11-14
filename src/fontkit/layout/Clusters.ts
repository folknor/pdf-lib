// Source clusters: which part of the text given to layout() each glyph came
// from. A cluster value is a UTF-16 offset into that string; every glyph
// carries the offset where its cluster starts, and after layout the values
// are monotone in glyph order (GlyphRun.clusters), so a cluster's text is the
// slice from its value to the next larger value in the run (or the end).
//
// Rules, each applied once where the transformation happens:
// - Before shaping, a character's code points share one cluster: a code
//   point that continues the previous character (continuesCharacter) takes
//   its cluster.
// - A code point or glyph split into several keeps its parent's cluster on
//   every piece; anything composed or ligated takes the smallest cluster of
//   what it consumed, and so does every glyph a ligature skipped over; an
//   inserted glyph takes the cluster of the syllable or glyph it was
//   inserted into; a deleted glyph is dropped, and its text falls to the
//   cluster before it (or the first one).
// - After substitution, mergeClusters joins whatever reordering moved past
//   each other into one cluster.

import { isMark } from '../../vendors/unicode-properties/index.js';

/** Default-ignorable code points (DerivedCoreProperties), minus U+115F,
 * U+1160, U+3164 and U+FFA0, as Harfbuzz and Uniscribe do. */
export function isDefaultIgnorable(ch: number): boolean {
  const plane = ch >> 16;
  if (plane === 0) {
    switch (ch >> 8) {
      case 0x00:
        return ch === 0x00ad;
      case 0x03:
        return ch === 0x034f;
      case 0x06:
        return ch === 0x061c;
      case 0x17:
        return 0x17b4 <= ch && ch <= 0x17b5;
      case 0x18:
        return 0x180b <= ch && ch <= 0x180e;
      case 0x20:
        return (
          (0x200b <= ch && ch <= 0x200f) ||
          (0x202a <= ch && ch <= 0x202e) ||
          (0x2060 <= ch && ch <= 0x206f)
        );
      case 0xfe:
        return (0xfe00 <= ch && ch <= 0xfe0f) || ch === 0xfeff;
      case 0xff:
        return 0xfff0 <= ch && ch <= 0xfff8;
      default:
        return false;
    }
  }
  switch (plane) {
    case 0x01:
      return (
        (0x1bca0 <= ch && ch <= 0x1bca3) || (0x1d173 <= ch && ch <= 0x1d17a)
      );
    case 0x0e:
      return 0xe0000 <= ch && ch <= 0xe0fff;
    default:
      return false;
  }
}

type Jamo = 'L' | 'V' | 'T' | 'LV' | 'LVT' | null;

const jamo = (cp: number): Jamo => {
  if ((cp >= 0x1100 && cp <= 0x115f) || (cp >= 0xa960 && cp <= 0xa97c))
    return 'L';
  if ((cp >= 0x1160 && cp <= 0x11a7) || (cp >= 0xd7b0 && cp <= 0xd7c6))
    return 'V';
  if ((cp >= 0x11a8 && cp <= 0x11ff) || (cp >= 0xd7cb && cp <= 0xd7fb))
    return 'T';
  if (cp >= 0xac00 && cp <= 0xd7a3)
    return (cp - 0xac00) % 28 === 0 ? 'LV' : 'LVT';
  return null;
};

const isRegionalIndicator = (cp: number) => cp >= 0x1f1e6 && cp <= 0x1f1ff;

/**
 * Whether `codePoints[i]` continues the character before it rather than
 * starting one: a mark, a default-ignorable (joiners, variation selectors),
 * an emoji modifier, the second regional indicator of a flag, or a Hangul
 * jamo that continues a syllable (L after L; V after L, V or LV; T after V,
 * T, LV or LVT). This is the library's own unit for clusters and character
 * spacing, close to but not the UAX #29 grapheme cluster.
 */
export function continuesCharacter(codePoints: number[], i: number): boolean {
  if (i === 0) return false;
  const cp = codePoints[i]!;
  if (isMark(cp) || isDefaultIgnorable(cp)) return true;
  if (cp >= 0x1f3fb && cp <= 0x1f3ff) return true;
  if (isRegionalIndicator(cp)) {
    let run = 0;
    for (let j = i - 1; j >= 0 && isRegionalIndicator(codePoints[j]!); j--) {
      run++;
    }
    return run % 2 === 1;
  }
  const type = jamo(cp);
  if (type === null || type === 'LV' || type === 'LVT') return false;
  const before = jamo(codePoints[i - 1]!);
  if (type === 'L') return before === 'L';
  if (type === 'V') return before === 'L' || before === 'V' || before === 'LV';
  return (
    before === 'V' || before === 'T' || before === 'LV' || before === 'LVT'
  );
}

/**
 * The code points of `string` with each one's initial cluster (the offset
 * of the character it belongs to), and the offsets where characters that
 * take character spacing start: every character start, plus a continuer
 * with no countable character before it (a leading mark, or the A of
 * ZWJ A), but never a default-ignorable.
 */
export function initialClusters(string: string): {
  codePoints: number[];
  clusters: number[];
  characters: number[];
} {
  const codePoints: number[] = [];
  const offsets: number[] = [];
  for (let at = 0; at < string.length; ) {
    const cp = string.codePointAt(at)!;
    codePoints.push(cp);
    offsets.push(at);
    at += cp > 0xffff ? 2 : 1;
  }
  const clusters: number[] = [];
  const characters: number[] = [];
  let counted = false;
  for (let i = 0; i < codePoints.length; i++) {
    const continues = continuesCharacter(codePoints, i);
    clusters.push(continues ? clusters[i - 1]! : offsets[i]!);
    if (!continues) counted = false;
    if (!counted && !isDefaultIgnorable(codePoints[i]!)) {
      characters.push(offsets[i]!);
      counted = true;
    }
  }
  return { codePoints, clusters, characters };
}

/**
 * Makes per-glyph cluster values monotone: glyphs i and i+1 stay in separate
 * clusters only when everything up to i comes before everything after it
 * (ascending; `descending` for runs already in reversed order), otherwise
 * they merge into one cluster with the smallest value. The smallest cluster
 * becomes 0, so text deleted from the start still belongs to a cluster.
 */
export function mergeClusters(clusters: number[], descending = false): void {
  const n = clusters.length;
  if (n === 0) return;
  const order = descending ? [...clusters].reverse() : clusters;
  const suffixMin = new Array<number>(n);
  let min = Infinity;
  for (let i = n - 1; i >= 0; i--) {
    min = Math.min(min, order[i]!);
    suffixMin[i] = min;
  }
  let start = 0;
  let max = -Infinity;
  let groupMin = Infinity;
  for (let i = 0; i < n; i++) {
    max = Math.max(max, order[i]!);
    groupMin = Math.min(groupMin, order[i]!);
    if (i === n - 1 || max < suffixMin[i + 1]!) {
      const value = start === 0 ? 0 : groupMin;
      for (let j = start; j <= i; j++) order[j] = value;
      start = i + 1;
      groupMin = Infinity;
    }
  }
  if (descending) {
    for (let i = 0; i < n; i++) clusters[i] = order[n - 1 - i]!;
  }
}
