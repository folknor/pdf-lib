# fontkit findings

Open findings about the vendored fontkit (`src/fontkit`). Each entry stands
alone; remove it when it is fixed or ruled against (leaving a comment at the
code site in the second case).

## Static TrueType outlines are not placed at their left origin

A variation instance's outline is translated by its resolved left phantom
point (`TTFGlyph._getContours`), but a static font's path and cbox stay in
glyf coordinates. Where a glyph's hmtx lsb differs from its glyf xMin, FreeType
and HarfBuzz draw it at xMin - lsb to the left of where `glyph.path` puts it
(and an instance at the default coordinates differs from the static font).
Static subsets copy glyf and hmtx as they are, so the embedded font is
unaffected; the fix needs its own rule for the header cbox (static
`_getCBox` reads the glyf header) and for flattened static WOFF2 glyphs
(`TTFSubset` writes the source lsb), which pdf.js draws untranslated while a
TTF copy of the same font keeps its original bytes.

## COLR glyphs report unvaried metrics

`COLRGlyph` inherits `Glyph._getMetrics` instead of asking its base outline
glyph, so in a variable colour font without HVAR the COLR wrapper keeps the
hmtx advance while the outline glyph (and so the subset) has the varied one.

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

## Encoded sfnt directories are not well-formed

`tables/directory.ts` writes every table record with a zero checksum, in the
insertion order of the tables object rather than sorted by tag, under the
`true` sfnt tag rather than `0x00010000`, and the cloned `head` keeps the
source's `checkSumAdjustment`. PDF viewers accept this, but strict sfnt
validators (OTS, the OpenType spec) do not.

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
