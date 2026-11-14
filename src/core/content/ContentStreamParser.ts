import PDFName from "../objects/PDFName.js";
import { IsDelimiter } from "../syntax/Delimiters.js";
import { IsWhitespace } from "../syntax/Whitespace.js";

/**
 * Reads the operator grammar of content streams (ISO 32000-1 7.8.2, 8.9.7),
 * a dialect distinct from the object syntax PDFObjectParser reads: no
 * indirect references, bare keywords are operators, and inline images carry
 * raw data inside the stream.
 *
 * This is the reading foundation for anything that interprets page content
 * (resource pruning in copyPages today). Strings stay bytes; nothing here
 * decodes fonts or executes operators.
 *
 * Upstream's `PDFPage.extractContents()` is not built on this or ported: it
 * reports one text asset per BT..ET block (later runs, fonts and positions
 * folded into the first), takes font size from Tf unscaled by the text and
 * graphics matrices, drops TJ spacing, guesses ToUnicode code length (its
 * codespacerange pattern is misspelled, so small subsets such as ours decode
 * as 1-byte codes), decodes Symbol and /Differences fonts as WinAnsi,
 * extracts a Form drawn twice once, and mutates the page it reads through
 * PDFPageLeaf.normalize(). Text extraction would need font decoding, a text
 * state interpreter and per-run positioned output layered on this parser.
 */

export interface ContentName {
  readonly type: "name";
  readonly name: PDFName;
}

export interface ContentString {
  readonly type: "string";
  readonly bytes: Uint8Array;
  readonly hex: boolean;
}

export interface ContentDict {
  readonly type: "dict";
  readonly entries: Map<PDFName, ContentOperand>;
}

export type ContentOperand =
  | number
  | boolean
  | null
  | ContentName
  | ContentString
  | ContentDict
  | ContentOperand[];

export interface InlineImage {
  /** The dictionary between BI and ID, keys as written (abbreviated or not). */
  readonly dict: Map<PDFName, ContentOperand>;
  /** The encoded image data between ID and EI. */
  readonly data: Uint8Array;
}

export interface ContentOperation {
  readonly operator: string;
  readonly operands: ContentOperand[];
  /** Set for the operation `BI`, which stands for the whole BI..ID..EI. */
  readonly inlineImage?: InlineImage;
}

export interface ParsedContentStream {
  readonly operations: ContentOperation[];
  /**
   * False when the bytes are not well-formed content-stream syntax as far as
   * this parser can establish: unterminated or invalid tokens, stray closing
   * delimiters, operands with no operator at the end, excessive nesting, or an
   * inline image whose data extent cannot be justified. `operations` then
   * holds what was read before the failure.
   */
  readonly complete: boolean;
}

const MAX_NESTING = 256;

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)$/;

const isHexDigit = (b: number) =>
  (b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x46) || (b >= 0x61 && b <= 0x66);

const hexValue = (b: number) => (b <= 0x39 ? b - 0x30 : b <= 0x46 ? b - 0x37 : b - 0x57);

class Incomplete extends Error {}

type Token =
  | { kind: "operand"; value: ContentOperand }
  | { kind: "keyword"; value: string }
  | { kind: "arrayEnd" }
  | { kind: "dictEnd" };

const latin1 = (bytes: Uint8Array, start: number, end: number) => {
  let s = "";

  for (let i = start; i < end; i++) s += String.fromCharCode(bytes[i]!);

  return s;
};

/** Inline-image keys and their abbreviations (ISO 32000-1 Table 93). */
const INLINE_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ["BitsPerComponent", "BPC"],
  ["ColorSpace", "CS"],
  ["Decode", "D"],
  ["DecodeParms", "DP"],
  ["Filter", "F"],
  ["Height", "H"],
  ["ImageMask", "IM"],
  ["Interpolate", "I"],
  ["Width", "W"],
];

const DEVICE_COMPONENTS: ReadonlyMap<string, number> = new Map([
  ["G", 1],
  ["DeviceGray", 1],
  ["RGB", 3],
  ["DeviceRGB", 3],
  ["CMYK", 4],
  ["DeviceCMYK", 4],
]);

class Parser {
  private pos = 0;

  constructor(private readonly bytes: Uint8Array) {}

