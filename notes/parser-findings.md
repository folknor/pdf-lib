# parser findings

Open findings about loading documents (`src/core/parser`). Each entry
stands alone; remove it when it is fixed or ruled against (leaving a comment
at the code site in the second case).

## Recovering a stale offset can pick a header inside stream data

When an in-use xref entry does not lead to its object, `PDFParser` takes the
last top-level `N G obj` header of that number and generation that a scan of
the file met (the 'index' load mode). The scan skips a stream's data only as
far as it can tell where the stream ends: a stream whose /Length is an
indirect reference to an object stored later in the file, or inside an object
stream (the index scan reads no members), is ended at its first `endstream`,
so a header in its data after that point (an embedded PDF, say) can be
indexed and, being later, chosen over the real body. The same holds after
damaged syntax, where the invalid-object path and `skipJibberish` search
bytes without lexical state. Closing it needs the index scan to resolve
such lengths (reading members, or a second pass once every top-level length
object is known) before trusting what follows a stream.
