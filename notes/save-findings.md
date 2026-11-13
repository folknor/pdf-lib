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

## PDF/A declaration facility (proposed, not built)

Upstream's `convertToPDFA()` was refused (README "Changes from upstream"),
and the Factur-X e-invoice feature that builds on it needs some way to write a
PDF/A-3 identification. The shape agreed under review, for whoever builds it:

- It is named and documented as a declaration, not a conversion: it writes
  the `pdfaid` identification, an output intent and a trailer `/ID`, and
  promises nothing about content (fonts, colour, transparency, actions).
- Whether a document declares PDF/A is read from its catalog XMP every time,
  never from an in-memory flag, so a loaded PDF/A file is treated like one
  this library declared.
- XMP is read with a namespace-aware XML parser (prefixes do not matter;
  attribute and element RDF forms, arrays, language alternatives), with
  external entities off and parsing bounded. Undecodable or unparseable XMP
  never counts as "not PDF/A", and contradictory identification throws.
- Existing metadata is preserved: an explicit Info edit updates the matching
  XMP property and nothing else; the packet is never rebuilt from Info, since
  that loses XMP-only values, multiple authors and language alternatives.
  Conflicting Info and XMP values are refused rather than resolved by
  location. The strict Info/XMP equivalence rule is PDF/A-1's; parts 2 and 3
  do not impose it the same way.
- An existing `/OutputIntents` is not replaced silently.
- Encryption is refused at output, not only in `encrypt()`: also for
  increments of a password-loaded encrypted file (an increment keeps the
  file's encryption) and for `encrypt()` before the declaration.
- PDF/A-1 refuses object and cross-reference streams whatever the declared
  version; PDF/A-1 does not require the header to say 1.4.
- The catalog `/Metadata` stream must stay unfiltered for PDF/A-1, but
  `save({ compress: true })` Flate-compresses every unfiltered stream
  (`PDFWriter.compress`, `PDFStreamWriter`), metadata included.
- Loaded A-level or part-4 declarations are not downgraded to the levels the
  facility can write.
