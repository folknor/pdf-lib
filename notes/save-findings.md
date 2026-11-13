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
`/Prev` chain; today only a `fillXrefGaps` table increment uses it, and that
path does link earlier free entries in.

## An increment can reuse a number an earlier revision froze

A free entry of generation 65535 is never to be reused (ISO 32000-1 7.5.4),
but neither writer checks a number it emits in use against the file's
effective xref: a context object under such a number (the parser loads
every scanned body, freed or not) is written in use. A fix reads the
effective xref (`PDFXRefChainReader`) on every increment and refuses that
write; an ordinary reuse of an earlier free number should likewise carry
the generation the free entry names.

## The context can hold several generations of one number

The parser assigns every object body it scans, so a file whose history
deleted `12 0` and reused the number as `12 1` loads with both refs live; it
never selects the generation its xref names. Any write that emits that
number then has two in-use candidates; `freeEntries()` refuses such a write
rather than emit a duplicate xref entry. A fix picks the effective
generation from the xref at load.

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
