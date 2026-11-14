# save findings

Open findings about saving and the writers (`src/api/PDFDocument.ts` save
paths, `src/core/writers`). Each entry stands alone; remove it when it is
fixed or ruled against (leaving a comment at the code site in the second
case).

## Frozen numbers go unchecked when the xref chain cannot be read

Increments refuse to write in use a number the file's effective xref lists
free at generation 65535, or a free number under another generation than
the entry names (`assertInheritedFreeEntriesRespected` in
`src/core/writers/PDFWriter.ts`). When `PDFXRefChainReader` rejects the chain
(one damaged section rejects it all) the check is skipped, so a file loaded
by reconstruction can still have a freed body written back in use. A
readable chain whose entries do not lead to their objects is no longer
this case: the parser recovers those entries one by one and the check
runs. What remains is a chain the reader rejects outright, which the parser
still reconstructs whole; closing it needs the reader to keep the
dispositions of the sections it can read despite damage in another.

## An edit to a shared direct object marks only one owner for an increment

`PDFContext.registerObjectChange()` marks the first indirect object found
containing the edited direct object (or only the object itself when it is
registered too). When API code puts one direct `PDFDict`/`PDFArray`
instance inside two indirect objects, an increment rewrites one owner and
leaves the other's earlier body in force; if the edit removed a reference
whose target was then deleted (as `detach()` does), that body now dangles.
Parsed documents never alias direct objects, so only API-built sharing hits
it. Fix by marking every owner, or by refusing to alias direct objects.
