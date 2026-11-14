// Shaping order for the mark reorder in CanonicalCompose.ts.
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
// Arabic runs are ordered by UAX #53's AMTRA instead (arabicKeys).
//
// Hebrew keeps its classes apart from holam. Two Hebrew ranks were proposed
// and refused on evidence. Moving dagesh and the shin/sin dots before the
// vowels: Noto Sans Hebrew is order-independent, Noto Serif Hebrew only
// ligates VAV + SHIN DOT when the dot follows the vav directly, and DejaVu
// Sans classes holam and the shin/sin dots as base glyphs in GDEF, so every
// mark after them loses its attachment; promoting the dots would unposition
// dagesh and the vowels under every pointed shin there. A patah/qamats +
// sheva/hiriq + meteg swap: no font among those three consumes it and no
// public source for it was found.

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
  // Tibetan U (132) before I/E/O (130), but after AA (129). The USE
  // positional overrides in gen-use-trie.mjs classify U as VAbv and the
  // other vowels as VBlw; the grammar consumes VAbv before VBlw.
  [0x0f74, 129.5],
  // Tibetan HALANTA (9) follows the vowels (VBlw in the USE trie).
  // Before U it terminates the vowel group and breaks U into a new cluster.
  // Noto Serif Tibetan attaches it after KA+U at (-364, -472); repeated
  // U/I/E keep stable order and stack through the font's mark attachment.
  [0x0f84, 131],
  // Tibetan PADMA GDAN (220) and Tai Tham SAKOT (9) last in their run.
  [0x0fc6, 255],
  [0x1a60, 255],
  // Hebrew HOLAM, HOLAM HASER FOR VAV (19) after dagesh (21), meteg (22) and
  // rafe (23), before the shin/sin dots (24, 25): DejaVu Sans classes holam
  // as a base glyph, so a dagesh, meteg or rafe after it is never attached.
  // Accents and varika can still follow a base-classed point.
  [0x05b9, 23.5],
  [0x05ba, 23.5],
]);

/** The rank a mark is sorted by outside Arabic runs; ccc unless overridden. */
export const shapingRank = (cp: number): number =>
  RANK_OVERRIDES.get(cp) ?? combiningClass(cp);

// Arabic marks, listed by code point because many are Script=Inherited
// (fatha, damma, shadda, hamza above).
const ARABIC_MARKS: [number, number][] = [
  [0x0610, 0x061a],
  [0x064b, 0x065f],
  [0x0670, 0x0670],
  [0x06d6, 0x06dc],
  [0x06df, 0x06e4],
  [0x06e7, 0x06e8],
  [0x06ea, 0x06ed],
  [0x08e3, 0x08ff],
];

const isArabicMark = (cp: number) =>
  ARABIC_MARKS.some(([a, b]) => cp >= a && cp <= b);

/**
 * Whether the run cps[start..end) is ordered and composed as Arabic: the
 * nearest non-mark before it (looking past every mark, CGJ included) is
 * Arabic, or a member is an Arabic mark (a bare run, or one on a dotted
 * circle).
 */
export function isArabicRun(cps: number[], start: number, end: number) {
  let base = start - 1;
  while (base >= 0 && isMark(cps[base]!)) base--;
  if (base >= 0 && getScript(cps[base]!) === 'Arabic') return true;
  for (let i = start; i < end; i++) if (isArabicMark(cps[i]!)) return true;
  return false;
}

// Modifier_Combining_Mark (PropList.txt 18.0.0), the members present in the
// Unicode 8 data; the others (U+08CA..08CB, 08CD..08CF, 08D3, 10EF4, 10EF6,
// 10EF9) have class 0 there and bound runs instead.
const MODIFIER_COMBINING_MARKS = new Set([
  0x0654, 0x0655, 0x0658, 0x06dc, 0x06e3, 0x06e7, 0x06e8, 0x08f3,
]);

/**
 * Sort keys giving UAX #53 AMTRA order (Unicode 18.0.0 revision) for the
 * run `cps` in typed order: canonical order, then shadda (class 33) moved to
 * the start, then the MCMs leading the class-230 marks before it, then the
 * MCMs leading the class-220 marks before those. "Leading" is judged on the
 * typed order within the class, which a stable class sort keeps, so MADDAH +
 * HAMZA ABOVE (both 230) promotes nothing.
 */
export function arabicKeys(cps: number[]): number[] {
  const classes = cps.map(combiningClass);
  const promoted = new Array<boolean>(cps.length).fill(false);
  for (const cls of [220, 230]) {
    for (let i = 0; i < cps.length; i++) {
      if (classes[i] !== cls) continue;
      if (!MODIFIER_COMBINING_MARKS.has(cps[i]!)) break;
      promoted[i] = true;
    }
  }
  return classes.map((cls, i) =>
    promoted[i] ? (cls === 220 ? -3 : -2) : cls === 33 ? -1 : cls,
  );
}
