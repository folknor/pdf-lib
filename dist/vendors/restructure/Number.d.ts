/**
 * Restructure - Number types
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
import { type DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
type NumberType = 'UInt8' | 'UInt16' | 'UInt24' | 'UInt32' | 'Int8' | 'Int16' | 'Int24' | 'Int32' | 'Float' | 'Double';
type Endian = 'BE' | 'LE';
export declare class NumberT extends Base<number> {
    type: NumberType;
    endian: Endian;
    fn: string;
    constructor(type: NumberType, endian?: Endian);
    size(): number;
    decode(stream: DecodeStream): number;
    encode(stream: EncodeStream, val: number): void;
}
export declare const uint8: NumberT;
export declare const uint16be: NumberT;
export declare const uint16: NumberT;
export declare const uint16le: NumberT;
export declare const uint24be: NumberT;
export declare const uint24: NumberT;
export declare const uint24le: NumberT;
export declare const uint32be: NumberT;
export declare const uint32: NumberT;
export declare const uint32le: NumberT;
export declare const int8: NumberT;
export declare const int16be: NumberT;
export declare const int16: NumberT;
export declare const int16le: NumberT;
export declare const int24be: NumberT;
export declare const int24: NumberT;
export declare const int24le: NumberT;
export declare const int32be: NumberT;
export declare const int32: NumberT;
export declare const int32le: NumberT;
export declare const floatbe: NumberT;
export declare const float: NumberT;
export declare const floatle: NumberT;
export declare const doublebe: NumberT;
export declare const double: NumberT;
export declare const doublele: NumberT;
export declare class Fixed extends NumberT {
    _point: number;
    constructor(size: 16 | 32, endian: Endian, fracBits?: number);
    decode(stream: DecodeStream): number;
    encode(stream: EncodeStream, val: number): void;
}
export declare const fixed16be: Fixed;
export declare const fixed16: Fixed;
export declare const fixed16le: Fixed;
export declare const fixed32be: Fixed;
export declare const fixed32: Fixed;
export declare const fixed32le: Fixed;
export { NumberT as Number };
//# sourceMappingURL=Number.d.ts.map