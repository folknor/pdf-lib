import { charFromCode } from '../../utils/index.js';
import type { CipherTransformFactory } from '../crypto.js';
import {
  PDFObjectParsingError,
  PDFStreamParsingError,
  type Position,
  UnbalancedParenthesisError,
} from '../errors.js';
import PDFArray from '../objects/PDFArray.js';
import PDFBool from '../objects/PDFBool.js';
import PDFDict, { type DictMap } from '../objects/PDFDict.js';
import PDFHexString from '../objects/PDFHexString.js';
import PDFName, { decodePdfNameEscapes } from '../objects/PDFName.js';
import PDFNull from '../objects/PDFNull.js';
import PDFNumber from '../objects/PDFNumber.js';
import type PDFObject from '../objects/PDFObject.js';
import PDFRawStream from '../objects/PDFRawStream.js';
import PDFRef from '../objects/PDFRef.js';
import type PDFStream from '../objects/PDFStream.js';
import PDFString from '../objects/PDFString.js';
import type PDFContext from '../PDFContext.js';
import PDFCatalog from '../structures/PDFCatalog.js';
import PDFPageLeaf from '../structures/PDFPageLeaf.js';
import PDFPageTree from '../structures/PDFPageTree.js';
import CharCodes from '../syntax/CharCodes.js';
import { IsDelimiter } from '../syntax/Delimiters.js';
import { Keywords } from '../syntax/Keywords.js';
import { IsDigit, IsNumeric } from '../syntax/Numeric.js';
import { IsWhitespace } from '../syntax/Whitespace.js';
import BaseParser from './BaseParser.js';
import ByteStream from './ByteStream.js';

// TODO: Throw error if eof is reached before finishing object parse...
class PDFObjectParser extends BaseParser {
  static forBytes = (
    bytes: Uint8Array,
    context: PDFContext,
    capNumbers?: boolean,
  ) => new PDFObjectParser(ByteStream.of(bytes), context, capNumbers);

  static forByteStream = (
    byteStream: ByteStream,
    context: PDFContext,
    capNumbers = false,
  ) => new PDFObjectParser(byteStream, context, capNumbers);

  protected readonly context: PDFContext;
  private readonly cryptoFactory: CipherTransformFactory | undefined;
  private readonly pendingStreamLengths: {
    stream: PDFRawStream;
    ref: PDFRef | undefined;
    lengthRef: PDFRef;
    start: number;
    end: number;
  }[] = [];

  constructor(
    byteStream: ByteStream,
    context: PDFContext,
    capNumbers = false,
    cryptoFactory?: CipherTransformFactory,
  ) {
    super(byteStream, capNumbers);
    this.context = context;
    this.cryptoFactory = cryptoFactory;
  }

  // TODO: Is it possible to reduce duplicate parsing for ref lookaheads?
  parseObject(ref?: PDFRef): PDFObject {
    this.skipWhitespaceAndComments();

    if (this.matchKeyword(Keywords.true)) return PDFBool.True;
    if (this.matchKeyword(Keywords.false)) return PDFBool.False;
    if (this.matchKeyword(Keywords.null)) return PDFNull;

    const byte = this.bytes.peek();

    if (
      byte === CharCodes.LessThan &&
      this.bytes.peekAhead(1) === CharCodes.LessThan
    ) {
      return this.parseDictOrStream(ref);
    }
    if (byte === CharCodes.LessThan) return this.parseHexString(ref);
    if (byte === CharCodes.LeftParen) return this.parseString(ref);
    if (byte === CharCodes.ForwardSlash) return this.parseName();
    if (byte === CharCodes.LeftSquareBracket) return this.parseArray(ref);
    if (IsNumeric[byte]) return this.parseNumberOrRef();

    throw new PDFObjectParsingError(this.bytes.position(), byte);
  }

