import { charFromCode } from '../../utils/index.js';
import { NumberParsingError } from '../errors.js';
import type ByteStream from '../parser/ByteStream.js';
import CharCodes from '../syntax/CharCodes.js';
import { IsDigit, IsNumeric } from '../syntax/Numeric.js';
import { IsWhitespace } from '../syntax/Whitespace.js';
import type { PDFWarning } from '../warnings.js';

const { Newline, CarriageReturn } = CharCodes;

// TODO: Throw error if eof is reached before finishing object parse...
abstract class BaseParser {
  protected readonly bytes: ByteStream;
  protected readonly capNumbers: boolean;

  constructor(bytes: ByteStream, capNumbers = false) {
    this.bytes = bytes;
    this.capNumbers = capNumbers;
  }

  /**
   * Reports a warning about the bytes at `offset` of this parser's stream;
   * the subclass routes it to its document, once per offset.
   */
  protected abstract warnAt(offset: number, warning: PDFWarning): void;

  protected parseRawInt(): number {
    let value = '';

    while (!this.bytes.done()) {
      const byte = this.bytes.peek();

      if (!IsDigit[byte]) break;
      value += charFromCode(this.bytes.next());
    }

    const numberValue = Number(value);

    if (!(value && Number.isFinite(numberValue))) {
      throw new NumberParsingError(this.bytes.position(), value);
    }

    return numberValue;
  }

  // TODO: Maybe handle exponential format?
  // TODO: Compare performance of string concatenation to charFromCode(...bytes)
  protected parseRawNumber(): number {
    let value = '';

    // Parse integer-part, the leading (+ | - | . | 0-9)
    while (!this.bytes.done()) {
      const byte = this.bytes.peek();

      if (!IsNumeric[byte]) break;
      value += charFromCode(this.bytes.next());

      if (byte === CharCodes.Period) break;
    }

    // Parse decimal-part, the trailing (0-9)
    while (!this.bytes.done()) {
      const byte = this.bytes.peek();

      if (!IsDigit[byte]) break;
      value += charFromCode(this.bytes.next());
    }

    const numberValue = Number(value);

    if (!(value && Number.isFinite(numberValue))) {
      throw new NumberParsingError(this.bytes.position(), value);
    }

    if (numberValue > Number.MAX_SAFE_INTEGER) {
      const start = this.bytes.offset() - value.length;

      if (this.capNumbers) {
        this.warnAt(start, {
          code: 'number-too-large-capped',
          message: `Parsed number that is too large for some PDF readers: ${value}, using Number.MAX_SAFE_INTEGER instead.`,
        });

        return Number.MAX_SAFE_INTEGER;
      }

      this.warnAt(start, {
        code: 'number-too-large',
        message: `Parsed number that is too large for some PDF readers: ${value}, not capping.`,
      });
    }

    return numberValue;
  }

  protected skipWhitespace(): void {
    while (!this.bytes.done() && IsWhitespace[this.bytes.peek()]) {
      this.bytes.next();
    }
  }

  protected skipLine(): void {
    while (!this.bytes.done()) {
      const byte = this.bytes.peek();

      if (byte === Newline || byte === CarriageReturn) return;
      this.bytes.next();
    }
  }

  protected skipComment(): boolean {
    if (this.bytes.peek() !== CharCodes.Percent) return false;

    while (!this.bytes.done()) {
      const byte = this.bytes.peek();

      if (byte === Newline || byte === CarriageReturn) return true;
      this.bytes.next();
    }

    return true;
  }

  protected skipWhitespaceAndComments(): void {
    this.skipWhitespace();

    while (this.skipComment()) this.skipWhitespace();
  }

  protected matchKeyword(keyword: number[]): boolean {
    const initialOffset = this.bytes.offset();

    for (let idx = 0, len = keyword.length; idx < len; idx++) {
      if (this.bytes.done() || this.bytes.next() !== keyword[idx]) {
        this.bytes.moveTo(initialOffset);

        return false;
      }
    }

    return true;
  }
}

export default BaseParser;
