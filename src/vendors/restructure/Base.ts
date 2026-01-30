/**
 * Restructure - Base class
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */

import { DecodeStream } from './DecodeStream.js';
import { EncodeStream } from './EncodeStream.js';

export abstract class Base<T = unknown> {
  abstract decode(stream: DecodeStream, parent?: unknown): T;
  abstract encode(stream: EncodeStream, value: T, parent?: unknown): void;
  abstract size(value?: T | null | undefined, parent?: unknown): number;

  fromBuffer(buffer: Uint8Array): T {
    const stream = new DecodeStream(buffer);
    return this.decode(stream);
  }

  toBuffer(value: T): Uint8Array {
    const size = this.size(value);
    const buffer = new Uint8Array(size);
    const stream = new EncodeStream(buffer);
    this.encode(stream, value);
    return buffer;
  }
}
