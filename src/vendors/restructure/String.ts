/**
 * Restructure - String type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */

import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import { NumberT } from './Number.js';
import * as utils from './utils.js';

type EncodingResolver = (parent: unknown) => string;
type LengthType = number | string | NumberT | ((parent: unknown) => number);

function encodingWidth(encoding: string): number {
  switch (encoding) {
    case 'ascii':
    case 'utf8':
      return 1;
    case 'utf16le':
    case 'utf16-le':
    case 'utf-16be':
    case 'utf-16le':
    case 'utf16be':
    case 'utf16-be':
    case 'ucs2':
      return 2;
    default:
      return 1;
  }
}

function byteLength(string: string, encoding: string): number {
  switch (encoding) {
    case 'ascii':
      return string.length;
    case 'utf8': {
      let len = 0;
      for (let i = 0; i < string.length; i++) {
        let c = string.charCodeAt(i);

        if (c >= 0xd800 && c <= 0xdbff && i < string.length - 1) {
          const c2 = string.charCodeAt(++i);
          if ((c2 & 0xfc00) === 0xdc00) {
            c = ((c & 0x3ff) << 10) + (c2 & 0x3ff) + 0x10000;
          } else {
            i--;
          }
        }

        if ((c & 0xffffff80) === 0) {
          len++;
        } else if ((c & 0xfffff800) === 0) {
          len += 2;
        } else if ((c & 0xffff0000) === 0) {
          len += 3;
        } else if ((c & 0xffe00000) === 0) {
          len += 4;
        }
      }
      return len;
    }
    case 'utf16le':
    case 'utf16-le':
    case 'utf16be':
    case 'utf16-be':
    case 'ucs2':
      return string.length * 2;
    default:
      throw new Error(`Unknown encoding ${encoding}`);
  }
}

export class StringT extends Base<string> {
  length: LengthType | undefined;
  encoding: string | EncodingResolver;

  constructor(
    length?: LengthType,
    encoding: string | EncodingResolver = 'ascii',
  ) {
    super();
    this.length = length;
    this.encoding = encoding;
  }

  decode(stream: DecodeStream, parent?: Record<string, unknown>): string {
    let length: number | undefined;

    let encoding = this.encoding;
    if (typeof encoding === 'function') {
      encoding = encoding.call(parent, parent) || 'ascii';
    }
    const width = encodingWidth(encoding);

    if (this.length != null) {
      length = utils.resolveLength(this.length, stream, parent ?? null);
    } else {
      const { buffer, length: streamLength, pos } = stream;
      let p = pos;

      while (
        p < streamLength - width + 1 &&
        (buffer[p] !== 0x00 || (width === 2 && buffer[p + 1] !== 0x00))
      ) {
        p += width;
      }

      length = p - stream.pos;
    }

    const result = stream.readString(length, encoding);

    if (this.length == null && stream.pos < stream.length) {
      stream.pos += width;
    }

    return typeof result === 'string' ? result : '';
  }

  size(
    val?: string | null,
    parent?: { val?: Record<string, unknown> },
  ): number {
    if (val === undefined || val === null) {
      return utils.resolveLength(
        this.length,
        null,
        parent as Record<string, unknown> | null,
      );
    }

    let encoding = this.encoding;
    if (typeof encoding === 'function') {
      encoding = encoding.call(parent?.val, parent?.val) || 'ascii';
    }

    if (encoding === 'utf16be') {
      encoding = 'utf16le';
    }

    let size = byteLength(val, encoding);
    if (this.length instanceof NumberT) {
      size += this.length.size();
    }

    if (this.length == null) {
      size += encodingWidth(encoding);
    }

    return size;
  }

  encode(
    stream: EncodeStream,
    val: string,
    parent?: { val?: Record<string, unknown> },
  ): void {
    let encoding = this.encoding;
    if (typeof encoding === 'function') {
      encoding = encoding.call(parent?.val, parent?.val) || 'ascii';
    }

    if (this.length instanceof NumberT) {
      this.length.encode(stream, byteLength(val, encoding));
    }

    stream.writeString(val, encoding);

    if (this.length == null) {
      if (encodingWidth(encoding) === 2) {
        stream.writeUInt16LE(0x0000);
      } else {
        stream.writeUInt8(0x00);
      }
    }
  }
}

export { StringT as String };