  parse(): ParsedContentStream {
    const operations: ContentOperation[] = [];
    let operands: ContentOperand[] = [];

    try {
      for (;;) {
        const token = this.nextToken(0);

        if (token === undefined) break;

        if (token.kind === "operand") {
          operands.push(token.value);
          continue;
        }

        if (token.kind !== "keyword") throw new Incomplete();

        if (token.value === "ID" || token.value === "EI") {
          throw new Incomplete();
        }

        if (token.value === "BI") {
          if (operands.length > 0) throw new Incomplete();
          operations.push({
            operator: "BI",
            operands,
            inlineImage: this.parseInlineImage(),
          });
        } else {
          operations.push({ operator: token.value, operands });
        }

        operands = [];
      }

      if (operands.length > 0) throw new Incomplete();

      return { operations, complete: true };
    } catch (e) {
      if (e instanceof Incomplete) return { operations, complete: false };
      throw e;
    }
  }

  private skipWhitespaceAndComments() {
    const { bytes } = this;

    while (this.pos < bytes.length) {
      const b = bytes[this.pos]!;

      if (IsWhitespace[b]) {
        this.pos++;
      } else if (b === 0x25 /* % */) {
        while (this.pos < bytes.length && bytes[this.pos] !== 0x0a && bytes[this.pos] !== 0x0d) {
          this.pos++;
        }
      } else {
        return;
      }
    }
  }

  private nextToken(depth: number): Token | undefined {
    if (depth > MAX_NESTING) throw new Incomplete();
    this.skipWhitespaceAndComments();
    const { bytes } = this;

    if (this.pos >= bytes.length) return;
    const b = bytes[this.pos]!;

    switch (b) {
      case 0x2f /* / */:
        return { kind: "operand", value: this.parseName() };
      case 0x28 /* ( */:
        return { kind: "operand", value: this.parseLiteralString() };
      case 0x5b /* [ */: {
        this.pos++;
        const items: ContentOperand[] = [];

        for (;;) {
          const t = this.nextToken(depth + 1);

          if (t === undefined) throw new Incomplete();

          if (t.kind === "arrayEnd") break;

          if (t.kind !== "operand") throw new Incomplete();
          items.push(t.value);
        }

        return { kind: "operand", value: items };
      }

      case 0x5d /* ] */:
        this.pos++;

        return { kind: "arrayEnd" };
      case 0x3c /* < */:
        if (bytes[this.pos + 1] === 0x3c) {
          this.pos += 2;

          return { kind: "operand", value: this.parseDict(depth) };
        }

        return { kind: "operand", value: this.parseHexString() };
      case 0x3e /* > */:
        if (bytes[this.pos + 1] === 0x3e) {
          this.pos += 2;

          return { kind: "dictEnd" };
        }

        throw new Incomplete();
      case 0x29 /* ) */:
      case 0x7b /* { */:
      case 0x7d /* } */:
        throw new Incomplete();
      default:
        return this.parseRegular(depth);
    }
  }

  private parseRegular(depth: number): Token {
    const { bytes } = this;
    const start = this.pos;

    while (
      this.pos < bytes.length &&
      !IsWhitespace[bytes[this.pos]!] &&
      !IsDelimiter[bytes[this.pos]!]
    ) {
      this.pos++;
    }

    const text = latin1(bytes, start, this.pos);

    if (NUMBER.test(text)) {
      const value = Number(text);

      if (!Number.isFinite(value)) throw new Incomplete();

      return { kind: "operand", value };
    }

    // No operator starts like a number; `1.2.3` or `-` is a broken number.
    if (/^[+\-.\d]/.test(text)) throw new Incomplete();

    if (text === "true") return { kind: "operand", value: true };

    if (text === "false") return { kind: "operand", value: false };

    if (text === "null") return { kind: "operand", value: null };

    // A bare keyword inside an array or dictionary is not an operand.
    if (depth > 0) throw new Incomplete();

    return { kind: "keyword", value: text };
  }

  private parseName(): ContentName {
    const { bytes } = this;
    this.pos++;
    let value = "";

    while (
      this.pos < bytes.length &&
      !IsWhitespace[bytes[this.pos]!] &&
      !IsDelimiter[bytes[this.pos]!]
    ) {
      const c = bytes[this.pos]!;
      const h1 = bytes[this.pos + 1];
      const h2 = bytes[this.pos + 2];

      if (c === 0x23 /* # */) {
        // Since PDF 1.2 `#` always introduces two hex digits.
        if (h1 === undefined || h2 === undefined || !isHexDigit(h1) || !isHexDigit(h2)) {
          throw new Incomplete();
        }

        value += String.fromCharCode(hexValue(h1) * 16 + hexValue(h2));
        this.pos += 3;
      } else {
        value += String.fromCharCode(c);
        this.pos++;
      }
    }

    return { type: "name", name: PDFName.fromDecoded(value) };
  }

