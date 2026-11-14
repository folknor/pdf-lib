# fontkit findings

Open findings about the vendored fontkit (`src/fontkit`). Each entry stands
alone; remove it when it is fixed or ruled against (leaving a comment at the
code site in the second case).

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

## Bitmap glyphs are never drawn in the PDF

A CBDT/EBDT bitmap-only font embeds (whole or subset) as a TrueType font whose
glyphs are empty: PDF draws TrueType from glyf, so emoji text is invisible but
correctly spaced and extractable. Drawing it would take a different embedding:
a Type3 font whose glyph procedures paint the CBDT PNG (or EBDT bitmap) for
each glyph, which needs CBLC/CBDT payload decoding that fontkit lacks
(`tables/EBDT.ts` and `EBLC.ts` parse only the index). sbix and COLR fonts
draw their outlines, not their colour images or layers, for the same reason;
`COLRGlyph` path/cbox/bbox report that base outline, not the layer artwork.

## PDF text drops all GPOS positioning

`CustomFontEmbedder.encodeText` keeps only the glyph ids of `font.layout()`;
text is shown with `Tj` and each glyph advances by its `/W` width. GPOS
kerning, mark attachment (Hebrew points, Arabic harakat, Indic reph and
matra offsets, Tibetan stacks) and cursive attachment never reach the PDF, so
every mark is drawn at its glyph's default place. `widthOfTextAtSize` measures
the same unpositioned advances, so it agrees with what is drawn. Honouring
positions means emitting the x adjustments (`TJ` numbers) and y offsets (text
rise, `Ts`, or per-glyph positioning), and measuring with the positioned
advances; line breaking, alignment and form field appearances all measure
through that one function. Most of the value of mark reordering (the Hebrew
reorder below) is in GPOS attachment, so it pays little until this lands.

## No normalisation stage before shaping

fontkit shapes code points as given: no canonical composition or
decomposition, and no sort of mark runs by combining class. HarfBuzz runs
such a stage for every font, and script shapers hook into it: Hebrew
composes base+point pairs into FB1D-FB4F presentation forms when the plan has
no GPOS `mark` (for fonts that rely on them), and swaps a patah/qamats +
sheva/hiriq + meteg run into the order fonts expect - a swap that only makes
sense after the sort. A Hebrew shaper class (as the cantoo fontkit fork and
foliojs fontkit added) was refused for that reason: the reorder without the
sort fires only on one input order, and composition inside a `hebr` shaper is
unreachable for fonts with no `hebr` script record (selection follows the
font's script list, GSUB's choice overriding GPOS's) and fonts with no
layout tables at all (no OT engine). The Hebrew compose and reorder belong as
script exceptions of this stage, together with NFC composition and the
split-vowel decompositions `UniversalShaper` and `IndicShaper` do ad hoc.

## USE categories lack the USE overrides to Unicode properties

`trieUse.ts` is generated (scripts/gen-use-trie.mjs) from the plain Unicode
Indic syllabic and positional categories. The Universal Shaping Engine
specifies overrides on top of them, and the grammar in `use.ts` relies on
them. Tibetan shows it: U+0F71 (AA) is VBlw where USE treats it as a nukta
(CMBlw), so K + U+0F71 + U+0F72 (canonical order, and the decomposition of
U+0F73) splits into a standard and a broken cluster and gets a dotted circle;
the DFA accepts B CMBlw VAbv as one cluster. Fixing it means applying the
published USE override tables in the generator and regenerating, not
widening the grammar (which every USE script shares) and not routing `tibt`
away from USE.

## Right-to-left is whole-run reversal, not bidi

`LayoutEngine.layout` picks one script per string (`Script.forString`) and
`OTLayoutEngine.position` reverses the whole run when it is right-to-left.
Mixed Hebrew or Arabic with Latin or digits comes out with the left-to-right
parts reversed too, and fonts with no GSUB/GPOS (no OT engine) are never
reversed. Proper output needs bidi resolution into runs before shaping.

## sbix fonts without glyf have no usable glyphs

`SBIXGlyph` extends `TTFGlyph`, so its metrics (`_getMetrics` -> `_getCBox`)
read the glyf table. In an sbix font with no glyf table, layout and width
measurement fail, and `TTFSubset` refuses such fonts with an error. Fixing it
means giving `SBIXGlyph` hmtx-based metrics when glyf is absent, as `CBDTGlyph`
has, after which `TTFSubset._outlineless` can accept it.
