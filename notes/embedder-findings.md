# embedder findings

Open findings about the font embedders (`src/core/embedders`). Each entry
stands alone; remove it when it is fixed or ruled against (leaving a comment
at the code site in the second case).

## FontFile2 streams lack Length1

`CustomFontEmbedder.embedFontStream` writes the TrueType font stream with no
`/Length1` (the decoded font program's length), which ISO 32000-1 Table 127
requires for FontFile2. Viewers tolerate its absence; validators flag it.

## FontDescriptor FontBBox comes from the source font

`CustomFontEmbedder.embedFontDescriptor` takes `FontBBox` from
`this.font.bbox`, the source font's head box. A variation instance, a
converted CFF2 font, or a subset embeds outlines whose extents differ; the
encoded subset's head (recomputed by `TTFSubset._updateExtents` when glyphs
are re-encoded) holds the real box.
