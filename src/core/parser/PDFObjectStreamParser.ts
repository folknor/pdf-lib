import { waitForTick } from '../../utils/index.js';
import { ReparseError } from '../errors.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import type PDFObject from '../objects/PDFObject.js';
import type PDFRawStream from '../objects/PDFRawStream.js';
import PDFRef from '../objects/PDFRef.js';
import ByteStream from './ByteStream.js';
import PDFObjectParser from './PDFObjectParser.js';

export class ObjectStreamMemberError extends Error {
  constructor(reason: string) {
    super(`Cannot read an object stream member: ${reason}`);
    this.name = 'ObjectStreamMemberError';
  }
}

class PDFObjectStreamParser extends PDFObjectParser {
  static forStream = (
    rawStream: PDFRawStream,
    shouldWaitForTick?: () => boolean,
  ) => new PDFObjectStreamParser(rawStream, shouldWaitForTick);

  private alreadyParsed: boolean;
  private readonly shouldWaitForTick: () => boolean;
  private readonly firstOffset: number;
  private readonly objectCount: number;
  private readonly dataLength: number;

  constructor(rawStream: PDFRawStream, shouldWaitForTick?: () => boolean) {
    super(ByteStream.fromPDFRawStream(rawStream), rawStream.dict.context);

    const { dict } = rawStream;

    this.alreadyParsed = false;
    this.shouldWaitForTick = shouldWaitForTick || (() => false);
    this.firstOffset = dict.lookup(PDFName.of('First'), PDFNumber).asNumber();
    this.objectCount = dict.lookup(PDFName.of('N'), PDFNumber).asNumber();
    this.dataLength = this.bytes.size();
  }

  /**
   * Reads one member, for loading through the xref: entry `index` of the
   * offset table must name `objectNumber`, and the member must parse within
   * its own extent (up to the next member's offset, or the end of the data)
   * with nothing but whitespace and comments after it. Throws
   * ObjectStreamMemberError otherwise.
   */
  readMember(index: number, objectNumber: number): PDFObject {
    const table = this.memberTable();
    const fail = (why: string) =>
      new ObjectStreamMemberError(
        `object ${objectNumber} at index ${index} of an object stream: ${why}`,
      );
    const member = table[index];
    if (!member) throw fail('no such index');
    if (member.objectNumber !== objectNumber) {
      throw fail(`the stream lists object ${member.objectNumber} there`);
    }
    const start = this.firstOffset + member.offset;
    const end =
      index + 1 < table.length
        ? this.firstOffset + table[index + 1]!.offset
        : this.dataLength;
    if (start > end || end > this.dataLength) throw fail('bad extent');
    const parser = PDFObjectParser.forBytes(
      this.bytes.slice(start, end),
      this.context,
    );
    let object: PDFObject;
    try {
      object = parser.parseObject();
    } catch (e) {
      throw fail(e instanceof Error ? e.message : String(e));
    }
    if (!parser.atEnd()) throw fail('trailing data');
    return object;
  }

  private table: { objectNumber: number; offset: number }[] | undefined;

  private memberTable(): { objectNumber: number; offset: number }[] {
    if (this.table) return this.table;
    const safe = (n: number) => Number.isSafeInteger(n) && n >= 0;
    if (!safe(this.firstOffset) || !safe(this.objectCount)) {
      throw new ObjectStreamMemberError('bad /First or /N');
    }
    let table: { objectNumber: number; offset: number }[];
    try {
      table = this.parseOffsetsAndObjectNumbers();
    } catch (e) {
      throw new ObjectStreamMemberError(
        `unreadable offset table: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    let previous = 0;
    for (const { objectNumber, offset } of table) {
      if (!safe(objectNumber) || !safe(offset) || offset < previous) {
        throw new ObjectStreamMemberError('bad offset table');
      }
      previous = offset;
    }
    if (this.bytes.offset() > this.firstOffset) {
      throw new ObjectStreamMemberError('the offset table overruns /First');
    }
    this.table = table;
    return table;
  }

  /** Assigns every member; `onAssign` hears of each as it is assigned. */
  async parseIntoContext(
    onAssign: (ref: PDFRef) => void = () => {},
  ): Promise<void> {
    if (this.alreadyParsed) {
      throw new ReparseError('PDFObjectStreamParser', 'parseIntoContext');
    }
    this.alreadyParsed = true;

    const offsetsAndObjectNumbers = this.parseOffsetsAndObjectNumbers();
    for (let idx = 0, len = offsetsAndObjectNumbers.length; idx < len; idx++) {
      const { objectNumber, offset } = offsetsAndObjectNumbers[idx]!;
      this.bytes.moveTo(this.firstOffset + offset);
      const ref = PDFRef.of(objectNumber, 0);
      const object = this.parseObject(ref);
      this.context.assign(ref, object);
      onAssign(ref);
      if (this.shouldWaitForTick()) await waitForTick();
    }
  }

  private parseOffsetsAndObjectNumbers(): {
    objectNumber: number;
    offset: number;
  }[] {
    const offsetsAndObjectNumbers: { objectNumber: number; offset: number }[] =
      [];
    for (let idx = 0, len = this.objectCount; idx < len; idx++) {
      this.skipWhitespaceAndComments();
      const objectNumber = this.parseRawInt();

      this.skipWhitespaceAndComments();
      const offset = this.parseRawInt();

      offsetsAndObjectNumbers.push({ objectNumber, offset });
    }
    return offsetsAndObjectNumbers;
  }
}

export default PDFObjectStreamParser;
