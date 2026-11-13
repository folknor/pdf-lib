# encryption findings

Open findings about PDF encryption (`src/core/security`, `src/core/crypto.ts`
and the encryption paths of the writers). Each entry stands alone; remove it
when it is fixed or ruled against (leaving a comment at the code site in the
second case).

## Increments refuse crypt filter role changes instead of rewriting

`BaselineEncryption.assertUntouchedBy` refuses an increment that would make
a stream it does not rewrite read with another crypt filter (a file
specification's /EF pointed at an existing stream under an /EFF unlike
/StmF, or the catalog /Metadata repointed under /EncryptMetadata false), and
one that changes an object a /Crypt declaration on disk resolves through,
even when the same increment rewrites every stream depending on it. Both are
safe; scheduling the affected streams for rewriting would let them through.

## Object streams with forward-referenced /Crypt parameters are refused

An object stream is decrypted mid-parse (`PDFParser.parseIndirectObject`),
before later objects are known, so a /Crypt declaration on it that resolves
through an object not parsed yet throws `CryptFilterError` and the load
fails. Deferring member extraction until the parse completes would read
them.

## User-authored /Crypt filters survive a full rewrite without /Encrypt

The reader removes loaded /Crypt declarations once it has applied them, and
increments refuse a stream naming /Crypt, but a stream the caller gives a
/Crypt filter is written as is by a full save, which writes no /Encrypt for
a decrypted load, so it names a crypt filter the output does not define.

## R6 password preparation is incomplete on the read side

`r6PasswordCandidates` (`src/core/security/passwordPrep.ts`) tries the SASLprep
mapping plus the runtime's NFKC, then raw UTF-8. A password whose Unicode 3.2
NFKC differs from the runtime's (a character unassigned in 3.2 composing with
its neighbours, e.g. U+1D2C before U+FF21) matches neither, so a file written
by a conforming Unicode 3.2 SASLprep implementation cannot be opened with it.
The proper fix carries the Unicode 3.2 normalisation (and, for the writer to
accept right-to-left passwords, the RFC 3454 D.1/D.2 bidi tables). The writer
side is unaffected: it only accepts passwords whose prepared form is the same
under every Unicode version.
