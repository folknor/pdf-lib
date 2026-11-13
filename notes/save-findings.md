# save findings

Open findings about saving and the writers (`src/api/PDFDocument.ts` save
paths, `src/core/writers`). Each entry stands alone; remove it when it is
fixed or ruled against (leaving a comment at the code site in the second
case).

## Deleted objects are written from a log, not from final dispositions

`context.delete()` appends to the snapshot's deletion log, and
`PDFWriter.computeBufferSize` turns that log straight into free entries.
Nothing reconciles the log with what is written: a number deleted and then
assigned again is emitted both in use and free, and both xref encoders
assume unique, ascending numbers, so the duplicate shifts every later
entry in its subsection by one (the free entry lands on the next number,
whose offset moves to the one after). A deletion of a ref that never
existed is logged too, and the generation is incremented without
saturating at 65535. `PDFStreamWriter` writes no free entries at all, so an
increment with object streams silently keeps a deleted object live (and
its `PDFCrossRefStream` free-list head stays 0). The fix is one final
disposition per object number before either xref is built (live wins over
a stale deletion; the free chain is built from the surviving deletions;
deletions of numbers the file never had, including ones above the
original `largestObjectNumber`, are dropped), shared by both writers.

## `fillXrefGaps` frees inherited objects in an increment

`PDFCrossRefSection.fillGaps()` marks every number missing between the
entries of a section as free. In an increment the missing numbers are the
unchanged objects of earlier revisions, and, after a commit with object
streams, the object streams their type-2 entries name; filling them
deletes them for any reader that honours the newest section. Filling an
incremental section needs the inherited entries, or the option must be
refused for increments.

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
