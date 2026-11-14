/* R6 uses RFC 4013 SASLprep in Unicode 3.2 query mode (unassigned
   characters allowed), followed by UTF-8 truncation to 127 bytes. The writer
   deliberately retains its restricted, Unicode-version-stable repertoire. */
import {
  COMBINING_CLASS,
  COMPOSITION,
  DECOMPOSITION,
  STRINGPREP_TABLES,
} from "./passwordPrepData.js";

const MAPPED_TO_NOTHING = STRINGPREP_TABLES["B.1"]!;
const NON_ASCII_SPACES = STRINGPREP_TABLES["C.1.2"]!;

const PROHIBITED = Object.entries(STRINGPREP_TABLES)
  .filter(([name]) => name.startsWith("C.") && name !== "C.1.1")
  .flatMap(([, ranges]) => ranges);

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

const inRanges = (code: number, ranges: ReadonlyArray<readonly [number, number]>): boolean =>
  ranges.some(([lo, hi]) => code >= lo && code <= hi);

const isProhibited = (code: number): boolean =>
  inRanges(code, PROHIBITED) || (code & 0xfffe) === 0xfffe;

/** RFC 4013 section 2.1 mapping. B.1 is checked first: U+200B is in both. */
const mapPassword = (password: string): string => {
  let mapped = "";

  for (const char of password) {
    const code = char.codePointAt(0)!;

    if (inRanges(code, MAPPED_TO_NOTHING)) continue;
    mapped += inRanges(code, NON_ASCII_SPACES) ? " " : char;
  }

  return mapped;
};

/** Unicode 3.2 compatibility decomposition, canonical ordering/composition. */
const normalize32 = (input: string): string => {
  const decomposed: number[] = [];

  const decompose = (code: number): void => {
    const syllable = code - 0xac00;

    if (syllable >= 0 && syllable < 11172) {
      decompose(0x1100 + Math.floor(syllable / 588));
      decompose(0x1161 + Math.floor((syllable % 588) / 28));

      if (syllable % 28) decompose(0x11a7 + (syllable % 28));
    } else if (DECOMPOSITION[code]) {
      for (const part of DECOMPOSITION[code]!) decompose(part);
    } else {
      const cls = COMBINING_CLASS[code] ?? 0;
      let at = decomposed.length;

      while (cls && at && (COMBINING_CLASS[decomposed[at - 1]!] ?? 0) > cls) at--;
      decomposed.splice(at, 0, code);
    }
  };

  for (const char of input) decompose(char.codePointAt(0)!);
  const result: number[] = [];
  let starter = -1;
  let lastClass = 0;

  for (const code of decomposed) {
    const cls = COMBINING_CLASS[code] ?? 0;
    const base = result[starter]!;
    let combined = COMPOSITION[`${base},${code}`];

    // Hangul composition is algorithmic, not listed in UnicodeData.
    if (base >= 0x1100 && base < 0x1113 && code >= 0x1161 && code < 0x1176) {
      combined = 0xac00 + ((base - 0x1100) * 21 + code - 0x1161) * 28;
    } else if (
      base >= 0xac00 &&
      base < 0xd7a4 &&
      (base - 0xac00) % 28 === 0 &&
      code > 0x11a7 &&
      code < 0x11c3
    ) {
      combined = base + code - 0x11a7;
    }

    if (starter >= 0 && combined !== undefined && (lastClass === 0 || lastClass < cls)) {
      result[starter] = combined;
    } else {
      if (cls === 0) starter = result.length;
      result.push(code);
      lastClass = cls;
    }
  }

  return result.map((code) => String.fromCodePoint(code)).join("");
};

const saslprep = (password: string): string | undefined => {
  const prepared = normalize32(mapPassword(password));
  const codes = Array.from(prepared, (char) => char.codePointAt(0)!);

  if (codes.some(isProhibited)) return undefined;
  const randAL = (code: number) => inRanges(code, STRINGPREP_TABLES["D.1"]!);

  if (
    codes.some(randAL) &&
    (codes.some((code) => inRanges(code, STRINGPREP_TABLES["D.2"]!)) ||
      !randAL(codes[0]!) ||
      !randAL(codes[codes.length - 1]!))
  )
    return undefined;

  return prepared;
};

const encodePrepared = (prepared: string): Uint8Array =>
  new TextEncoder().encode(prepared).subarray(0, 127);

/**
 * Prepares a password for writing an R6 security handler. Throws for any
 * password outside the repertoire described at the top of this module.
 */
export const prepareR6PasswordForWriting = (password: string): Uint8Array => {
  const mapped = mapPassword(password);

  if (mapped.normalize("NFKC") !== mapped) {
    throw new Error("AES-256 passwords must be in Unicode normalization form NFKC.");
  }

  for (const char of mapped) {
    const code = char.codePointAt(0)!;

    if (isProhibited(code)) {
      throw new Error(
        `AES-256 passwords may not contain U+${code.toString(16).toUpperCase().padStart(4, "0")}.`,
      );
    }

    if (inRanges(code, RIGHT_TO_LEFT)) {
      throw new Error("AES-256 passwords may not contain right-to-left characters.");
    }
  }

  return encodePrepared(mapped);
};

/** Exact SASLprep query first; raw bytes retain compatibility with writers
 * that skipped preparation. Invalid SASLprep output is never a candidate. */
export const r6PasswordCandidates = (password: string): Uint8Array[] => {
  const raw = encodePrepared(password);
  const value = saslprep(password);

  if (value === undefined) return [raw];
  const prepared = encodePrepared(value);

  const same = prepared.length === raw.length && prepared.every((b, i) => b === raw[i]);

  return same ? [prepared] : [prepared, raw];
};
