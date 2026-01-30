/**
 * Restructure - LazyArray type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */

import { ArrayT } from './Array.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import { NumberT } from './Number.js';
import * as utils from './utils.js';

interface LazyArrayContext {
  parent?: unknown;
  _startOffset: number;
  _currentOffset: number;
  _length: number;
}

class LazyArrayValue<T> {
  type: {
    size: (val: T | null, ctx: unknown) => number;
    decode: (stream: DecodeStream, ctx: unknown) => T;
  };
  length: number;
  stream: DecodeStream;
  ctx: unknown;
  base: number;
  items: (T | undefined)[];

  constructor(
    type: {
      size: (val: T | null, ctx: unknown) => number;
      decode: (stream: DecodeStream, ctx: unknown) => T;
    },
    length: number,
    stream: DecodeStream,
    ctx: unknown,
  ) {
    this.type = type;
    this.length = length;
    this.stream = stream;
    this.ctx = ctx;
    this.base = this.stream.pos;
    this.items = [];
  }

  get(index: number): T | undefined {
    if (index < 0 || index >= this.length) {
      return;
    }

    if (this.items[index] == null) {
      const { pos } = this.stream;
      this.stream.pos = this.base + this.type.size(null, this.ctx) * index;
      this.items[index] = this.type.decode(this.stream, this.ctx);
      this.stream.pos = pos;
    }

    return this.items[index];
  }

  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.length; i++) {
      result.push(this.get(i)!);
    }
    return result;
  }
}

export class LazyArray<T = unknown> extends ArrayT<T> {
  override decode(stream: DecodeStream, parent?: unknown): T[] {
    const { pos } = stream;
    const length = utils.resolveLength(
      this.length,
      stream,
      parent as Record<string, unknown> | null,
    );

    let ctx: unknown = parent;
    if (this.length instanceof NumberT) {
      ctx = {
        parent,
        _startOffset: pos,
        _currentOffset: 0,
        _length: length,
      } as LazyArrayContext;
    }

    const res = new LazyArrayValue(this.type, length, stream, ctx);

    stream.pos += length * this.type.size(null, ctx);
    // Return LazyArrayValue cast as T[] - consumers handle both types
    return res as unknown as T[];
  }

  override size(
    val?: T[] | LazyArrayValue<T> | null,
    ctx?: { parent?: unknown; pointerSize: number },
  ): number {
    if (val instanceof LazyArrayValue) {
      val = val.toArray();
    }

    return super.size(val as T[] | null, ctx);
  }

  override encode(
    stream: EncodeStream,
    val: T[] | LazyArrayValue<T>,
    ctx?: unknown,
  ): void {
    if (val instanceof LazyArrayValue) {
      val = val.toArray();
    }

    super.encode(stream, val, ctx);
  }
}
