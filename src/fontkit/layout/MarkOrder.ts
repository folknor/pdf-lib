// Shaping ranks for the mark reorder in CanonicalCompose.ts.
//
// Within a run of marks with nonzero combining class, marks are stably
// sorted by rank. A rank is the canonical combining class except where fonts
// and the USE grammar are built for another order; every exception below is
// a reorder between marks of different nonzero classes, so it stays
// canonically equivalent. The data is stated against Unicode 8, the version
// of canonicalData.ts, and is edited by hand here (there is no upstream file
// to generate it from): a new entry needs a test showing the order a font or
// the shaper grammar consumes.
//
// Hebrew and Arabic are not ranked yet. Their fonts expect orders a plain
// class sort breaks (dagesh and shin/sin dots before the vowels; shadda
// first and modifier marks promoted per UTR #53), with contextual exceptions
// on top, so a run they touch is frozen: left as typed, composed by the
// classic rule (see isFrozenRun).

import { getScript, isMark } from '../../vendors/unicode-properties/index.js';
import { combiningClass } from './CanonicalCompose.js';

const RANK_OVERRIDES = new Map<number, number>([
  // Thai SARA U, SARA UU (103) before PHINTHU (9).
  [0x0e38, 3],
  [0x0e39, 3],
  // Telugu length marks (84, 91) before the virama (9).
  [0x0c55, 4],
  [0x0c56, 5],
  // Tibetan TSA -PHRU (216) before AA (129) and the vowel signs: AA is a
  // nukta (CMBlw) in the USE trie and TSA -PHRU a CMAbv, and the grammar
  // takes CMAbv before CMBlw.
  [0x0f39, 128],
  // Tibetan PADMA GDAN (220) and Tai Tham SAKOT (9) last in their run.
  [0x0fc6, 255],
  [0x1a60, 255],
]);

/** The rank a mark is sorted by; ccc unless overridden. */
export const shapingRank = (cp: number): number =>
  RANK_OVERRIDES.get(cp) ?? combiningClass(cp);

// Hebrew points and accents, and Arabic marks, listed by code point because
// many are Script=Inherited (fatha, damma, shadda, hamza above).
const FROZEN_MARKS: [number, number][] = [
  [0x0591, 0x05c7],
  [0xfb1e, 0xfb1e],
  [0x0610, 0x061a],
  [0x064b, 0x065f],
  [0x0670, 0x0670],
  [0x06d6, 0x06dc],
  [0x06df, 0x06e4],
  [0x06e7, 0x06e8],
  [0x06ea, 0x06ed],
  [0x08e3, 0x08ff],
];

const isFrozenMark = (cp: number) =>
  FROZEN_MARKS.some(([a, b]) => cp >= a && cp <= b);

const FROZEN_SCRIPTS = new Set(['Hebrew', 'Arabic']);

/**
 * Whether the run cps[start..end) is left as typed: a member is a Hebrew or
 * Arabic mark, or the nearest non-mark before it (looking past every mark,
 * CGJ included) is Hebrew or Arabic.
 */
export function isFrozenRun(cps: number[], start: number, end: number) {
  for (let i = start; i < end; i++) if (isFrozenMark(cps[i]!)) return true;
  let base = start - 1;
  while (base >= 0 && isMark(cps[base]!)) base--;
  return base >= 0 && FROZEN_SCRIPTS.has(getScript(cps[base]!));
}
