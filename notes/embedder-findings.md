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
the right of where the font put it. A ligature takes spacing once, not once
per character it stands for, and word spacing goes to the font's glyph for
U+0020 rather than to occurrences of U+0020. All three need per-occurrence
code-point provenance out of `layout()` (cluster of each glyph), the same
plumbing the ToUnicode entry below needs. Form field layout and `drawSvg`
apply no character or word spacing at all.

## Shaped glyphs outside the cmap get no ToUnicode mapping

`CustomFontEmbedder.embedUnicodeCmap` (full embed) maps only the glyphs the
font's cmap reaches, so any glyph that only shaping produces - Arabic joining
forms, ligatures, Noto Sans Thai's small tone marks chosen after the SARA AM
decomposition - has no explicit ToUnicode entry and may drop out of extracted
text. Thai is the knowing trade: decomposing SARA AM improves the drawn
stacking and costs the tone mark in full-embed extraction. Recording the Glyph
objects `layout()` returns does not fix it: fontkit caches glyphs by id and
the first construction fixes `codePoints` (`glyphsForWidths` builds every glyph
with none), so those code points are not the occurrence's; the subset embedder,
which maps its emitted Glyph objects, has the same weakness. A fix needs
per-occurrence code-point provenance out of `layout()` (`GlyphInfo.codePoints`
through the OT writeback), cmap mappings taken from code point -> gid pairs,
and a contract for one gid with several meanings (best-effort single mapping,
separate PDF codes per meaning, or `ActualText`); neither restores logical
order after a reorder by itself.

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
