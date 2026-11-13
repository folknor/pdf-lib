import PDFArray from '../objects/PDFArray.js';
import PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import type PDFObject from '../objects/PDFObject.js';
import PDFRawStream from '../objects/PDFRawStream.js';
import PDFContext from '../PDFContext.js';
import { decodePDFRawStream } from '../streams/decode.js';
import CharCodes from '../syntax/CharCodes.js';
import { Keywords } from '../syntax/Keywords.js';
import { IsDigit } from '../syntax/Numeric.js';
import ByteStream from './ByteStream.js';
import PDFObjectParser from './PDFObjectParser.js';

/** What the effective cross-reference data of a file says about one number. */
export type XRefDisposition =
  | { kind: 'inUse'; offset: number; generation: number }
  | { kind: 'free'; generation: number }
  /** A type-2 entry: the object lives in an object stream. */
  | { kind: 'compressed' };

export interface EffectiveXRef {
  /** /Size of the newest section: every effective entry is below it. */
  size: number;
  entries: Map<number, XRefDisposition>;
  /** The highest number whose effective entry is free, or 0. */
  highestFree: number;
}

export class XRefChainError extends Error {
  constructor(reason: string) {
    super(`Cannot read the cross-reference chain of the file: ${reason}`);
    this.name = 'XRefChainError';
  }
}

const XRefName = PDFName.of('XRef');

interface Section {
  entries: [number, XRefDisposition][];
  trailer: PDFDict;
}

/**
 * Reads the cross-reference data a conforming reader resolves numbers with,
 * from the bytes alone: the section `startXRef` names, then, newest first,
 * every section its trailer chain reaches (ISO 32000-1 7.5.8.4: for a hybrid
 * section the table, then its /XRefStm stream, then /Prev). The first entry
 * met for a number is its effective one, a free entry included.
 *
 * Strict: any section that cannot be read where the chain says it is, a
 * loop, an entry at or above its own section's /Size, or an effective entry
 * at or above the newest /Size (readers ignore those; republishing one under
 * a larger /Size would make it resolvable) throws XRefChainError.
 *
 * This is independent of PDFParser, which scans bodies in file order and
 * keeps no xref (see the findings in notes/save-findings.md).
 */
class PDFXRefChainReader extends PDFObjectParser {
  static read = (
    bytes: Uint8Array,
    startXRef: number,
    maxDecodedStreamSize?: number,
  ): EffectiveXRef => {
    const context = PDFContext.create();
    context.maxDecodedStreamSize = maxDecodedStreamSize;
    try {
      return new PDFXRefChainReader(bytes, context).readChain(startXRef);
    } catch (e) {
      if (e instanceof XRefChainError) throw e;
      throw new XRefChainError(e instanceof Error ? e.message : String(e));
    }
  };

  private constructor(bytes: Uint8Array, context: PDFContext) {
    super(ByteStream.of(bytes), context);
  }

  private readChain(startXRef: number): EffectiveXRef {
    const entries = new Map<number, XRefDisposition>();
    const visited = new Set<number>();
    const supplements = new Set<number>();
    let newestSize: number | undefined;

    const merge = (section: Section) => {
      for (const [num, disposition] of section.entries) {
        if (!entries.has(num)) entries.set(num, disposition);
      }
    };

    let offset: number | undefined = startXRef;
    while (offset !== undefined) {
      if (visited.has(offset)) {
        throw new XRefChainError(`the chain loops at offset ${offset}`);
      }
      visited.add(offset);
      const section = this.readSection(offset);
      newestSize ??= sizeOf(section.trailer);
      merge(section);
      const xrefStm = section.trailer.get(PDFName.of('XRefStm'));
      if (xrefStm !== undefined) {
        if (!(xrefStm instanceof PDFNumber)) {
          throw new XRefChainError('/XRefStm is not a number');
        }
        // The supplemental stream's own /Prev is not part of the chain, and
        // two revisions may share one stream: met again, it adds nothing.
        const stmOffset = xrefStm.asNumber();
        if (!supplements.has(stmOffset)) {
          supplements.add(stmOffset);
          merge(this.readStreamSection(stmOffset));
        }
      }
      const prev = section.trailer.get(PDFName.of('Prev'));
      if (prev !== undefined && !(prev instanceof PDFNumber)) {
        throw new XRefChainError('/Prev is not a number');
      }
      offset = prev?.asNumber();
    }

    const size = newestSize!;
    let highestFree = 0;
    for (const [num, disposition] of entries) {
      if (num >= size) {
        throw new XRefChainError(
          `object ${num} is listed but the newest /Size is ${size}`,
        );
      }
      if (disposition.kind === 'free' && num > highestFree) highestFree = num;
    }
    entries.delete(0);
    return { size, entries, highestFree };
  }

