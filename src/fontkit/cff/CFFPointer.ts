import * as r from '../../vendors/restructure/index.js';
import type { NumberT } from '../../vendors/restructure/Number.js';
import type { ForceLargeValue } from './CFFOperand.js';

// CFFPointer uses a custom approach where offsetType is dynamically replaced
// with partial implementations. We cast to any to allow this flexibility.
export default class CFFPointer extends r.Pointer {
  constructor(type: any, options: Record<string, any> = {}) {
    if (options['type'] == null) {
      options['type'] = 'global';
    }

    // Pass a dummy NumberT - it will be replaced dynamically
    super(r.uint8 as NumberT, type, options);
  }

  override decode(stream: any, parent: any, operands?: number[]): any {
    // Replace offsetType with a minimal implementation that returns the operand
    this.offsetType = {
      decode: () => operands?.[0] ?? 0,
    } as unknown as NumberT;

    return super.decode(stream, parent);
  }

  override encode(stream: any, value: any, ctx: any): Ptr[] {
    if (!stream) {
      // compute the size (so ctx.pointerSize is correct)
      this.offsetType = {
        size: () => 0,
      } as unknown as NumberT;

      this.size(value, ctx);
      return [new Ptr(0)];
    }

    let ptr: number | null = null;
    this.offsetType = {
      encode: (_stream: any, val: number) => (ptr = val),
    } as unknown as NumberT;

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
