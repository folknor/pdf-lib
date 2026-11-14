import { DecodedStreamTooLargeError } from '../errors.js';
import PDFArray from '../objects/PDFArray.js';
import type PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import type PDFObject from '../objects/PDFObject.js';
import PDFRawStream from '../objects/PDFRawStream.js';
import PDFContext from '../PDFContext.js';
import { decodePDFRawStream } from '../streams/decode.js';
import CharCodes from '../syntax/CharCodes.js';
import { Keywords } from '../syntax/Keywords.js';
import { IsDigit } from '../syntax/Numeric.js';
import { silentWarningHandler } from '../warnings.js';
import ByteStream from './ByteStream.js';
import PDFObjectParser from './PDFObjectParser.js';

/** What the effective cross-reference data of a file says about one number. */
export type XRefDisposition =
  | { kind: 'inUse'; offset: number; generation: number }
  | { kind: 'free'; generation: number }
  /** A type-2 entry: member `index` of object stream `container`. */
  | { kind: 'compressed'; container: number; index: number }
  /**
   * An xref-stream entry of a type ISO 32000-1 7.5.8.3 does not define:
   * a reference to the null object. It shadows older entries like any other.
   */
  | { kind: 'null' };

/** The trailer keys a reader resolves the document with. */
export interface EffectiveTrailer {
  Root?: PDFObject;
  Encrypt?: PDFObject;
  Info?: PDFObject;
  ID?: PDFObject;
}

export interface EffectiveXRef {
  /** /Size of the newest section: every effective entry is below it. */
  size: number;
  entries: Map<number, XRefDisposition>;
  /** The highest number whose effective entry is free, or 0. */
  highestFree: number;
  /**
   * Each key from the newest section along the chain that has it (a
   * linearized file's main section, for one, omits /Root).
   */
  trailer: EffectiveTrailer;
  /** Whether any section of the chain is a cross-reference stream. */
  hasStreamSection: boolean;
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
  isStream: boolean;
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
 * PDFParser loads a document through it (see `PDFParser.loadByXRef`),
 * passing its own context so the trailer values belong to the document; the
 * reader parses into that context but never assigns into it. An xref stream
 * whose /Length is an indirect reference is read by its `endstream` alone:
 * the chain is not known yet when its sections are parsed.
 *
 * A decode-limit failure is not a damaged chain and passes through as is.
 */
class PDFXRefChainReader extends PDFObjectParser {
  static read = (
    bytes: Uint8Array,
    startXRef: number,
    maxDecodedStreamSize?: number,
    context?: PDFContext,
  ): EffectiveXRef => {
    const into = context ?? PDFContext.create();
    if (!context) {
      into.maxDecodedStreamSize = maxDecodedStreamSize;
      // A read without a document's context is a writer re-reading bytes
      // their load already parsed and reported: it reports nothing.
      into.onWarning = silentWarningHandler;
    }
    try {
      return new PDFXRefChainReader(bytes, into).readChain(startXRef);
    } catch (e) {
      if (e instanceof XRefChainError) throw e;
      if (e instanceof DecodedStreamTooLargeError) throw e;
      throw new XRefChainError(e instanceof Error ? e.message : String(e));
    }
  };

  private constructor(bytes: Uint8Array, context: PDFContext) {
    // Views, not copies: the xref streams read here are decoded and
    // dropped, never kept in the context.
    super(ByteStream.of(bytes, false), context);
  }

  private readChain(startXRef: number): EffectiveXRef {
    const entries = new Map<number, XRefDisposition>();
    const visited = new Set<number>();
    const supplements = new Set<number>();
    let newestSize: number | undefined;
    const trailer: EffectiveTrailer = {};
    let hasStreamSection = false;

    const merge = (section: Section) => {
      for (const [num, disposition] of section.entries) {
        if (!entries.has(num)) entries.set(num, disposition);
      }
      if (section.isStream) hasStreamSection = true;
      for (const key of ['Root', 'Encrypt', 'Info', 'ID'] as const) {
        const value = section.trailer.get(PDFName.of(key));
        if (trailer[key] === undefined && value !== undefined) {
          trailer[key] = value;
        }
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
    return { size, entries, highestFree, trailer, hasStreamSection };
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
    return { entries, trailer, isStream: false };
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
    // The decoder reverses any predictor; strict refuses data that ends
    // mid-row rather than reconstructing a partial one.
    const data = decodePDFRawStream(stream, { strict: true }).decode();
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
          entries.push([
            num,
            { kind: 'compressed', container: field2, index: field3 },
          ]);
        } else {
          // ISO 32000-1 7.5.8.3: any other type is a reference to null.
          entries.push([num, { kind: 'null' }]);
        }
      }
    }
    checkSection(entries, dict, offset);
    return { entries, trailer: dict, isStream: true };
  }
}

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
    if (disposition.kind === 'compressed' || disposition.kind === 'null') {
      continue;
    }
    if (disposition.generation > 65535) throw fail('has a bad generation');
    if (disposition.kind === 'inUse' && disposition.offset > 9999999999) {
      throw fail('has an offset too large for a table');
    }
  }
};

export default PDFXRefChainReader;
