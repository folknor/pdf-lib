# encryption findings

Open findings about PDF encryption (`src/core/security`, `src/core/crypto.ts`
and the encryption paths of the writers). Each entry stands alone; remove it
when it is fixed or ruled against (leaving a comment at the code site in the
second case).

## An encrypted document can be saved incrementally

`context.security` is set only by `PDFDocument.encrypt`, which always mints a
new key, yet `save()` (when the document was loaded for incremental update)
and `saveIncremental()` both emit an increment. The original objects stay in
the file in clear (or under the old key) and the increment declares
/Encrypt. With a security handler set, `save()` should always rewrite and
`saveIncremental()` should throw.

## Encrypted object-stream output does not reload its Info dictionary

A new document with a title, encrypted under any cipher and saved with the
default object streams, reloads with the correct password but `getTitle()`
returns `undefined`, also with `ignoreEncryption`. The same document saved
without object streams reads the title back. The trailer still names the
Info reference after the reload, so the lookup of that object is what fails.
This is an observed reproduction; the mechanism is not traced; the existing
indirect-crypt-filter
test in `tests/api/PDFDocument.spec.ts` only passes because it re-saves
without object streams before reloading.

## The decrypting re-parse decrypts objects the standard exempts

`PDFParser.parseIndirectObject` calls `parseObject(ref)` for every object, so
with a crypto factory the encryption dictionary's /O, /U, /OE, /UE and /Perms
strings, the strings of a cross-reference stream's dictionary (its /ID) and
the cross-reference stream's contents are all run through decryption, though
ISO 32000-2 7.6.2 leaves them in clear. The key is already derived from the
first, undecrypted pass, and a decrypted load drops /Encrypt, so the damage
seen so far is to objects nobody reads back. It may be what the object-stream
entry above meets; not traced.

## Decrypted literal strings are stored without escaping

`PDFObjectParser.parseString` puts the decrypted bytes straight into
`PDFString.of`, whose value is literal-string syntax that `asBytes()` and the
writer interpret. Plaintext containing a backslash, an unbalanced parenthesis
or a CR changes meaning: `asBytes()` reads `a\nb` back as a newline, and
re-saving writes the raw bytes as unbalanced syntax. Decrypted strings should
come back as escaped literals or as `PDFHexString`. Separately,
`PDFString.asBytes()` does not turn an unescaped CR or CRLF into LF as 7.3.4.2
requires. The writers emit every encrypted string as hex, so their own
output never takes this path.

## Stream decryption uses the string crypt filter

`decryptStreamBytes` goes through `CipherTransform.decryptBytes`, which uses
the string cipher, not the one /StmF names. Every file this library writes
sets /StrF and /StmF to the same filter, but a file with differing filters
(e.g. /Identity for strings) decrypts its streams wrongly.

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

## R5 passwords are not SASLprep-prepared on read

Adobe's extension level 3 specifies SASLprep before UTF-8 for R5 too.
`CipherTransformFactory` tries plain UTF-8, then raw char codes. This library
no longer writes R5.

## Decryption never checks /Perms

`createEncryptionKey20` in `src/core/crypto.ts` takes `_perms` and ignores it.
ISO 32000-2 Algorithm 13 decrypts /Perms with the file key and checks the
'adb' marker and that the permissions match /P; a mismatch is tampering.

## The owner-password fallback runs the R2-R4 algorithm for V5 dictionaries

When neither candidate opens a /V 5 file, `CipherTransformFactory` falls
through to `decodeUserPassword` and `prepareKeyData`, the RC4/MD5 routines of
revisions 2-4, with the revision 5/6 /O and /U. It cannot succeed; it should
fail straight to 'Password incorrect'.
