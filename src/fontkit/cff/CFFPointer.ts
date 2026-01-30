// @ts-nocheck
import * as r from '../../vendors/restructure/index.js';
import type { ForceLargeValue } from './CFFOperand.js';

export default class CFFPointer extends r.Pointer {
  constructor(type: any, options: Record<string, any> = {}) {
    if (options.type == null) {
      options.type = 'global';
    }

    super(null, type, options);
  }

  override decode(stream: any, parent: any, operands: number[]): any {
    this.offsetType = {
      decode: () => operands[0],
    };

    return super.decode(stream, parent, operands);
  }

  override encode(stream: any, value: any, ctx: any): Ptr[] {
    if (!stream) {
      // compute the size (so ctx.pointerSize is correct)
      this.offsetType = {
        size: () => 0,
      };

      this.size(value, ctx);
      return [new Ptr(0)];
    }

    let ptr: number | null = null;
    this.offsetType = {
      encode: (_stream: any, val: number) => (ptr = val),
    };

    super.encode(stream, value, ctx);
    return [new Ptr(ptr!)];
  }
}

class Ptr implements ForceLargeValue {
  val: number;
  forceLarge: boolean;

  constructor(val: number) {
    this.val = val;
    this.forceLarge = true;
  }

  valueOf(): number {
    return this.val;
  }
}
