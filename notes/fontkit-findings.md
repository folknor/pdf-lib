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

## Mark reordering covers neither Hebrew/Arabic nor split vowels

`composeCanonical` now sorts each run of nonzero-class marks by shaping rank
(`MarkOrder.ts`) before composing, but three parts remain (plan and rulings
in notes/mark-reorder-design.md):

- Hebrew and Arabic runs are frozen as typed. They need their own ranks
  (Hebrew dagesh and shin/sin dots before the vowels; Arabic shadda first
  and modifier-mark promotion per UTR #53, whose mark set postdates the
  Unicode 8 data), the Hebrew patah/qamats + sheva/hiriq + meteg swap on the
  sorted order, UTR #53's ban on composing across marks, and the Hebrew
  FB1D-FB4F presentation-form composition for fonts with no GPOS `mark`
  (those forms are composition exclusions). A `hebr` shaper class (as the
  cantoo fontkit fork added) was refused: it is unreachable for fonts with
  no `hebr` script record or no layout tables.
- The split-vowel decompositions `UniversalShaper` and `IndicShaper` do ad
  hoc run after the stage, so their parts are never sorted (KA + a mapped
  U+0F73 + TSA -PHRU is still a broken cluster), they skip the glyph check,
  and they can expand a character a variation selector addresses.
- Tibetan U keeps its class (after the other vowels), because the trie's
  categories accept only canonical KA E U; ranking U first goes together
  with the specification's positional overrides (I/E/O below, U above) left
  out of `scripts/gen-use-trie.mjs`.

## USE shaper crashes on a glyph outside every syllable

`UniversalShaper.reorder` and `nextSyllable` read `shaperInfo` of every
glyph, but `setupSyllables` only sets it on glyphs the cluster state machine
matched. Noto Serif Tibetan with KA + I + CGJ + AA throws "Cannot read
properties of null (reading 'syllable')" from `nextSyllable`. Unmatched
glyphs need a shaper info of their own (a non-cluster).

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
`LayoutEngine.layout`, as a glyph-level step after cmap mapping. The swap
must keep each occurrence's code points (`GlyphRun.codePoints`/`text`):
ToUnicode maps an encoded glyph to the text it was drawn for, so the PUA
glyphs then extract as the Thai marks, not as the private-use code points
the cmap maps to them.

## sbix fonts without glyf have no usable glyphs

`SBIXGlyph` extends `TTFGlyph`, so its metrics (`_getMetrics` -> `_getCBox`)
read the glyf table. In an sbix font with no glyf table, layout and width
measurement fail, and `TTFSubset` refuses such fonts with an error. Fixing it
means giving `SBIXGlyph` hmtx-based metrics when glyf is absent, as `CBDTGlyph`
has, after which `TTFSubset._outlineless` can accept it.
