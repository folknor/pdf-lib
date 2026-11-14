# embedder findings

Open findings about the embedders (`src/core/embedders`) and the attachment
API built on them (`attach`, `detach`, `PDFEmbeddedFile`). Each entry stands
alone; remove it when it is fixed or ruled against (leaving a comment at the
code site in the second case).

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
