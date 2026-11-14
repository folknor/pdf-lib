import { NextByteAssertionError } from '../errors.js';
import type PDFRawStream from '../objects/PDFRawStream.js';
import { decodePDFRawStream } from '../streams/decode.js';
import CharCodes from '../syntax/CharCodes.js';

// TODO: See how line/col tracking affects performance
class ByteStream {
  /**
   * With `copySlices` false, `slice` returns views into `bytes` instead of
   * copies (see `LoadOptions.copyStreams`).
   */
  static of = (bytes: Uint8Array, copySlices = true) =>
    new ByteStream(bytes, copySlices);

  static fromPDFRawStream = (rawStream: PDFRawStream) =>
    ByteStream.of(decodePDFRawStream(rawStream).decode());

  private readonly bytes: Uint8Array;
  private readonly length: number;
  private readonly copySlices: boolean;

  private idx = 0;
  private line = 0;
  private column = 0;

  constructor(bytes: Uint8Array, copySlices = true) {
    this.bytes = bytes;
    this.length = this.bytes.length;
    this.copySlices = copySlices;
  }

  moveTo(offset: number): void {
    this.idx = offset;
  }

  next(): number {
    const byte = this.bytes[this.idx++]!;
    if (byte === CharCodes.Newline) {
      this.line += 1;
      this.column = 0;
    } else {
      this.column += 1;
    }
    return byte;
  }

  assertNext(expected: number): number {
    if (this.peek() !== expected) {
      throw new NextByteAssertionError(this.position(), expected, this.peek());
    }
    return this.next();
  }

  peek(): number {
    return this.bytes[this.idx]!;
  }

  peekAhead(steps: number) {
    return this.bytes[this.idx + steps];
  }

  peekAt(offset: number) {
    return this.bytes[offset];
  }

  done(): boolean {
    return this.idx >= this.length;
  }

  size(): number {
    return this.length;
  }

  offset(): number {
    return this.idx;
  }

  /**
   * The bytes in [start, end): a fresh copy, or with `copySlices` false a
   * view. Copied explicitly rather than with `bytes.slice`, because a Node
   * `Buffer` input's `slice` is itself a view.
   */
  slice(start: number, end: number): Uint8Array {
    const view = this.bytes.subarray(start, end);
    return this.copySlices ? new Uint8Array(view) : view;
  }

  position(): { line: number; column: number; offset: number } {
    return { line: this.line, column: this.column, offset: this.idx };
  }

  /** Restore offset and line/column tracking saved via `position()`. */
  restorePosition(pos: { line: number; column: number; offset: number }) {
    this.idx = pos.offset;
    this.line = pos.line;
    this.column = pos.column;
  }
}

export default ByteStream;
