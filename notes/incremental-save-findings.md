# incremental save findings

Open findings about incremental saving (`saveIncremental`, `commit`,
`takeSnapshot` and `src/api/snapshot`). Each entry stands alone; remove it
when it is fixed or ruled against (leaving a comment at the code site in the
second case).

## saveIncremental accepts a snapshot with no serialized base

`takeSnapshot()` returns a snapshot for any document, but installs it as
`context.snapshot` (so that later changes mark it) only when the document has
original bytes. `saveIncremental(snapshot)` on a created document, or on one
loaded without `forIncrementalUpdate`, emits a "delta" with no header that
omits the catalog and page tree its trailer references, and misses changes
made after the snapshot. Nor does it check that the snapshot belongs to this
document. It should refuse a snapshot that does not describe this document's
serialized bytes.
