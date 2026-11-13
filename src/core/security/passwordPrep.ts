/*
  Password preparation for the AES-256 revision 6 security handler.

  ISO 32000-2 7.6.4.3.3 has R6 passwords processed with the SASLprep profile
  of stringprep (RFC 4013, on RFC 3454 with Unicode 3.2), then UTF-8 encoded
  and truncated to 127 bytes. Full SASLprep needs Unicode 3.2 normalisation
  and the bidi tables, which this module does not carry. Instead:

  - The writer accepts a restricted repertoire: passwords for which the
    mapping step is the only change SASLprep would make. Anything that
    NFKC would alter, any prohibited code point and any character from a
    right-to-left script is refused. For every accepted password the bytes
    written are exactly what a conforming reader derives from the same
    typed password. NFKC invariance is checked with the runtime's (newer)
    Unicode: code points assigned in 3.2 normalise stably across versions,
    and code points unassigned in 3.2 are left alone by a 3.2 query-mode
    implementation, so a modern fixed point is a 3.2 fixed point. Code points
    unassigned in Unicode 3.2 (emoji, for example) are accepted: readers
    prepare the typed password as a query, where they are allowed. This is
    not stored-string SASLprep.

  - The reader applies the mapping and the runtime's NFKC, then falls back to
    the raw UTF-8 bytes when that does not authenticate. A password whose
    Unicode 3.2 NFKC differs from the runtime's (a 3.2-unassigned character
    composing with its neighbours) matches neither candidate; that is a known
    limitation of not carrying the 3.2 tables.
*/

/** RFC 3454 table B.1: commonly mapped to nothing. */
const MAPPED_TO_NOTHING: ReadonlyArray<readonly [number, number]> = [
  [0x00ad, 0x00ad],
  [0x034f, 0x034f],
  [0x1806, 0x1806],
  [0x180b, 0x180d],
  [0x200b, 0x200d],
  [0x2060, 0x2060],
  [0xfe00, 0xfe0f],
  [0xfeff, 0xfeff],
];

/** RFC 3454 table C.1.2: non-ASCII space characters, mapped to U+0020. */
const NON_ASCII_SPACES: ReadonlyArray<readonly [number, number]> = [
  [0x00a0, 0x00a0],
  [0x1680, 0x1680],
  [0x2000, 0x200b],
  [0x202f, 0x202f],
  [0x205f, 0x205f],
  [0x3000, 0x3000],
];

/** RFC 4013 section 2.3 prohibited output: RFC 3454 C.1.2 and C.2.1 - C.9. */
const PROHIBITED: ReadonlyArray<readonly [number, number]> = [
  ...NON_ASCII_SPACES,
  // C.2.1 ASCII control characters
  [0x0000, 0x001f],
  [0x007f, 0x007f],
  // C.2.2 non-ASCII control characters
  [0x0080, 0x009f],
  [0x06dd, 0x06dd],
  [0x070f, 0x070f],
  [0x180e, 0x180e],
  [0x200c, 0x200d],
  [0x2028, 0x2029],
  [0x2060, 0x2063],
  [0x206a, 0x206f],
  [0xfeff, 0xfeff],
  [0x1d173, 0x1d17a],
  // C.3 private use
  [0xe000, 0xf8ff],
  [0xf0000, 0xffffd],
  [0x100000, 0x10fffd],
  // C.4 non-character code points (the per-plane xFFFE-xFFFF pairs are
  // tested separately)
  [0xfdd0, 0xfdef],
  // C.5 surrogate codes
  [0xd800, 0xdfff],
  // C.6 inappropriate for plain text
  [0xfff9, 0xfffd],
  // C.7 inappropriate for canonical representation
  [0x2ff0, 0x2ffb],
  // C.8 change display properties or deprecated
  [0x0340, 0x0341],
  [0x200e, 0x200f],
  [0x202a, 0x202e],
  // C.9 tagging characters
  [0xe0001, 0xe0001],
  [0xe0020, 0xe007f],
];

/*
  A superset of the blocks holding RFC 3454 table D.1 (RandALCat) characters,
  widened to cover right-to-left scripts added after Unicode 3.2. With none of
  these present, the RFC 3454 section 6 bidi rule holds vacuously.
*/
const RIGHT_TO_LEFT: ReadonlyArray<readonly [number, number]> = [
  [0x0590, 0x08ff],
  [0x200f, 0x200f],
  [0xfb1d, 0xfdff],
  [0xfe70, 0xfeff],
  [0x10800, 0x10fff],
  [0x1e800, 0x1efff],
];

const inRanges = (
  code: number,
  ranges: ReadonlyArray<readonly [number, number]>,
): boolean => ranges.some(([lo, hi]) => code >= lo && code <= hi);

const isProhibited = (code: number): boolean =>
  inRanges(code, PROHIBITED) || (code & 0xfffe) === 0xfffe;

/** RFC 4013 section 2.1 mapping. B.1 is checked first: U+200B is in both. */
const mapPassword = (password: string): string => {
  let mapped = '';
  for (const char of password) {
    const code = char.codePointAt(0)!;
    if (inRanges(code, MAPPED_TO_NOTHING)) continue;
    mapped += inRanges(code, NON_ASCII_SPACES) ? ' ' : char;
  }
  return mapped;
};

const encodePrepared = (prepared: string): Uint8Array =>
  new TextEncoder().encode(prepared).subarray(0, 127);

/**
 * Prepares a password for writing an R6 security handler. Throws for any
 * password outside the repertoire described at the top of this module.
 */
export const prepareR6PasswordForWriting = (password: string): Uint8Array => {
  const mapped = mapPassword(password);
  if (mapped.normalize('NFKC') !== mapped) {
    throw new Error(
      'AES-256 passwords must be in Unicode normalization form NFKC.',
    );
  }
  for (const char of mapped) {
    const code = char.codePointAt(0)!;
    if (isProhibited(code)) {
      throw new Error(
        `AES-256 passwords may not contain U+${code.toString(16).toUpperCase().padStart(4, '0')}.`,
      );
    }
    if (inRanges(code, RIGHT_TO_LEFT)) {
      throw new Error(
        'AES-256 passwords may not contain right-to-left characters.',
      );
    }
  }
  return encodePrepared(mapped);
};

/**
 * Candidate byte strings for an R6 password typed by a reader: the mapped,
 * NFKC-normalised form first, then the raw UTF-8 bytes for files from
 * writers that skipped preparation. Duplicates are dropped.
 */
export const r6PasswordCandidates = (password: string): Uint8Array[] => {
  const prepared = encodePrepared(mapPassword(password).normalize('NFKC'));
  const raw = encodePrepared(password);
  const same =
    prepared.length === raw.length && prepared.every((b, i) => b === raw[i]);
  return same ? [prepared] : [prepared, raw];
};