  protected parseNumberOrRef(): PDFNumber | PDFRef {
    const firstNum = this.parseRawNumber();
    this.skipWhitespaceAndComments();

    const lookaheadStart = this.bytes.offset();
    if (IsDigit[this.bytes.peek()]) {
      const secondNum = this.parseRawNumber();
      this.skipWhitespaceAndComments();
      if (this.bytes.peek() === CharCodes.R) {
        this.bytes.assertNext(CharCodes.R);
        return PDFRef.of(firstNum, secondNum);
      }
    }

    this.bytes.moveTo(lookaheadStart);
    return PDFNumber.of(firstNum);
  }

  protected parseHexString(ref?: PDFRef): PDFHexString {
    let value = '';

    this.bytes.assertNext(CharCodes.LessThan);
    while (!this.bytes.done() && this.bytes.peek() !== CharCodes.GreaterThan) {
      value += charFromCode(this.bytes.next());
    }
    this.bytes.assertNext(CharCodes.GreaterThan);

    if (this.cryptoFactory && ref) {
      const transformer = this.cryptoFactory.createCipherTransform(
        ref.objectNumber,
        ref.generationNumber,
      );
      const arr = transformer.decryptBytes(PDFHexString.of(value).asBytes());
      value = arr.reduce(
        (str: string, byte: number) => str + byte.toString(16).padStart(2, '0'),
        '',
      );
    }

    return PDFHexString.of(value);
  }

  protected parseString(ref?: PDFRef): PDFString | PDFHexString {
    let nestingLvl = 0;
    let isEscaped = false;
    let value = '';

    while (!this.bytes.done()) {
      const byte = this.bytes.next();
      value += charFromCode(byte);

      // Check for unescaped parenthesis
      if (!isEscaped) {
        if (byte === CharCodes.LeftParen) nestingLvl += 1;
        if (byte === CharCodes.RightParen) nestingLvl -= 1;
      }

      // Track whether current character is being escaped or not
      if (byte === CharCodes.BackSlash) {
        isEscaped = !isEscaped;
      } else if (isEscaped) {
        isEscaped = false;
      }

      // Once (if) the unescaped parenthesis balance out, return their contents
      if (nestingLvl === 0) {
        const actualValue = value.substring(1, value.length - 1);

        if (this.cryptoFactory && ref) {
          const transformer = this.cryptoFactory.createCipherTransform(
            ref.objectNumber,
            ref.generationNumber,
          );
          const decrypted = transformer.decryptBytes(
            PDFString.of(actualValue).asBytes(),
          );
          // Decrypted bytes are data, not literal-string escape syntax.
          return PDFHexString.fromBytes(decrypted);
        }
        // Remove the outer parens so they aren't part of the contents
        return PDFString.of(actualValue);
      }
    }

    throw new UnbalancedParenthesisError(this.bytes.position());
  }

  // TODO: Compare performance of string concatenation to charFromCode(...bytes)
  // TODO: Maybe preallocate small Uint8Array if can use charFromCode?
  protected parseName(): PDFName {
    this.bytes.assertNext(CharCodes.ForwardSlash);

    let name = '';
    while (!this.bytes.done()) {
      const byte = this.bytes.peek();
      if (IsWhitespace[byte] || IsDelimiter[byte]) break;
      name += charFromCode(byte);
      this.bytes.next();
    }

    return PDFName.of(decodePdfNameEscapes(name));
  }

  protected parseArray(ref?: PDFRef): PDFArray {
    this.bytes.assertNext(CharCodes.LeftSquareBracket);
    this.skipWhitespaceAndComments();

    const pdfArray = PDFArray.withContext(this.context);
    while (this.bytes.peek() !== CharCodes.RightSquareBracket) {
      const element = this.parseObject(ref);
      pdfArray.push(element);
      this.skipWhitespaceAndComments();
    }
    this.bytes.assertNext(CharCodes.RightSquareBracket);
    return pdfArray;
  }

