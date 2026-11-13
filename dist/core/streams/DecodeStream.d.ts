import Stream, { type StreamType } from './Stream.js';
/**
 * Default cap on a single decoded stream: 512 MiB. Real-world content streams
 * and images rarely exceed tens of MB decoded (a 10000x10000 RGBA image is
 * 400 MB), while this still stops bombs well before exhausting typical
 * JS heaps.
 */
export declare const DEFAULT_MAX_DECODED_SIZE: number;
/**
 * Super class for the decoding streams
 */
declare class DecodeStream implements StreamType {
    /**
     * Default upper bound (in bytes) on the decoded size of a single stream,
     * guarding against decompression bombs (a few KB of Flate data can expand
     * to many GB). Applies to every DecodeStream (stream filters used while
     * parsing, by forms, by embedders, ...); a document loaded with
     * `LoadOptions.maxDecodedStreamSize` overrides it for its own streams. Set
     * to `Infinity` to disable. Not covered: PNG embedding, which inflates via
     * fflate in src/vendors/upng.ts rather than through DecodeStream.
     */
    static maxDecodedSize: number;
    /**
     * Limit for this stream instance; defaults to the static value at
     * construction time.
     */
    maxDecodedSize: number;
    protected bufferLength: number;
    protected buffer: Uint8Array;
    protected eof: boolean;
    private pos;
    private minBufferLength;
    constructor(maybeMinBufferLength?: number);
    get isEmpty(): boolean;
    getByte(): number;
    getUint16(): number;
    getInt32(): number;
    getBytes(length: number, forceClamped?: boolean): Uint8Array<ArrayBufferLike> | Uint8ClampedArray<ArrayBuffer>;
    peekByte(): number;
    peekBytes(length: number, forceClamped?: boolean): Uint8Array<ArrayBufferLike> | Uint8ClampedArray<ArrayBuffer>;
    skip(n: number): void;
    reset(): void;
    makeSubStream(start: number, length: number): Stream;
    decode(): Uint8Array;
    protected readBlock(): void;
    /**
     * Reads one block and enforces the decoded-size cap on the output actually
     * produced (not on decoders' reservation estimates).
     */
    private readBlockChecked;
    protected ensureBuffer(requested: number): Uint8Array<ArrayBufferLike>;
}
export default DecodeStream;
//# sourceMappingURL=DecodeStream.d.ts.map