  private parseLiteralString(): ContentString {
    const { bytes } = this;
    this.pos++;
    const out: number[] = [];
    let nesting = 1;

    while (this.pos < bytes.length) {
      const c = bytes[this.pos++]!;

      if (c === 0x28) {
        nesting++;
        out.push(c);
      } else if (c === 0x29) {
        nesting--;

        if (nesting === 0) {
          return { type: "string", bytes: Uint8Array.from(out), hex: false };
        }

        out.push(c);
      } else if (c === 0x5c /* \ */) {
        if (this.pos >= bytes.length) break;
        const e = bytes[this.pos++]!;

        switch (e) {
          case 0x6e:
            out.push(0x0a);
            break;
          case 0x72:
            out.push(0x0d);
            break;
          case 0x74:
            out.push(0x09);
            break;
          case 0x62:
            out.push(0x08);
            break;
          case 0x66:
            out.push(0x0c);
            break;
          case 0x0d:
            if (bytes[this.pos] === 0x0a) this.pos++;
            break;
          case 0x0a:
            break;
          default:
            if (e >= 0x30 && e <= 0x37) {
              let code = e - 0x30;

              for (let n = 0; n < 2; n++) {
                const d = bytes[this.pos];

                if (d === undefined || d < 0x30 || d > 0x37) break;
                code = code * 8 + (d - 0x30);
                this.pos++;
              }

              out.push(code & 0xff);
            } else {
              // \( \) \\ and unknown escapes: the character itself.
              out.push(e);
            }
        }
      } else if (c === 0x0d) {
        // An unescaped end of line (CR, LF or CR LF) is one LF.
        if (bytes[this.pos] === 0x0a) this.pos++;
        out.push(0x0a);
      } else {
        out.push(c);
      }
    }

    throw new Incomplete();
  }

  private parseHexString(): ContentString {
    const { bytes } = this;
    this.pos++;
    const out: number[] = [];
    let high: number | undefined;

    while (this.pos < bytes.length) {
      const c = bytes[this.pos++]!;

      if (c === 0x3e) {
        if (high !== undefined) out.push(high * 16);

        return { type: "string", bytes: Uint8Array.from(out), hex: true };
      }

      if (IsWhitespace[c]) continue;

      if (!isHexDigit(c)) throw new Incomplete();

      if (high === undefined) {
        high = hexValue(c);
      } else {
        out.push(high * 16 + hexValue(c));
        high = undefined;
      }
    }

    throw new Incomplete();
  }

  private parseDict(depth: number): ContentDict {
    const entries = new Map<PDFName, ContentOperand>();

    for (;;) {
      const key = this.nextToken(depth + 1);

      if (key === undefined) throw new Incomplete();

      if (key.kind === "dictEnd") return { type: "dict", entries };

      if (key.kind !== "operand" || !isName(key.value)) {
        throw new Incomplete();
      }

      const value = this.nextToken(depth + 1);

      if (value === undefined || value.kind !== "operand") {
        throw new Incomplete();
      }

      entries.set(key.value.name, value.value);
    }
  }

  private parseInlineImage(): InlineImage {
    const dict = new Map<PDFName, ContentOperand>();

    for (;;) {
      const key = this.nextToken(0);

      if (key === undefined) throw new Incomplete();

      if (key.kind === "keyword" && key.value === "ID") break;

      if (key.kind !== "operand" || !isName(key.value)) {
        throw new Incomplete();
      }

      const value = this.nextToken(1);

      if (value === undefined || value.kind !== "operand") {
        throw new Incomplete();
      }

      if (dict.has(key.value.name)) throw new Incomplete();
      dict.set(key.value.name, value.value);
    }

    // Exactly one whitespace byte separates ID from the data. CR LF is
    // ambiguous (end of line, or CR then a first data byte of LF), so it is
    // not guessed at.
    const { bytes } = this;
    const sep = bytes[this.pos];

    if (sep === undefined || !IsWhitespace[sep]) throw new Incomplete();

    if (sep === 0x0d && bytes[this.pos + 1] === 0x0a) throw new Incomplete();
    const dataStart = this.pos + 1;
    const dataEnd = inlineDataEnd(bytes, dataStart, inlineEntries(dict));

    if (dataEnd === undefined) throw new Incomplete();

    this.pos = dataEnd;

    while (this.pos < bytes.length && IsWhitespace[bytes[this.pos]!]) {
      this.pos++;
    }

    const after = bytes[this.pos + 2];

    if (
      bytes[this.pos] !== 0x45 /* E */ ||
      bytes[this.pos + 1] !== 0x49 /* I */ ||
      (after !== undefined && !IsWhitespace[after] && !IsDelimiter[after])
    ) {
      throw new Incomplete();
    }

    this.pos += 2;

    return { dict, data: bytes.subarray(dataStart, dataEnd) };
  }
}

