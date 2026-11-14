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

## Form field layout and drawSvg apply no character or word spacing

`drawText` takes `characterSpacing`/`wordSpacing` and draws them per source
cluster (`EncodedText.withSpacing`), but form field appearances
(`src/api/text/layout.ts`) and `drawSvg` have no spacing options at all.

## ActualText recovers typed text per cluster, not line order or every reader

`CustomFontEmbedder.encodeText` wraps each source cluster whose glyphs'
ToUnicode mappings do not spell its text in a `/Span` with `/ActualText`.
What that does not cover:
- Order between clusters is the drawing order. A right-to-left run is drawn
  whole-run reversed (no bidi), so a reader that concatenates in content
  order gets its clusters reversed, digits inside RTL text included; only
  readers that reorder by position recover the line.
- Provenance ends at the string given to `encodeText`: what `drawText` and
  field layout clean before that (tabs, CRLF, trimmed wrap whitespace, comb
  cells encoded one scalar at a time) is not recoverable.
- A string whose glyphs shaping deletes entirely draws nothing and carries
  no span, so its text is lost.
- Readers that ignore marked-content ActualText (pdf.js text extraction,
  going by its open issue 12237) still read the ToUnicode mappings, one
  string per code.

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
