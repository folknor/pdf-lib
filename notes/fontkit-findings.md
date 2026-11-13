# fontkit findings

Open findings about the vendored fontkit (`src/fontkit`). Each entry stands
alone; remove it when it is fixed or ruled against (leaving a comment at the
code site in the second case).

## Empty glyphs keep their default advance under gvar without HVAR

`TTFGlyph._decode` returns null for a glyph with no glyf data, and
`TTFGlyph._applyVariation` skips `numberOfContours === 0`. Neither path runs
the four phantom points through `GlyphVariationProcessor`, so in a variable
TrueType font with no HVAR table a varied empty glyph (typically space) keeps
its default advance width. Upstream fontkit behaves the same. A fix would need
to vary phantom points for empty glyphs, with base metrics taken from hmtx
rather than from a glyf header that does not exist (`_getCBox(true)` on an
empty TTF glyph reads the next glyph's header).

## CFF2 fonts subset through TTFSubset

`TTFFont.createSubset` picks `CFFSubset` only for a `CFF ` table; a CFF2 font
falls through to `TTFSubset`, which reads glyf/loca the font does not have.
Subsetting CFF2 (variable OpenType) fonts is therefore unsupported, varied or
not.
