// Shaping decompositions not in canonicalData.ts, moved from the Indic/USE
// shapers. Canonical split vowels already live in DECOMPOSITIONS.
// Like those, these are used only when the original is unmapped and every
// part maps. Khmer splits contain the original itself, so no fully mapped
// fallback exists when it is absent: retain the typed character in that case.
// Balinese LA LENGA TEDUNG is also a shaping-only split.
// Thai/Lao SARA AM has its script-specific stage in ThaiSaraAm.ts.
// Tibetan vocalic RR/LL are compatibility decompositions, not canonical ones.
export const SPLIT_VOWELS = new Map<number, number[]>([
  [0x17be, [0x17c1, 0x17be]],
  [0x17bf, [0x17c1, 0x17bf]],
  [0x17c0, [0x17c1, 0x17c0]],
  [0x17c4, [0x17c1, 0x17c4]],
  [0x17c5, [0x17c1, 0x17c5]],
  [0x1b3d, [0x1b3c, 0x1b35]],
  [0x0f77, [0x0fb2, 0x0f71, 0x0f80]],
  [0x0f79, [0x0fb3, 0x0f71, 0x0f80]],
]);
