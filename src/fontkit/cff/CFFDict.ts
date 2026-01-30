import isEqual from 'fast-deep-equal';
import { PropertyDescriptor } from '../../vendors/restructure/index.js';
import CFFOperand from './CFFOperand.js';

export type CFFDictOp = [number | [number, number], string, any, any];

export default class CFFDict {
  ops: CFFDictOp[];
  fields: Record<number, CFFDictOp>;

  constructor(ops: CFFDictOp[] = []) {
    this.ops = ops;
    this.fields = {};
    for (const field of ops) {
      const key = Array.isArray(field[0])
        ? (field[0][0] << 8) | field[0][1]
        : field[0];
      this.fields[key] = field;
    }
  }

  decodeOperands(type: any, stream: any, ret: any, operands: any[]): any {
    if (Array.isArray(type)) {
      return operands.map((op, i) =>
        this.decodeOperands(type[i], stream, ret, [op]),
      );
    } else if (type.decode != null) {
      return type.decode(stream, ret, operands);
    } else {
      switch (type) {
        case 'number':
        case 'offset':
        case 'sid':
          return operands[0];
        case 'boolean':
          return !!operands[0];
        default:
          return operands;
      }
    }
  }

  encodeOperands(type: any, stream: any, ctx: any, operands: any): any[] {
    if (Array.isArray(type)) {
      return operands.map(
        (op: any, i: number) =>
          this.encodeOperands(type[i], stream, ctx, op)[0],
      );
    } else if (type.encode != null) {
      return type.encode(stream, operands, ctx);
    } else if (typeof operands === 'number') {
      return [operands];
    } else if (typeof operands === 'boolean') {
      return [+operands];
    } else if (Array.isArray(operands)) {
      return operands;
    } else {
      return [operands];
    }
  }

  decode(stream: any, parent: any): Record<string, any> {
    const end = stream.pos + parent.length;
    const ret: Record<string, any> = {};
    let operands: (number | null)[] = [];

    // define hidden properties
    Object.defineProperties(ret, {
      parent: { value: parent },
      _startOffset: { value: stream.pos },
    });

    // fill in defaults
    for (const key in this.fields) {
      const field = this.fields[key]!;
      ret[field[1]] = field[3];
    }

    while (stream.pos < end) {
      let b = stream.readUInt8();
      if (b < 28) {
        if (b === 12) {
          b = (b << 8) | stream.readUInt8();
        }

        const field = this.fields[b];
        if (!field) {
          throw new Error(`Unknown operator ${b}`);
        }

        const val = this.decodeOperands(field[2], stream, ret, operands);
        if (val != null) {
          if (val instanceof PropertyDescriptor) {
            Object.defineProperty(ret, field[1], val);
          } else {
            ret[field[1]] = val;
          }
        }

        operands = [];
      } else {
        operands.push(CFFOperand.decode(stream, b));
      }
    }

    return ret;
  }

  size(
    dict: Record<string, any>,
    parent: any,
    includePointers: boolean = true,
  ): number {
    const ctx: Record<string, any> = {
      parent,
      val: dict,
      pointerSize: 0,
      startOffset: parent.startOffset || 0,
    };

    let len = 0;

    for (const k in this.fields) {
      const field = this.fields[k]!;
      const val = dict[field[1]];
      if (val == null || isEqual(val, field[3])) {
        continue;
      }

      const operands = this.encodeOperands(field[2], null, ctx, val);
      for (const op of operands) {
        len += CFFOperand.size(op);
      }

      const key = Array.isArray(field[0]) ? field[0] : [field[0]];
      len += key.length;
    }

    if (includePointers) {
      len += ctx['pointerSize'];
    }

    return len;
  }

  encode(stream: any, dict: Record<string, any>, parent: any): void {
    const ctx: Record<string, any> = {
      pointers: [] as any[],
      startOffset: stream.pos,
      parent,
      val: dict,
      pointerSize: 0,
    };

    ctx['pointerOffset'] = stream.pos + this.size(dict, ctx, false);

    for (const field of this.ops) {
      const val = dict[field[1]];
      if (val == null || isEqual(val, field[3])) {
        continue;
      }

      const operands = this.encodeOperands(field[2], stream, ctx, val);
      for (const op of operands) {
        CFFOperand.encode(stream, op);
      }

      const key = Array.isArray(field[0]) ? field[0] : [field[0]];
      for (const op of key) {
        stream.writeUInt8(op);
      }
    }

    let i = 0;
    while (i < ctx['pointers'].length) {
      const ptr = ctx['pointers'][i++];
      ptr.type.encode(stream, ptr.val, ptr.parent);
    }

    return;
  }
}
