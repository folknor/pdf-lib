# parser findings

Open findings about loading documents (`src/core/parser`). Each entry
stands alone; remove it when it is fixed or ruled against (leaving a comment
at the code site in the second case).

## One unusable xref entry reconstructs the whole document

`PDFParser.loadByXRef` loads every number through the file's effective
xref, and any entry that does not lead to its object (an offset with no
`N G obj` header of that number and generation, a member that is not where
its object stream's table puts it, a compressed entry whose container is
not an object stream) abandons the whole attempt for a scan of every body.
The scan keeps the last body met per number, so one stale offset in a file
otherwise readable brings back bodies the xref freed or replaced. Recovering
per object instead (find that number's body by a scan only for the entries
that fail, never borrowing another generation or another object stream's
copy) would keep the xref's selection for the rest of the file.
