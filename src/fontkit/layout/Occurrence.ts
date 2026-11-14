// What one glyph occurrence stands for, carried through every substitution
// (GlyphInfo for OpenType, MorxGlyph for AAT). Each transformation builds the
// new occurrence with one of the functions below, so the rules live here once
// (see Clusters.ts for what a cluster is).

export interface Occurrence {
  /** Code points shaped as (GlyphRun.codePoints). */
  codePoints: number[];
  /** Code points contributed to extracted text (GlyphRun.text). */
  text: number[];
  /** Source cluster: UTF-16 offset into the laid-out string. */
  cluster: number;
  /**
   * Ligature components: 1 for anything that is not a GSUB ligature, the
   * sum of its components' counts for one.
   */
  components: number;
}

/** A glyph mapped from code points. */
export const mapped = (codePoints: number[], cluster: number): Occurrence => ({
  codePoints,
  text: [...codePoints],
  cluster,
  components: 1,
});

/** One piece of a split (decomposition, multiple substitution). */
export const piece = (parent: Occurrence, codePoints: number[]): Occurrence =>
  mapped(codePoints, parent.cluster);

/** A glyph inserted into the cluster `cluster`, standing for no text. */
export const inserted = (codePoints: number[], cluster: number): Occurrence => ({
  codePoints,
  text: [],
  cluster,
  components: 1,
});

/** A GSUB or morx ligature of `parts`, in order. */
export const ligated = (parts: readonly Occurrence[]): Occurrence => ({
  codePoints: parts.flatMap((part) => part.codePoints),
  text: parts.flatMap((part) => part.text),
  cluster: Math.min(...parts.map((part) => part.cluster)),
  components: parts.reduce((sum, part) => sum + part.components, 0),
});

/** A character composed from `parts` (Hangul syllable): not a ligature. */
export const composed = (parts: readonly Occurrence[], codePoints: number[]): Occurrence =>
  mapped(codePoints, Math.min(...parts.map((part) => part.cluster)));

export const copyOccurrence = (occurrence: Occurrence): Occurrence => ({
  codePoints: [...occurrence.codePoints],
  text: [...occurrence.text],
  cluster: occurrence.cluster,
  components: occurrence.components,
});
