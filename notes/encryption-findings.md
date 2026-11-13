# encryption findings

Open findings about PDF encryption (`src/core/security`, `src/core/crypto.ts`
and the encryption paths of the writers). Each entry stands alone; remove it
when it is fixed or ruled against (leaving a comment at the code site in the
second case).

## The reader ignores per-stream crypt selection

`PDFObjectParser.decryptStreamBytes` runs every stream body through the
/StmF filter. It ignores /EFF for embedded files, leaves no metadata stream
clear under /EncryptMetadata false, and has no /Crypt stream filter (nor
does `decode.ts`), so such streams load as garbage. The increment writer
(`BaselineEncryption` in `src/core/security/PDFSecurity.ts`) applies those
rules correctly, so any such stream an increment emits is re-encrypted from
already-corrupted plaintext; it refuses a stream naming /Crypt outright. A
full rewrite of a decrypted load also keeps old /Crypt filter declarations
on what is now clear data.

## Saving a document loaded with ignoreEncryption writes new objects in clear

A file loaded encrypted without a password keeps /Encrypt and its objects
stay ciphertext, which a full save re-emits consistently. Anything added or
changed is written in clear under that /Encrypt, so readers decrypt it into
garbage. Increments onto such a file are refused (`writeEncryption` in
`src/core/writers/PDFWriter.ts`); full saves are not.

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
