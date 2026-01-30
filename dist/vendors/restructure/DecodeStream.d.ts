/**
 * Restructure - DecodeStream
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
export declare const TYPES: Record<string, number>;
export declare class DecodeStream {
    buffer: Uint8Array;
    view: DataView;
    pos: number;
    length: number;
    constructor(buffer: Uint8Array);
    readString(length: number, encoding?: string): string | Uint8Array;
    readBuffer(length: number): Uint8Array;
    readUInt8(): number;
    readUInt16BE(): number;
    readUInt16LE(): number;
    readUInt24BE(): number;
    readUInt24LE(): number;
    readUInt32BE(): number;
    readUInt32LE(): number;
    readInt8(): number;
    readInt16BE(): number;
    readInt16LE(): number;
    readInt24BE(): number;
    readInt24LE(): number;
    readInt32BE(): number;
    readInt32LE(): number;
    readFloatBE(): number;
    readFloatLE(): number;
    readDoubleBE(): number;
    readDoubleLE(): number;
}
//# sourceMappingURL=DecodeStream.d.ts.map