const isName = (v: ContentOperand): v is ContentName =>
  typeof v === "object" && v !== null && !Array.isArray(v) && v.type === "name";

/** Inline-image entries by full key; aliases written twice are refused. */
const inlineEntries = (dict: Map<PDFName, ContentOperand>): Map<string, ContentOperand> => {
  const out = new Map<string, ContentOperand>();

  for (const [key, value] of dict) {
    const text = key.decodeText();
    const full = INLINE_ALIASES.find(([f, a]) => f === text || a === text);
    const name = full ? full[0] : text;

    if (out.has(name)) throw new Incomplete();
    out.set(name, value);
  }

  return out;
};

const singleFilter = (f: ContentOperand | undefined): string | undefined => {
  if (f === undefined) return "";

  if (isName(f)) return f.name.decodeText();

  if (Array.isArray(f)) {
    if (f.length === 0) return "";

    if (f.length === 1 && isName(f[0]!)) return f[0].name.decodeText();
  }

  return;
};

const positiveInt = (v: ContentOperand | undefined): number | undefined =>
  typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : undefined;

/**
 * The end offset of inline image data starting at `start`, when it can be
 * established without guessing: unfiltered data by its computed size, and a
 * single ASCIIHex or ASCII85 filter by its validated end-of-data marker.
 * Anything else (other filters, colour spaces named in the resources) is
 * undefined.
 */
const inlineDataEnd = (
  bytes: Uint8Array,
  start: number,
  entries: Map<string, ContentOperand>,
): number | undefined => {
  const filter = singleFilter(entries.get("Filter"));

  if (filter === undefined) return;

  if (filter === "AHx" || filter === "ASCIIHexDecode") {
    for (let i = start; i < bytes.length; i++) {
      const c = bytes[i]!;

      if (c === 0x3e) return i + 1;

      if (!IsWhitespace[c] && !isHexDigit(c)) return;
    }

    return;
  }

  if (filter === "A85" || filter === "ASCII85Decode") {
    let group = 0;
    let value = 0;

    for (let i = start; i < bytes.length; i++) {
      const c = bytes[i]!;

      if (c === 0x7e /* ~ */) {
        // A final partial group has 2 to 4 characters.
        if (group === 1 || bytes[i + 1] !== 0x3e) return;
        // A partial group decodes as if padded with `u`.
        let padded = value;

        for (let n = group; n < 5 && group > 0; n++) padded = padded * 85 + 84;

        if (padded > 0xffffffff) return;

        return i + 2;
      }

      if (IsWhitespace[c]) continue;

      if (c === 0x7a /* z */) {
        if (group !== 0) return;
        continue;
      }

      if (c < 0x21 || c > 0x75) return;
      value = value * 85 + (c - 0x21);
      group++;

      if (group === 5) {
        if (value > 0xffffffff) return;
        group = 0;
        value = 0;
      }
    }

    return;
  }

  if (filter !== "") return;

  const width = positiveInt(entries.get("Width"));
  const height = positiveInt(entries.get("Height"));

  if (width === undefined || height === undefined) return;

  let components: number;
  let bpc: number | undefined;
  const mask = entries.get("ImageMask");

  if (mask === true) {
    const declared = entries.get("BitsPerComponent");

    if (declared !== undefined && declared !== 1) return;

    if (entries.has("ColorSpace")) return;
    components = 1;
    bpc = 1;
  } else {
    if (mask !== undefined && mask !== false) return;
    const cs = entries.get("ColorSpace");

    if (cs !== undefined && isName(cs)) {
      const n = DEVICE_COMPONENTS.get(cs.name.decodeText());

      if (n === undefined) return;
      components = n;
    } else if (
      Array.isArray(cs) &&
      cs.length === 4 &&
      isName(cs[0]!) &&
      (cs[0].name.decodeText() === "I" || cs[0].name.decodeText() === "Indexed")
    ) {
      components = 1;
    } else {
      return;
    }

    const b = entries.get("BitsPerComponent");
    bpc = b === 1 || b === 2 || b === 4 || b === 8 || b === 16 ? b : undefined;

    if (bpc === undefined) return;
  }

  const rowBytes = Math.ceil((width * components * bpc) / 8);
  const length = rowBytes * height;

  if (!Number.isSafeInteger(length) || length > bytes.length - start) return;

  return start + length;
};

export const parseContentStream = (bytes: Uint8Array): ParsedContentStream =>
  new Parser(bytes).parse();
