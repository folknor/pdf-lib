# encryption findings

Open findings about PDF encryption (`src/core/security`, `src/core/crypto.ts`
and the encryption paths of the writers). Each entry stands alone; remove it
when it is fixed or ruled against (leaving a comment at the code site in the
second case).

## Object streams with forward-referenced /Crypt parameters are refused

An object stream is decrypted mid-parse (`PDFParser.parseIndirectObject`),
before later objects are known, so a /Crypt declaration on it that resolves
through an object not parsed yet throws `CryptFilterError` and the load
fails. Deferring member extraction until the parse completes would read
them.
