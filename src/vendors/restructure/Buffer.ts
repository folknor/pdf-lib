/**
 * Restructure - Buffer type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */

import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import { NumberT } from './Number.js';
import * as utils from './utils.js';

type LengthType = number | string | NumberT | ((parent: unknown) => number);

export class BufferT extends Base<Uint8Array> {
  length: LengthType | undefined;

  constructor(length?: LengthType) {
    super();
    this.length = length;
  }

  decode(stream: DecodeStream, parent?: Record<string, unknown>): Uint8Array {
    const length = utils.resolveLength(this.length, stream, parent ?? null);
    return stream.readBuffer(length);
  }

  size(val?: Uint8Array | null, parent?: Record<string, unknown>): number {
    if (!val) {
      return utils.resolveLength(this.length, null, parent ?? null);
    }

    let len = val.length;
    if (this.length instanceof NumberT) {
      len += this.length.size();
    }

    return len;
  }

  encode(stream: EncodeStream, buf: Uint8Array): void {
    if (this.length instanceof NumberT) {
      this.length.encode(stream, buf.length);
    }

    stream.writeBuffer(buf);
  }
}

export { BufferT as Buffer };
