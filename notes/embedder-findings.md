# embedder findings

Open findings about the embedders (`src/core/embedders`) and the attachment
API built on them (`attach`, `detach`, `PDFEmbeddedFile`). Each entry stands
alone; remove it when it is fixed or ruled against (leaving a comment at the
code site in the second case).

## Duplicate names are appended, not refused

`attach()` and `addJavaScript()` both append a pair whose key equals an
existing one (the name tree writer in `src/api/nameTree.ts` inserts after
equal keys). A reader that binary-searches the tree may then find either
entry, so which same-named attachment a viewer shows is reader-dependent.
`addJavaScript()` documents its name as "unique per document" but does not
enforce it, against saved or pending scripts.

## embedFacturX() refuses /Kids attachment trees

`attach()` and `detach()` edit `/Kids` trees through `src/api/nameTree.ts`,
but `planFacturXAttachment()` (`src/api/facturx.ts`) still refuses any tree
that is not a flat root, since it plans its own atomic rewrite of the root
`/Names` array. Moving it onto the shared copy-on-write remover/inserter
would let it handle `/Kids` trees too.

## attach() knows nothing of PDF/A

PDF/A-1 forbids embedded files, PDF/A-2 allows only PDF/A files, and PDF/A-3
requires each to carry a MIME type and an `/AFRelationship` (with a
`/Params /ModDate` expected as well; check ISO 19005-3 6.8 before relying on
the exact list). `attach()` writes whatever it is given on a document that
declares PDF/A, so the result can contradict the declaration. It could refuse
on PDF/A-1, and on PDF/A-3 default or require the missing entries.
