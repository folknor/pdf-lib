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

Tibetan needs it too. U+0F71 (AA) is a nukta (CMBlw) in the USE category
trie, so AA must precede any vowel sign: canonical order works, but a
vowel sign typed before AA (KA + I + AA) is a broken cluster. A canonical
sort would cure that; it would not cure KA + AA + U+0F39 (TSA -PHRU), which
is already canonical yet B CMBlw CMAbv, a broken cluster in the grammar -
that needs a USE-specific move of TSA -PHRU before the vowels (font-tools
issue 22). The specification's Tibetan positional overrides (I/E/O below,
U above) were left out of `scripts/gen-use-trie.mjs` because they break
canonical U + E; with a reorder stage in place they can be reconsidered.

## The USE data and grammar are fontkit-era

`use.ts` (category list and compiled cluster DFA) is fontkit's, older than
the current USE specification, and `trieUse.ts` is built from Unicode 12
with fontkit's hand override tables plus a reviewed Tibetan subset of the
specification's override files (microsoft/font-tools USE/
IndicSyllabicCategory-Additional.txt, IndicPositionalCategory-Additional.txt).
The rest of those overrides cannot be layered on: they are written for the
current grammar and UCD, and applied to ours they produce a class use.ts
lacks (Duployan U+1BC9D-1BC9E derive a bare CM), hieroglyph classes, or a
grammar mismatch (Balinese musical symbols become CM, which the old symbol
cluster S SM* rejects); Unicode itself has since reclassified characters
(Batak U+1BF2-1BF3 into Reordering_Killer, a class the grammar lacks). So
every other USE script still shapes without the specification's overrides,
the visarga override (U+0F7F independent) is out too (font-tools issue 19: a
following U+0FC6 then breaks), and Egyptian hieroglyph clusters do not
exist. The fix is one versioned unit: the current specification grammar
compiled to a new DFA (no compiler is vendored; the `dfa` package's runtime
only), the current UCD, and the current override files, regenerated
together, with `UniversalShaper` taught the new classes (RK, hieroglyph
classes).

## Right-to-left is whole-run reversal, not bidi

`LayoutEngine.layout` picks one script per string (`Script.forString`) and
`OTLayoutEngine.position` reverses the whole run when it is right-to-left.
Mixed Hebrew or Arabic with Latin or digits comes out with the left-to-right
parts reversed too, and fonts with no GSUB/GPOS (no OT engine) are never
reversed. Proper output needs bidi resolution into runs before shaping.

The same one-script choice limits the Thai/Lao SARA AM decomposition
(`layout/ThaiSaraAm.ts`): it runs only when the whole string is detected as
Thai or Lao, so Thai after Latin in one string ("Latin น้ำ") is not
decomposed, and shaping then depends on where a caller splits runs.

## Thai fonts without Thai GSUB get no PUA fallback

HarfBuzz shapes Thai for fonts that have no Thai GSUB by swapping marks (and
the descenders of YO YING and THO THAN) for the Windows or Mac private-use
variants such fonts carry, chosen by small state machines over each cluster's
stack of above and below marks. fontkit does not, so legacy Thai fonts draw
every tone and vowel mark at its default height. Most of those fonts have no
layout tables at all, so this cannot be an OpenType shaper class (no OT
engine runs for them); it belongs next to the SARA AM rewrite in
`LayoutEngine.layout`, as a glyph-level step after cmap mapping. PDF text
extraction needs care: the PUA glyphs are cmap-mapped to PUA code points, so
under the current ToUnicode policy (notes/embedder-findings.md) the swapped
marks would extract as private-use characters.

## Lookup mark filtering sets and alternate choice are ignored

`tables/opentype.ts` decodes a lookup's `useMarkFilteringSet` and
`markFilteringSet`, but `GlyphIterator` has no notion of them: a lookup that
should skip every mark outside a GDEF mark glyph set sees all marks instead,
so contextual and mark lookups in fonts that rely on filtering sets can miss
or misfire. Fixing it means `OTProcessor.applyLookups` and `applyLookupList`
passing the set to the iterator and `shouldIgnore` consulting GDEF
`markGlyphSetsDef`. Separately, GSUB type 3 (`GSUBProcessor`) always picks
the first alternate; there is no caller-facing way to choose another.

## sbix fonts without glyf have no usable glyphs

`SBIXGlyph` extends `TTFGlyph`, so its metrics (`_getMetrics` -> `_getCBox`)
read the glyf table. In an sbix font with no glyf table, layout and width
measurement fail, and `TTFSubset` refuses such fonts with an error. Fixing it
means giving `SBIXGlyph` hmtx-based metrics when glyf is absent, as `CBDTGlyph`
has, after which `TTFSubset._outlineless` can accept it.
