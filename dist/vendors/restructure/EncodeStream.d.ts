/**
 * Restructure - EncodeStream
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
export declare class EncodeStream {
    buffer: Uint8Array;
    view: DataView;
    pos: number;
    constructor(buffer: Uint8Array);
    writeBuffer(buffer: Uint8Array): void;
    writeString(string: string, encoding?: string): void;
    writeUInt8(val: number): void;
    writeUInt16BE(val: number): void;
    writeUInt16LE(val: number): void;
    writeUInt24BE(val: number): void;
    writeUInt24LE(val: number): void;
    writeUInt32BE(val: number): void;
    writeUInt32LE(val: number): void;
    writeInt8(val: number): void;
    writeInt16BE(val: number): void;
    writeInt16LE(val: number): void;
    writeInt24BE(val: number): void;
    writeInt24LE(val: number): void;
    writeInt32BE(val: number): void;
    writeInt32LE(val: number): void;
    writeFloatBE(val: number): void;
    writeFloatLE(val: number): void;
    writeDoubleBE(val: number): void;
    writeDoubleLE(val: number): void;
    fill(val: number, length: number): void;
}
//# sourceMappingURL=EncodeStream.d.ts.map