  private readSection(offset: number): Section {
    this.bytes.moveTo(offset);
    this.skipWhitespaceAndComments();
    if (this.matchKeyword(Keywords.xref)) return this.readTable(offset);
    return this.readStreamSection(offset);
  }

  private readTable(offset: number): Section {
    const entries: [number, XRefDisposition][] = [];
    this.skipWhitespaceAndComments();
    while (IsDigit[this.bytes.peek()]) {
      const first = this.parseRawInt();
      this.skipWhitespaceAndComments();
      const count = this.parseRawInt();
      this.skipWhitespaceAndComments();
      for (let idx = 0; idx < count; idx++) {
        const field1 = this.parseRawInt();
        this.skipWhitespaceAndComments();
        const generation = this.parseRawInt();
        this.skipWhitespaceAndComments();
        const type = this.bytes.next();
        if (type === CharCodes.n) {
          entries.push([
            first + idx,
            { kind: 'inUse', offset: field1, generation },
          ]);
        } else if (type === CharCodes.f) {
          entries.push([first + idx, { kind: 'free', generation }]);
        } else {
          throw new XRefChainError(
            `malformed entry in the xref table at offset ${offset}`,
          );
        }
        this.skipWhitespaceAndComments();
      }
    }
    if (!this.matchKeyword(Keywords.trailer)) {
      throw new XRefChainError(
        `no trailer after the table at offset ${offset}`,
      );
    }
    this.skipWhitespaceAndComments();
    const trailer = this.parseDict();
    checkSection(entries, trailer, offset);
    return { entries, trailer };
  }

  private readStreamSection(offset: number): Section {
    this.bytes.moveTo(offset);
    this.skipWhitespaceAndComments();
    const notASection = () =>
      new XRefChainError(`no xref section at offset ${offset}`);
    if (!IsDigit[this.bytes.peek()]) throw notASection();
    this.parseRawInt();
    this.skipWhitespaceAndComments();
    this.parseRawInt();
    this.skipWhitespaceAndComments();
    if (!this.matchKeyword(Keywords.obj)) throw notASection();
    const stream = this.parseObject();
    if (
      !(stream instanceof PDFRawStream) ||
      stream.dict.lookup(PDFName.of('Type')) !== XRefName
    ) {
      throw notASection();
    }
    const { dict } = stream;
    const bad = (what: string) =>
      new XRefChainError(`${what} in the xref stream at offset ${offset}`);
    const W = dict.get(PDFName.of('W'));
    if (!(W instanceof PDFArray) || W.size() !== 3) throw bad('bad /W');
    const widths = W.asArray().map((w) => intOf(w, bad('bad /W')));
    // An offset or generation wider than 6 bytes would lose precision.
    if (widths.some((w) => w > 6)) throw bad('bad /W');
    const Index = dict.get(PDFName.of('Index'));
    const ranges: number[] =
      Index === undefined
        ? [0, sizeOf(dict)]
        : Index instanceof PDFArray && Index.size() % 2 === 0
          ? Index.asArray().map((n) => intOf(n, bad('bad /Index')))
          : [];
    if (ranges.length === 0) throw bad('bad /Index');
    const [typeWidth, offsetWidth, genWidth] = widths as [
      number,
      number,
      number,
    ];
    const width = typeWidth + offsetWidth + genWidth;
    let rows = 0;
    for (let i = 1; i < ranges.length; i += 2) rows += ranges[i]!;
    // /DecodeParms belongs to the filter: without one it means nothing, and
    // only Flate and LZW take a predictor.
    const filter = dict.lookup(PDFName.of('Filter'));
    const parms = dict.lookup(PDFName.of('DecodeParms'));
    const decoded = decodePDFRawStream(stream).decode();
    let data = decoded;
    if (filter !== undefined && parms !== undefined) {
      if (
        filter !== PDFName.of('FlateDecode') &&
        filter !== PDFName.of('LZWDecode')
      ) {
        throw bad('unsupported /Filter with /DecodeParms');
      }
      data = unpredict(decoded, parms, width, bad);
    }
    if (data.length < rows * width) throw bad('truncated data');

    let at = 0;
    const field = (n: number) => {
      let value = 0;
      for (let i = 0; i < n; i++) value = value * 256 + data[at++]!;
      return value;
    };
    const entries: [number, XRefDisposition][] = [];
    for (let i = 0; i < ranges.length; i += 2) {
      for (let k = 0; k < ranges[i + 1]!; k++) {
        const type = typeWidth === 0 ? 1 : field(typeWidth);
        const field2 = field(offsetWidth);
        const field3 = field(genWidth);
        const num = ranges[i]! + k;
        if (type === 0) {
          entries.push([num, { kind: 'free', generation: field3 }]);
        } else if (type === 1) {
          entries.push([
            num,
            { kind: 'inUse', offset: field2, generation: field3 },
          ]);
        } else if (type === 2) {
          entries.push([num, { kind: 'compressed' }]);
        } else {
          // ISO 32000-1 7.5.8.3: any other type is a reference to null; a
          // table has no way to say that, so refuse rather than guess.
          throw bad(`entry type ${type} for object ${num}`);
        }
      }
    }
    checkSection(entries, dict, offset);
    return { entries, trailer: dict };
  }
}

