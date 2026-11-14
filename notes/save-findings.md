# save findings

Open findings about saving and the writers (`src/api/PDFDocument.ts` save
paths, `src/core/writers`). Each entry stands alone; remove it when it is
fixed or ruled against (leaving a comment at the code site in the second
case).

## An increment's free list ignores earlier revisions

Each increment's free entries come from `freeEntries()` in
`src/core/writers/PDFWriter.ts`, which knows only this revision's
deletions: the chain runs from object 0 through them and ends at 0, so a
number freed by an earlier revision (including one this library committed)
drops out of the newest chain while keeping a generation below 65535, which
ISO 32000-1 7.5.4 allows only for 65535 entries. The freed generation is
the one of the removed object as the context holds it, not the file's
effective one. Both need the file's effective xref, which
`PDFXRefChainReader` (`src/core/parser`) reads from the bytes along the
`/Prev` chain. `freeEntries()` already reads it on every increment, but only
to check the refs written in use; it does not build the free chain from it.
A `fillXrefGaps` table increment does link earlier free entries in.

## Frozen numbers go unchecked when the xref chain cannot be read

Increments refuse to write in use a number the file's effective xref lists
free at generation 65535, or a free number under another generation than
the entry names (`assertInheritedFreeEntriesRespected` in
`src/core/writers/PDFWriter.ts`). When `PDFXRefChainReader` rejects the chain
(one damaged section rejects it all) the check is skipped, so a file loaded
by reconstruction can still have a freed body written back in use. Closing
it needs dispositions read per entry despite unrelated damage, the same
per-object recovery the parser finding on whole-document reconstruction
asks for.

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
