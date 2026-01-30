/**
 * Restructure - Struct type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */

import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import { PropertyDescriptor } from './utils.js';

export type FieldDefinition =
  | Base
  | ((res: Record<string, unknown>) => unknown);
export type Fields = Record<string, FieldDefinition>;

interface StructContext {
  parent?: unknown;
  _startOffset: number;
  _currentOffset: number;
  _length: number;
  [key: string]: unknown;
}

interface EncodeStructContext {
  pointers: Array<{ type: Base; val: unknown; parent: EncodeStructContext }>;
  startOffset: number;
  parent?: unknown;
  val: Record<string, unknown>;
  pointerOffset: number;
  pointerSize: number;
}

export class Struct extends Base<Record<string, unknown>> {
  fields: Fields;
  process?: (this: Record<string, unknown>, stream: DecodeStream) => void;
  preEncode?: (this: Record<string, unknown>, stream?: EncodeStream) => void;

  constructor(fields: Fields = {}) {
    super();
    this.fields = fields;
  }

  decode(
    stream: DecodeStream,
    parent?: unknown,
    length = 0,
  ): Record<string, unknown> {
    const res = this._setup(stream, parent, length);
    this._parseFields(stream, res, this.fields);

    if (this.process != null) {
      this.process.call(res, stream);
    }
    return res;
  }

  _setup(stream: DecodeStream, parent: unknown, length: number): StructContext {
    const res = {} as StructContext;

    Object.defineProperties(res, {
      parent: { value: parent },
      _startOffset: { value: stream.pos },
      _currentOffset: { value: 0, writable: true },
      _length: { value: length },
    });

    return res;
  }

  _parseFields(stream: DecodeStream, res: StructContext, fields: Fields): void {
    for (const key in fields) {
      let val: unknown;
      const type = fields[key]!;
      if (typeof type === 'function') {
        val = type.call(res, res);
      } else {
        val = type.decode(stream, res);
      }

      if (val !== undefined) {
        if (val instanceof PropertyDescriptor) {
          Object.defineProperty(res, key, val);
        } else {
          res[key] = val;
        }
      }

      res._currentOffset = stream.pos - res._startOffset;
    }
  }

  size(
    val?: Record<string, unknown> | null,
    parent?: unknown,
    includePointers = true,
  ): number {
    if (val == null) {
      val = {};
    }
    const ctx = {
      parent,
      val,
      pointerSize: 0,
    };

    if (this.preEncode != null) {
      this.preEncode.call(val);
    }

    let size = 0;
    for (const key in this.fields) {
      const type = this.fields[key]!;
      if (typeof type !== 'function' && type.size != null) {
        size += type.size(val[key], ctx);
      }
    }

    if (includePointers) {
      size += ctx.pointerSize;
    }

    return size;
  }

  encode(
    stream: EncodeStream,
    val: Record<string, unknown>,
    parent?: unknown,
  ): void {
    if (this.preEncode != null) {
      this.preEncode.call(val, stream);
    }

    const ctx: EncodeStructContext = {
      pointers: [],
      startOffset: stream.pos,
      parent,
      val,
      pointerOffset: 0,
      pointerSize: 0,
    };

    ctx.pointerOffset = stream.pos + this.size(val, ctx, false);

    for (const key in this.fields) {
      const type = this.fields[key]!;
      if (typeof type !== 'function' && type.encode != null) {
        type.encode(stream, val[key], ctx);
      }
    }

    let i = 0;
    while (i < ctx.pointers.length) {
      const ptr = ctx.pointers[i++]!;
      ptr.type.encode(stream, ptr.val, ptr.parent);
    }
  }
}