  protected parseDict(ref?: PDFRef): PDFDict {
    this.bytes.assertNext(CharCodes.LessThan);
    this.bytes.assertNext(CharCodes.LessThan);
    this.skipWhitespaceAndComments();

    const dict: DictMap = new Map();
    let contentsPos: Position | undefined;

    while (
      !this.bytes.done() &&
      this.bytes.peek() !== CharCodes.GreaterThan &&
      this.bytes.peekAhead(1) !== CharCodes.GreaterThan
    ) {
      const key = this.parseName();
      if (key === PDFName.of('Contents')) contentsPos = this.bytes.position();
      const value = this.parseObject(ref);
      dict.set(key, value);
      this.skipWhitespaceAndComments();
    }

    this.skipWhitespaceAndComments();
    this.bytes.assertNext(CharCodes.GreaterThan);
    this.bytes.assertNext(CharCodes.GreaterThan);

    const Type = dict.get(PDFName.of('Type'));

    // PDF 32000 7.6.2: strings in the /Contents of signature dictionaries are
    // never encrypted. /Type is optional on signature dictionaries, so an
    // untyped dict carrying /ByteRange counts too. /Type may follow
    // /Contents, so re-read the value without decryption once known.
    const isSignatureDict =
      Type === PDFName.of('Sig') ||
      Type === PDFName.of('DocTimeStamp') ||
      (Type === undefined && dict.get(PDFName.of('ByteRange')) !== undefined);
    if (
      this.cryptoFactory &&
      ref &&
      contentsPos !== undefined &&
      isSignatureDict
    ) {
      const contents = dict.get(PDFName.of('Contents'));
      if (contents instanceof PDFString || contents instanceof PDFHexString) {
        const resumeAt = this.bytes.position();
        this.bytes.restorePosition(contentsPos);
        dict.set(PDFName.of('Contents'), this.parseObject());
        this.bytes.restorePosition(resumeAt);
      }
    }

    if (Type === PDFName.of('Catalog')) {
      return PDFCatalog.fromMapWithContext(dict, this.context);
    } else if (Type === PDFName.of('Pages')) {
      return PDFPageTree.fromMapWithContext(dict, this.context);
    } else if (Type === PDFName.of('Page')) {
      return PDFPageLeaf.fromMapWithContext(dict, this.context);
    } else {
      return PDFDict.fromMapWithContext(dict, this.context);
    }
  }

  protected parseDictOrStream(ref?: PDFRef): PDFDict | PDFStream {
    const startPos = this.bytes.position();

    const dict = this.parseDict(ref);

    this.skipWhitespaceAndComments();

    if (
      !(
        this.matchKeyword(Keywords.streamEOF1) ||
        this.matchKeyword(Keywords.streamEOF2) ||
        this.matchKeyword(Keywords.streamEOF3) ||
        this.matchKeyword(Keywords.streamEOF4) ||
        this.matchKeyword(Keywords.stream)
      )
    ) {
      return dict;
    }

    const start = this.bytes.position();
    let end: number;

    // Honour /Length when it is a direct number, or an indirect reference to
    // a number that has already been parsed into the context. Either way the
    // value is only trusted if `endstream` follows it.
    const Length = dict.get(PDFName.of('Length'));
    const length = this.resolveStreamLength(Length);
    if (length !== undefined) {
      end = start.offset + length;
      this.bytes.moveTo(end);
      this.skipWhitespaceAndComments();
      if (!this.matchKeyword(Keywords.endstream)) {
        this.bytes.restorePosition(start);
        end = this.findEndOfStreamFallback(startPos);
      }
    } else {
      end = this.findEndOfStreamFallback(startPos);
    }

    const stream = PDFRawStream.of(
      dict,
      this.decryptStreamBytes(this.bytes.slice(start.offset, end), ref),
    );

    // An indirect /Length usually points to an object that follows the
    // stream, so the scan above may have dropped a trailing EOL byte that is
    // really data. Even when it resolved, an incremental update may redefine
    // the length object later in the file. Revisit every indirect length
    // once the whole document has been parsed.
    if (Length instanceof PDFRef) {
      this.pendingStreamLengths.push({
        stream,
        ref,
        lengthRef: Length,
        start: start.offset,
        end,
      });
    }

    return stream;
  }

