# embedder findings

Open findings about the embedders (`src/core/embedders`) and the attachment
API built on them (`attach`, `detach`, `PDFEmbeddedFile`). Each entry stands
alone; remove it when it is fixed or ruled against (leaving a comment at the
code site in the second case).

## Mutating a document while its save is suspended is unguarded

`flush()` awaits each embeddable in turn (`PDFDocument.embedAll`), and an
embed awaits its embedder before publishing. A `detach()`, `embedFacturX()`,
`attach()` or second `save()` made during that await is not coordinated
with it: a suspended attachment that `detach()` or `embedFacturX()` dropped
from the pending list still publishes itself (or, now that duplicate names
are refused at embed time, throws out of the save); two overlapping saves
both embed the same pending item; and `embedAll` reads the live array by
an index bounded by its starting length, so a splice during the await can
skip an item or reach past the end. Sequential use is unaffected. A fix
needs a pending item that can be cancelled, embeds that are shared per item
rather than repeated, and iteration over a snapshot, or a refusal of
mutation while a flush is in progress.

## Page resource writes reach dictionaries other pages share

When a page draws, `PDFPageLeaf` adds the font, image, ExtGState or
Separation colour space to the page's `/Resources` category dictionary.
`normalize()` copies those dictionaries only when `/Resources` is inherited
from the page tree. A page whose own `/Resources` is a reference shared with
other pages (common in generated files, and preserved by `copyPages`), or
whose `/Font`, `/XObject`, `/ExtGState` or `/ColorSpace` is a shared indirect
dictionary, gets the new entry written into the shared object, so every
sharing page gains it. Keys are fresh and the entry is unused by the other
pages' content, so nothing renders differently; the cost is resources leaking
across pages (larger `copyPages` output, a surprise for anyone reading one
page's resources). A fix detaches the resources dictionary and the category
being written on first write, whatever caused the sharing, rather than only
for inheritance.

## Character spacing is per glyph, not per cluster or character

`drawText` spacing is drawn as `EncodedText.withSpacing` positions (no
`Tc`/`Tw`), which keeps only GPOS-attached marks on their bases: a mark the
layout did not attach (a font without mark positioning, or an AAT or
non-OpenType engine, which set no `isMark`/`attachedTo` on positions) takes
no spacing itself but moves with the pen, so it lands the base's spacing to
the right of where the font put it. A ligature takes character spacing once,
not once per character it stands for, and one standing for several spaces
takes word spacing once. Word spacing already follows occurrences of U+0020
(`GlyphRun.codePoints`), not the glyph. The rest needs source clusters out of
`layout()` - which glyphs came from which typed characters, carried through
the code-point rewrites and shapers - the same provenance ToUnicode needs to
spell typed text (below). Form field layout and `drawSvg` apply no character
or word spacing at all.

## ToUnicode holds one string per code, in shaping order

ToUnicode maps each glyph a font draws to the text of its first encoded
occurrence (`CustomFontEmbedder.toUnicodeEntries`). One string per code
cannot say everything: a glyph drawn for two characters (U+0020 and U+00A0
in fonts that share it) extracts as whichever was encoded first, a multiple
substitution that repeats a glyph (a -> x x) extracts the text once per
copy, and the text is the spelling the font was shaped from in glyph order,
so where shaping split or moved characters the typed text is not recovered:
SARA AM (U+0E33) extracts as U+0E4D U+0E32 around the tone mark, a reph or
pre-base matra extracts where it is drawn, and an RTL run is in visual
order. Fixing
it needs per-glyph source clusters (indices into the typed text, mapped
through `composeCanonical`, `decomposeSaraAm` and the shapers' splits and
insertions) and then `/ActualText` spans for clusters whose glyph mappings
do not spell their text, or separate PDF codes per meaning for a subset
(full embeds keep code = glyph id through `CIDToGIDMap /Identity`).

## Embedded files that do not come through attach() skip the PDF/A check

`attach()` checks each new attachment against the document's PDF/A
declaration (`assertPDFAAttachment` in `src/core/metadata/pdfa.ts`), but
other ways of putting an `/EF` file into a declared document do not:
`copyPages()` copies file-attachment annotations and page `/AF` entries
with the files they reach, a direct `FileEmbedder.embedIntoContext()` call
writes one, and `declarePDFA({ part: 1 })` declares a document that already
holds `/EmbeddedFiles` or attachments already flushed. Whether copying and
declaring should refuse, as library writes contradicting a declaration, or
stay unchecked like other existing content, is undecided.

## heightOfFontAtSize mixes scaled and unscaled descent

`CustomFontEmbedder.heightOfFontAtSize` computes `yTop - yBottom` in
1000-unit space (`* this.scale`), but with `descender: false` subtracts
`Math.abs(descent)` in font units, so the result is wrong whenever
unitsPerEm is not 1000 (and when hhea descent is 0 the bbox fallback was
used for the height but nothing is subtracted). It also substitutes
`bbox.maxY`/`bbox.minY` per field when ascent or descent is individually
zero, so a font with a legitimate zero descent measures to its bbox depth.
`sizeOfFontAtHeight` shares the second issue. Which span the method means
(ascent to descent, line advance, or ink extent) is not stated anywhere.
