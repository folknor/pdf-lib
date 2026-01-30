/**
 * Restructure - Number types
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */

import { Base } from './Base.js';
import { type DecodeStream, TYPES } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';

type NumberType =
  | 'UInt8'
  | 'UInt16'
  | 'UInt24'
  | 'UInt32'
  | 'Int8'
  | 'Int16'
  | 'Int24'
  | 'Int32'
  | 'Float'
  | 'Double';
type Endian = 'BE' | 'LE';

export class NumberT extends Base<number> {
  type: NumberType;
  endian: Endian;
  fn: string;

  constructor(type: NumberType, endian: Endian = 'BE') {
    super();
    this.type = type;
    this.endian = endian;
    this.fn = this.type;
    if (this.type[this.type.length - 1] !== '8') {
      this.fn += this.endian;
    }
  }

  size(): number {
    return TYPES[this.type]!;
  }

  decode(stream: DecodeStream): number {
    const method = `read${this.fn}` as keyof DecodeStream;
    return (stream[method] as () => number)();
  }

  encode(stream: EncodeStream, val: number): void {
    const method = `write${this.fn}` as keyof EncodeStream;
    (stream[method] as (value: number) => void)(val);
  }
}

// Pre-defined number types
export const uint8 = new NumberT('UInt8');
export const uint16be = new NumberT('UInt16', 'BE');
export const uint16 = uint16be;
export const uint16le = new NumberT('UInt16', 'LE');
export const uint24be = new NumberT('UInt24', 'BE');
export const uint24 = uint24be;
export const uint24le = new NumberT('UInt24', 'LE');
export const uint32be = new NumberT('UInt32', 'BE');
export const uint32 = uint32be;
export const uint32le = new NumberT('UInt32', 'LE');
export const int8 = new NumberT('Int8');
export const int16be = new NumberT('Int16', 'BE');
export const int16 = int16be;
export const int16le = new NumberT('Int16', 'LE');
export const int24be = new NumberT('Int24', 'BE');
export const int24 = int24be;
export const int24le = new NumberT('Int24', 'LE');
export const int32be = new NumberT('Int32', 'BE');
export const int32 = int32be;
export const int32le = new NumberT('Int32', 'LE');
export const floatbe = new NumberT('Float', 'BE');
export const float = floatbe;
export const floatle = new NumberT('Float', 'LE');
export const doublebe = new NumberT('Double', 'BE');
export const double = doublebe;
export const doublele = new NumberT('Double', 'LE');

// Fixed-point number type
export class Fixed extends NumberT {
  _point: number;

  constructor(size: 16 | 32, endian: Endian, fracBits: number = size >> 1) {
    super(`Int${size}` as NumberType, endian);
    this._point = 1 << fracBits;
  }

  override decode(stream: DecodeStream): number {
    return super.decode(stream) / this._point;
  }

  override encode(stream: EncodeStream, val: number): void {
    super.encode(stream, (val * this._point) | 0);
  }
}

export const fixed16be = new Fixed(16, 'BE');
export const fixed16 = fixed16be;
export const fixed16le = new Fixed(16, 'LE');
export const fixed32be = new Fixed(32, 'BE');
export const fixed32 = fixed32be;
export const fixed32le = new Fixed(32, 'LE');

// Re-export as Number for compatibility
export { NumberT as Number };
