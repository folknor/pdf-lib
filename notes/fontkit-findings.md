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

## WOFF and WOFF2 decompression is not covered by the decode cap

`WOFFFont._decompress` allocates one buffer sized from the sum of the table
directory's `length` fields (each an untrusted uint32) and inflates each table
into a buffer of its declared length. Nothing checks these against
`DecodeStream.maxDecodedSize` or the document's `maxDecodedStreamSize`, so a
small WOFF passed to `embedFont` can request gigabytes. PNG embedding applies
that cap to header-derived sizes before inflating (`src/vendors/upng.ts`);
fonts would need the same check on the summed table lengths, with the limit
threaded through `embedFont`. WOFF2 (brotli) was not inspected for the same
shape.

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
