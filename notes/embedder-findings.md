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

## attach() knows nothing of PDF/A

PDF/A-1 forbids embedded files, PDF/A-2 allows only PDF/A files, and PDF/A-3
requires each to carry a MIME type and an `/AFRelationship` (with a
`/Params /ModDate` expected as well; check ISO 19005-3 6.8 before relying on
the exact list). `attach()` writes whatever it is given on a document that
declares PDF/A, so the result can contradict the declaration. It could refuse
on PDF/A-1, and on PDF/A-3 default or require the missing entries.