  private decryptStreamBytes(bytes: Uint8Array, ref?: PDFRef): Uint8Array {
    if (!this.cryptoFactory || !ref) return bytes;
    return this.cryptoFactory
      .createCipherTransform(ref.objectNumber, ref.generationNumber)
      .decryptStreamBytes(bytes);
  }

  /**
   * Re-slices streams with an indirect /Length whose final value (after all
   * revisions are parsed) differs from the extent used at parse time. Call
   * after every object is in the context. A length is applied only if
   * `endstream` (after optional whitespace) follows it.
   */
  resolvePendingStreamLengths(): void {
    const pending = this.pendingStreamLengths;
    if (pending.length === 0) return;
    const saved = this.bytes.position();
    for (const { stream, ref, lengthRef, start, end } of pending) {
      const length = this.resolveStreamLength(lengthRef);
      if (length === undefined || start + length === end) continue;
      if (!this.endstreamFollows(start + length)) continue;
      stream.contents = this.decryptStreamBytes(
        this.bytes.slice(start, start + length),
        ref,
      );
    }
    pending.length = 0;
    this.bytes.restorePosition(saved);
  }

  private endstreamFollows(offset: number): boolean {
    this.bytes.moveTo(offset);
    this.skipWhitespaceAndComments();
    return this.matchKeyword(Keywords.endstream);
  }

  /**
   * Returns the stream length declared by `/Length` if it is usable: a
   * non-negative integer given directly or via an indirect reference whose
   * target is already in the context. Indirect lengths whose object hasn't
   * been parsed yet (commonly it follows the stream) yield `undefined`.
   */
  private resolveStreamLength(Length: PDFObject | undefined) {
    let value: PDFObject | undefined = Length;
    if (value instanceof PDFRef) value = this.context.lookup(value);
    if (!(value instanceof PDFNumber)) return;
    const n = value.asNumber();
    return Number.isInteger(n) && n >= 0 ? n : undefined;
  }

  protected findEndOfStreamFallback(startPos: Position) {
    // Move to end of stream, while handling nested streams
    let nestingLvl = 1;
    let end = this.bytes.offset();

    while (!this.bytes.done()) {
      end = this.bytes.offset();

      // Only match "stream" if it's preceded by a valid delimiter character
      // This prevents matching words like "bitstream" as a stream keyword
      if (this.matchPrefixedKeyword(Keywords.stream)) {
        nestingLvl += 1;
      } else if (
        this.matchKeyword(Keywords.EOF1endstream) ||
        this.matchKeyword(Keywords.EOF2endstream) ||
        this.matchKeyword(Keywords.EOF3endstream) ||
        this.matchKeyword(Keywords.endstream)
      ) {
        nestingLvl -= 1;
      } else {
        this.bytes.next();
      }

      if (nestingLvl === 0) break;
    }

    if (nestingLvl !== 0) throw new PDFStreamParsingError(startPos);

    return end;
  }

  /**
   * Match a keyword only if it's preceded by a valid delimiter character.
   * This prevents matching keywords that appear within longer words
   * (e.g., "bitstream" should not match "stream").
   */
  private matchPrefixedKeyword(keyword: number[]): boolean {
    const currentOffset = this.bytes.offset();

    // Check if the previous character is a valid delimiter
    if (currentOffset > 0) {
      const prevByte = this.bytes.peekAt(currentOffset - 1);
      if (prevByte === undefined) {
        return false;
      }
      // Valid delimiters before "stream": whitespace, newline, carriage return,
      // tab, or PDF delimiter characters like < > ( ) [ ] / %
      const isValidPrefix =
        IsWhitespace[prevByte] ||
        prevByte === CharCodes.LessThan ||
        prevByte === CharCodes.GreaterThan ||
        prevByte === CharCodes.LeftParen ||
        prevByte === CharCodes.RightParen ||
        prevByte === CharCodes.LeftSquareBracket ||
        prevByte === CharCodes.RightSquareBracket ||
        prevByte === CharCodes.ForwardSlash ||
        prevByte === CharCodes.Percent;

      if (!isValidPrefix) {
        return false;
      }
    }

    return this.matchKeyword(keyword);
  }
}

export default PDFObjectParser;
