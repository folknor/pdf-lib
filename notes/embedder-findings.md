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
