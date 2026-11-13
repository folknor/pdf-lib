# encryption findings

Open findings about PDF encryption (`src/core/security`, `src/core/crypto.ts`
and the encryption paths of the writers). Each entry stands alone; remove it
when it is fixed or ruled against (leaving a comment at the code site in the
second case).

## The writers encrypt stream contents only, never strings

`PDFWriter.encrypt` (`src/core/writers/PDFWriter.ts`) touches `PDFStream`
contents and nothing else, and `PDFStreamWriter` inherits it. Every string the
standard requires encrypted that sits in a top-level object (the Info dictionary, annotation /Contents, form values) is
written in clear while the file declares it encrypted, so a conforming reader
decrypts plaintext into garbage. Seen directly: a document with a title,
encrypted and saved with `useObjectStreams: false`, reloads with a garbled
title under every cipher. Objects inside an object stream are covered by the
container's encryption, which hides the problem in the default save path for
new documents. The fix walks dictionaries and arrays of each indirect object
and encrypts `PDFString`/`PDFHexString` with that object's key, exempting the
/Encrypt dictionary, the trailer /ID and signature /Contents.

## Encrypting mutates stream contents in place

`PDFWriter.encrypt` replaces a stream's contents with its ciphertext through
`updateContents`. A second `save()` of the same document encrypts the
ciphertext again: the first output has once-encrypted streams, the second
twice-encrypted ones that no reader can open. The
encryption belongs in serialisation, leaving the document's objects as they
were.

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
without object streams finds the Info dictionary (with the garbled title of
the first entry). This is an observed reproduction; the mechanism is not
traced; the existing indirect-crypt-filter
test in `tests/api/PDFDocument.spec.ts` only passes because it re-saves
without object streams before reloading.

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
