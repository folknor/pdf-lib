/**
 * Restructure - Array type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */

import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import { NumberT } from './Number.js';
import * as utils from './utils.js';

type LengthType = number | string | NumberT | ((parent: unknown) => number);

interface ArrayContext {
  parent?: unknown;
  _startOffset: number;
  _currentOffset: number;
  _length: number;
  [key: string]: unknown;
}

interface EncodeArrayContext {
  pointers: Array<{ type: Base; val: unknown; parent: EncodeArrayContext }>;
  startOffset: number;
  parent?: unknown;
  pointerOffset: number;
  pointerSize?: number;
}

export class ArrayT<T = unknown> extends Base<T[]> {
  type: Base<T>;
  length: LengthType | undefined;
  lengthType: 'count' | 'bytes';

  constructor(
    type: Base<T>,
    length?: LengthType,
    lengthType: 'count' | 'bytes' = 'count',
  ) {
    super();
    this.type = type;
    this.length = length;
    this.lengthType = lengthType;
  }

  decode(stream: DecodeStream, parent?: unknown): T[] {
    let length: number | undefined;
    const { pos } = stream;

    const res: T[] = [];
    let ctx: unknown = parent;

    if (this.length != null) {
      length = utils.resolveLength(
        this.length,
        stream,
        parent as Record<string, unknown> | null,
      );
    }

    if (this.length instanceof NumberT) {
      Object.defineProperties(res, {
        parent: { value: parent },
        _startOffset: { value: pos },
        _currentOffset: { value: 0, writable: true },
        _length: { value: length },
      });
      ctx = res;
    }

    if (length == null || this.lengthType === 'bytes') {
      const target =
        length != null
          ? stream.pos + length
          : (parent as ArrayContext)?._length
            ? (parent as ArrayContext)._startOffset +
              (parent as ArrayContext)._length
            : stream.length;

      while (stream.pos < target) {
        res.push(this.type.decode(stream, ctx));
      }
    } else {
      for (let i = 0; i < length; i++) {
        res.push(this.type.decode(stream, ctx));
      }
    }

    return res;
  }

  size(
    array?: T[] | null,
    ctx?: { parent?: unknown; pointerSize: number },
    includePointers = true,
  ): number {
    if (!array) {
      return (
        this.type.size(null, ctx) *
        utils.resolveLength(
          this.length,
          null,
          ctx as Record<string, unknown> | null,
        )
      );
    }

    let size = 0;
    let localCtx = ctx;
    if (this.length instanceof NumberT) {
      size += this.length.size();
      localCtx = { parent: ctx, pointerSize: 0 };
    }

    for (const item of array) {
      size += this.type.size(item, localCtx);
    }

    if (localCtx && includePointers && this.length instanceof NumberT) {
      size += localCtx.pointerSize;
    }

    return size;
  }

  encode(stream: EncodeStream, array: T[], parent?: unknown): void {
    let ctx: unknown = parent;

    if (this.length instanceof NumberT) {
      const encodeCtx: EncodeArrayContext = {
        pointers: [],
        startOffset: stream.pos,
        parent,
        pointerOffset: 0,
      };
      encodeCtx.pointerOffset =
        stream.pos +
        this.size(
          array,
          encodeCtx as { parent?: unknown; pointerSize: number },
          false,
        );
      this.length.encode(stream, array.length);
      ctx = encodeCtx;
    }

    for (const item of array) {
      this.type.encode(stream, item, ctx);
    }

    if (this.length instanceof NumberT) {
      const encodeCtx = ctx as EncodeArrayContext;
      let i = 0;
      while (i < encodeCtx.pointers.length) {
        const ptr = encodeCtx.pointers[i++]!;
        ptr.type.encode(stream, ptr.val, ptr.parent);
      }
    }
  }
}

export { ArrayT as Array };
