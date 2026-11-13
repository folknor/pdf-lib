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
rather than from a glyf header that does not exist (`_getCBox(true)` returns
a zero box for an empty TTF glyph).

## WOFF2 brotli decoding is not bounded by the decode cap

`WOFF2Font._decompress` checks the declared table space against the cap, but
the `brotli` package's `decompress` enlarges its output buffer whenever a
meta-block declares more data than fits (`dec/decode.js`, the growth before
each meta-block), ignoring the size it was given. A meta-block of up to
16 MiB costs a few compressed bytes, so a small WOFF2 can still expand to
gigabytes. The package exports no hook or limit. Closing this needs a brotli
decoder with an output limit: vendoring the package's decoder (Apache-2.0
Google code, a licensing call under LLM.md) or a clean-room decoder written
by a session that has not read it. WOFF is fully bounded (fflate never grows
the caller's buffer).

## CFF2 fonts subset through TTFSubset

`TTFFont.createSubset` picks `CFFSubset` only for a `CFF ` table; a CFF2 font
falls through to `TTFSubset`, which reads glyf/loca the font does not have.
Subsetting CFF2 (variable OpenType) fonts is therefore unsupported, varied or
not.

## Bitmap glyphs are never drawn in the PDF

A CBDT/EBDT bitmap-only font embeds (whole or subset) as a TrueType font whose
glyphs are empty: PDF draws TrueType from glyf, so emoji text is invisible but
correctly spaced and extractable. Drawing it would take a different embedding:
a Type3 font whose glyph procedures paint the CBDT PNG (or EBDT bitmap) for
each glyph, which needs CBLC/CBDT payload decoding that fontkit lacks
(`tables/EBDT.ts` and `EBLC.ts` parse only the index). sbix and COLR fonts
draw their outlines, not their colour images or layers, for the same reason;
`COLRGlyph` path/cbox/bbox report that base outline, not the layer artwork.

## sbix fonts without glyf have no usable glyphs

`SBIXGlyph` extends `TTFGlyph`, so its metrics (`_getMetrics` -> `_getCBox`)
read the glyf table. In an sbix font with no glyf table, layout and width
measurement fail, and `TTFSubset` refuses such fonts with an error. Fixing it
means giving `SBIXGlyph` hmtx-based metrics when glyf is absent, as `CBDTGlyph`
has, after which `TTFSubset._outlineless` can accept it.
