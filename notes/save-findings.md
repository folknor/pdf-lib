# save findings

Open findings about saving and the writers (`src/api/PDFDocument.ts` save
paths, `src/core/writers`). Each entry stands alone; remove it when it is
fixed or ruled against (leaving a comment at the code site in the second
case).

## A page cannot be added after a full save with object streams

Load a one-page document with `forIncrementalUpdate: true, updateMetadata:
false`, call `save({ rewrite: true, useObjectStreams: true })`, then
`addPage()`: it throws `CorruptPageTreeError` from
`PDFPageTree.insertLeafNode` ("one or more 'Count' entries are invalid"). The
same sequence with `useObjectStreams: false` works, and the header version
makes no difference. So the object-stream full-save path (`PDFStreamWriter`)
appears to leave the document's page tree, or the page cache, in a state the
next edit cannot use; a save should not change what later edits see. Not
investigated further.

## The trailer /ID never changes between revisions

ISO 32000-1 14.4 makes the second `/ID` string a changing identifier, new
for each revision, with the first kept. The writers never maintain it: a full
save or an increment writes `trailerInfo.ID` as loaded (or, for an encrypted
increment, the file's own), `declarePDFA()` adds `[id id]` only when there is
none, and `PDFSecurity.encrypt()` replaces both strings. PDF/A only requires
that an `/ID` exist, so this is a general writer gap, not a PDF/A one. A fix
would pick the revision's second string before either writer captures its
trailer (`PDFStreamWriter` builds the xref-stream trailer before enumerating
objects), keep the first, leave encrypted increments alone (the key of R2-R4
handlers derives from the first string only, but the file's /ID must stay
that of its encryption), and have `commit()` carry the emitted /ID into the
next revision.
