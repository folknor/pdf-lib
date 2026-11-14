# embedder findings

Open findings about the embedders (`src/core/embedders`) and the attachment
API built on them (`attach`, `detach`, `PDFEmbeddedFile`). Each entry stands
alone; remove it when it is fixed or ruled against (leaving a comment at the
code site in the second case).

## An attachment can land in /AF but not in the attachments name tree

`PDFEmbeddedFile.embed()` ignores the result of `addNameTreeEntry()`, which
refuses an `/EmbeddedFiles` tree with `/Kids` or a malformed `/Names` array.
The file specification is then still pushed onto the catalog `/AF` and the
file is marked embedded, so it is in the document but missing from the
attachments panel and from `getAttachments()`, silently, at save time.
`attach()` should check the tree when called and throw (as `embedFacturX()`
does before changing anything), or the tree helper should learn `/Kids`.

## Attachments in a /Kids name tree are invisible

`getAttachments()` and `detach()` read only the flat `/Names` array of the
catalog `/EmbeddedFiles` node, so a document whose attachments tree uses
`/Kids` reports no saved attachments and `detach()` silently removes
nothing. `getAttachments()` also decodes every attachment, so one
unreadable stream makes the whole call throw (`detach()` no longer depends
on it).

## attach() knows nothing of PDF/A

PDF/A-1 forbids embedded files, PDF/A-2 allows only PDF/A files, and PDF/A-3
requires each to carry a MIME type and an `/AFRelationship` (with a
`/Params /ModDate` expected as well; check ISO 19005-3 6.8 before relying on
the exact list). `attach()` writes whatever it is given on a document that
declares PDF/A, so the result can contradict the declaration. It could refuse
on PDF/A-1, and on PDF/A-3 default or require the missing entries.
