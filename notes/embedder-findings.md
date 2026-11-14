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

## Line breaking assumes shaped prefix widths grow monotonically

`widthOfTextAtSize` on a custom font measures the shaped glyphs (what
`encodeText` emits), and `splitOutLines` in `src/api/text/layout.ts`
gallops and binary-searches over break candidates assuming a longer prefix
is never narrower. A font with contextual substitutions that reach across a
space can make a later candidate fit after an earlier one overflowed; the
search then stops at the overflow and can return a line shorter than the
longest fitting one, or an overflowing paragraph. Not reproduced with a
real font. A fix is a search that does not rely on monotonicity (or that
detects a non-monotonic step and falls back to a linear scan of the line).

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