/**
 * Reverses a PNG predictor (ISO 32000-1 7.4.4.4), which xref streams commonly
 * use; `decodePDFRawStream` does not apply /DecodeParms. Rows must be one
 * 8-bit component per byte as wide as an entry. TIFF and unknown predictors,
 * or more than one /DecodeParms, are refused.
 */
const unpredict = (
  data: Uint8Array,
  parms: PDFObject,
  width: number,
  bad: (what: string) => Error,
): Uint8Array => {
  if (!(parms instanceof PDFDict)) throw bad('unsupported /DecodeParms');
  const num = (key: string, fallback: number) => {
    const value = parms.lookup(PDFName.of(key));
    return value === undefined ? fallback : intOf(value, bad(`bad /${key}`));
  };
  const predictor = num('Predictor', 1);
  if (predictor === 1) return data;
  if (
    predictor < 10 ||
    predictor > 15 ||
    num('Colors', 1) !== 1 ||
    num('BitsPerComponent', 8) !== 8 ||
    num('Columns', 1) !== width
  ) {
    throw bad('unsupported predictor');
  }
  const rows = Math.floor(data.length / (width + 1));
  const out = new Uint8Array(rows * width);
  for (let r = 0; r < rows; r++) {
    const filter = data[r * (width + 1)]!;
    const src = r * (width + 1) + 1;
    const dst = r * width;
    for (let i = 0; i < width; i++) {
      const raw = data[src + i]!;
      const left = i > 0 ? out[dst + i - 1]! : 0;
      const up = r > 0 ? out[dst - width + i]! : 0;
      const upLeft = r > 0 && i > 0 ? out[dst - width + i - 1]! : 0;
      let value: number;
      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + ((left + up) >> 1);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
      } else throw bad(`PNG filter ${filter}`);
      out[dst + i] = value & 0xff;
    }
  }
  return out;
};

const intOf = (object: PDFObject | undefined, error: Error): number => {
  if (!(object instanceof PDFNumber)) throw error;
  const value = object.asNumber();
  if (!Number.isSafeInteger(value) || value < 0) throw error;
  return value;
};

const sizeOf = (trailer: PDFDict): number =>
  intOf(
    trailer.get(PDFName.of('Size')),
    new XRefChainError('a section has no valid /Size'),
  );

/**
 * A section lists each number once, below its own /Size, with a generation
 * of at most 65535 and an offset that fits a table's 10 digits.
 */
const checkSection = (
  entries: [number, XRefDisposition][],
  trailer: PDFDict,
  offset: number,
) => {
  const size = sizeOf(trailer);
  const seen = new Set<number>();
  for (const [num, disposition] of entries) {
    const fail = (what: string) =>
      new XRefChainError(
        `the section at offset ${offset} ${what} for object ${num}`,
      );
    if (num >= size) throw fail(`exceeds its /Size ${size}`);
    if (seen.has(num)) throw fail('has two entries');
    seen.add(num);
    if (disposition.kind === 'compressed') continue;
    if (disposition.generation > 65535) throw fail('has a bad generation');
    if (disposition.kind === 'inUse' && disposition.offset > 9999999999) {
      throw fail('has an offset too large for a table');
    }
  }
};

export default PDFXRefChainReader;
