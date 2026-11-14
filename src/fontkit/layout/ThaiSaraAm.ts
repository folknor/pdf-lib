// Thai and Lao SARA AM decomposition, the one Thai shaping rule that applies
// whatever tables the font has (Uniscribe and HarfBuzz both do it): SARA AM
// becomes NIKHAHIT + SARA AA, and the NIKHAHIT moves back over the above-base
// marks right before it, so <DO DEK, MAI CHATTAWA, SARA AM> is shaped as
// <DO DEK, NIKHAHIT, MAI CHATTAWA, SARA AA>. Thai fonts are built for that
// order: Noto Sans Thai, for one, picks its small tone-mark alternate only
// when the tone follows the nikhahit, and that substitution reaches the PDF
// even though GPOS positioning does not.
//
// It runs on code points before cmap mapping, so it does not depend on the
// font having an OpenType engine or a thai/lao script record. It is not
// canonical normalisation (U+0E33 has only a compatibility decomposition).
//
// Not done: the PUA fallback HarfBuzz applies to Thai fonts with no Thai
// GSUB (marks swapped for Windows/Mac private-use variants); see
// notes/fontkit-findings.md.

// Lao code points are the Thai ones + 0x80.
const isSaraAm = (cp: number) => cp === 0x0e33 || cp === 0x0eb3;

const isAboveBaseMark = (cp: number) => {
  const u = cp & ~0x0080;

  return (
    u === 0x0e31 ||
    (u >= 0x0e34 && u <= 0x0e37) ||
    u === 0x0e3b ||
    (u >= 0x0e47 && u <= 0x0e4e)
  );
};

const isVariationSelector = (cp: number | undefined) =>
  cp !== undefined &&
  ((cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef));

/**
 * Rewrites every SARA AM in `codePoints` whose two components the font maps
 * (`hasGlyph`). A SARA AM the font cannot decompose keeps its precomposed
 * glyph, and one followed by a variation selector is left composed, since
 * the selector addresses the SARA AM. Both parts keep the SARA AM's
 * cluster (`clusters`, one per code point), so the moved NIKHAHIT later
 * merges the marks it moved past into that cluster (mergeClusters).
 */
export function decomposeSaraAm(
  codePoints: number[],
  hasGlyph: (cp: number) => boolean,
  clusters: number[] = codePoints.map((_, i) => i),
): { codePoints: number[]; clusters: number[] } {
  const out: number[] = [];
  const outClusters: number[] = [];

  for (let i = 0; i < codePoints.length; i++) {
    const cp = codePoints[i]!;
    const cluster = clusters[i]!;
    const lao = cp & 0x0080;

    if (
      !isSaraAm(cp) ||
      isVariationSelector(codePoints[i + 1]) ||
      !hasGlyph(0x0e4d | lao) ||
      !hasGlyph(0x0e32 | lao)
    ) {
      out.push(cp);
      outClusters.push(cluster);
      continue;
    }

    // Only a NIKHAHIT generated here moves; a typed one stays where it is.
    let at = out.length;

    while (at > 0 && isAboveBaseMark(out[at - 1]!)) at--;
    out.splice(at, 0, 0x0e4d | lao);
    outClusters.splice(at, 0, cluster);
    out.push(0x0e32 | lao);
    outClusters.push(cluster);
  }

  return { codePoints: out, clusters: outClusters };
}
