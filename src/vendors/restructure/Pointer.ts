/**
 * Restructure - Pointer type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */

import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import type { NumberT } from './Number.js';
import { PropertyDescriptor } from './utils.js';

type PointerType = 'local' | 'immediate' | 'parent' | 'global';

interface PointerOptions {
  type?: PointerType;
  allowNull?: boolean;
  nullValue?: number;
  lazy?: boolean;
  relativeTo?: (ctx: unknown) => number;
}

interface DecodeContext {
  _startOffset: number;
  parent?: DecodeContext;
  [key: string]: unknown;
}

interface EncodeContext {
  startOffset: number;
  parent?: EncodeContext;
  val: Record<string, unknown>;
  pointers: Array<{ type: Base; val: unknown; parent: EncodeContext }>;
  pointerOffset: number;
  pointerSize?: number;
}

export class Pointer<T = unknown> extends Base<T | null> {
  offsetType: NumberT;
  type: Base<T> | null;
  options: Omit<Required<PointerOptions>, 'relativeTo'> & {
    relativeTo?: (ctx: unknown) => number;
  };
  relativeToGetter?: (ctx: unknown) => number;

  constructor(
    offsetType: NumberT,
    type: Base<T> | 'void' | null,
    options: PointerOptions = {},
  ) {
    super();
    this.offsetType = offsetType;
    this.type = type === 'void' ? null : type;
    const opts: Omit<Required<PointerOptions>, 'relativeTo'> & {
      relativeTo?: (ctx: unknown) => number;
    } = {
      type: options.type ?? 'local',
      allowNull: options.allowNull ?? true,
      nullValue: options.nullValue ?? 0,
      lazy: options.lazy ?? false,
    };
    if (options.relativeTo) {
      opts.relativeTo = options.relativeTo;
      this.relativeToGetter = options.relativeTo;
    }
    this.options = opts;
  }

  // Note: Returns PropertyDescriptor or number for special cases (lazy, void pointer)
  // These are handled appropriately by fontkit's callers
  decode(stream: DecodeStream, ctx?: DecodeContext): T | null {
    const offset = this.offsetType.decode(stream);

    if (offset === this.options.nullValue && this.options.allowNull) {
      return null;
    }

    const context = ctx as DecodeContext;
    let relative: number;
    switch (this.options.type) {
      case 'local':
        relative = context._startOffset;
        break;
      case 'immediate':
        relative = stream.pos - this.offsetType.size();
        break;
      case 'parent':
        relative = context.parent!._startOffset;
        break;
      default: {
        let c: DecodeContext | undefined = context;
        while (c?.parent) {
          c = c.parent;
        }
        relative = c?._startOffset || 0;
      }
    }

    if (this.relativeToGetter) {
      relative += this.relativeToGetter(context);
    }

    const ptr = offset + relative;

    if (this.type != null) {
      let val: T | null = null;
      const decodeValue = (): T => {
        if (val != null) {
          return val;
        }

        const { pos } = stream;
        stream.pos = ptr;
        val = this.type!.decode(stream, context);
        stream.pos = pos;
        return val;
      };

      if (this.options.lazy) {
        // For lazy pointers, return PropertyDescriptor cast as T
        // The caller (fontkit Struct) handles this specially via Object.defineProperty
        return new PropertyDescriptor({ get: decodeValue }) as unknown as T;
      }

      return decodeValue();
    } else {
      // For void pointers, return the raw offset as unknown as T
      return ptr as unknown as T;
    }
  }

  size(val?: T | VoidPointer<T> | null | undefined, ctx?: unknown): number {
    const encodeCtx = ctx as EncodeContext | undefined;
    const parent = encodeCtx;
    let sizeCtx: EncodeContext | undefined = encodeCtx;

    switch (this.options.type) {
      case 'local':
      case 'immediate':
        break;
      case 'parent':
        sizeCtx = encodeCtx?.parent;
        break;
      default:
        while (sizeCtx?.parent) {
          sizeCtx = sizeCtx.parent;
        }
    }

    let type = this.type;
    let value: T | null = val as T | null;

    if (type == null) {
      if (!(val instanceof VoidPointer)) {
        throw new Error('Must be a VoidPointer');
      }
      type = val.type;
      value = val.value;
    }

    if (value && sizeCtx) {
      const size = type!.size(value, parent);
      sizeCtx.pointerSize = (sizeCtx.pointerSize ?? 0) + size;
    }

    return this.offsetType.size();
  }

  encode(
    stream: EncodeStream,
    val: T | VoidPointer<T> | null,
    ctx: EncodeContext,
  ): void {
    const parent = ctx;

    if (val == null) {
      this.offsetType.encode(stream, this.options.nullValue);
      return;
    }

    let relative: number;
    let encodeCtx: EncodeContext | undefined = ctx;

    switch (this.options.type) {
      case 'local':
        relative = ctx.startOffset;
        break;
      case 'immediate':
        relative = stream.pos + this.offsetType.size();
        break;
      case 'parent':
        encodeCtx = ctx.parent;
        relative = encodeCtx!.startOffset;
        break;
      default:
        relative = 0;
        while (encodeCtx?.parent) {
          encodeCtx = encodeCtx.parent;
        }
    }

    if (this.relativeToGetter) {
      relative += this.relativeToGetter(parent.val);
    }

    this.offsetType.encode(stream, encodeCtx!.pointerOffset - relative);

    let type = this.type;
    let value: T | null = val as T | null;

    if (type == null) {
      if (!(val instanceof VoidPointer)) {
        throw new Error('Must be a VoidPointer');
      }
      type = val.type;
      value = val.value;
    }

    encodeCtx!.pointers.push({
      type: type!,
      val: value,
      parent,
    });

    encodeCtx!.pointerOffset += type!.size(value, parent);
  }
}

// A pointer whose type is determined at decode time
export class VoidPointer<T = unknown> {
  type: Base<T>;
  value: T;

  constructor(type: Base<T>, value: T) {
    this.type = type;
    this.value = value;
  }
}
