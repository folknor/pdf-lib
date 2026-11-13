import { DecodedStreamTooLargeError, MethodNotImplementedError, } from '../errors.js';
import Stream from './Stream.js';
/*
 * Copyright 2012 Mozilla Foundation
 *
 * The DecodeStream class contained in this file is a TypeScript port of the
 * JavaScript DecodeStream class in Mozilla's pdf.js project, made available
 * under the Apache 2.0 open source license.
 */
// Lots of DecodeStreams are created whose buffers are never used.  For these
// we share a single empty buffer. This is (a) space-efficient and (b) avoids
// having special cases that would be required if we used |null| for an empty
// buffer.
const emptyBuffer = new Uint8Array(0);
/**
 * Default cap on a single decoded stream: 512 MiB. Real-world content streams
 * and images rarely exceed tens of MB decoded (a 10000x10000 RGBA image is
 * 400 MB), while this still stops bombs well before exhausting typical
 * JS heaps.
 */
export const DEFAULT_MAX_DECODED_SIZE = 512 * 1024 * 1024;
/**
 * How far past the cap a buffer reservation may go. Decoders reserve at most
 * a block ahead (Flate stored blocks <= 64 KiB, LZW/ASCIIHex/RunLength a few
 * KiB), so 1 MiB of headroom never rejects legitimate estimates.
 */
const RESERVATION_SLACK = 1024 * 1024;
/**
 * Super class for the decoding streams
 */
class DecodeStream {
    /**
     * Default upper bound (in bytes) on the decoded size of a single stream,
     * guarding against decompression bombs (a few KB of Flate data can expand
     * to many GB). Applies to every DecodeStream (stream filters used while
     * parsing, by forms, by embedders, ...); a document loaded with
     * `LoadOptions.maxDecodedStreamSize` overrides it for its own streams. Set
     * to `Infinity` to disable. Not covered: PNG embedding, which inflates via
     * fflate in src/vendors/upng.ts rather than through DecodeStream.
     */
    static maxDecodedSize = DEFAULT_MAX_DECODED_SIZE;
    /**
     * Limit for this stream instance; defaults to the static value at
     * construction time.
     */
    maxDecodedSize = DecodeStream.maxDecodedSize;
    bufferLength;
    buffer;
    eof;
    pos;
    minBufferLength;
    constructor(maybeMinBufferLength) {
        this.pos = 0;
        this.bufferLength = 0;
        this.eof = false;
        this.buffer = emptyBuffer;
        this.minBufferLength = 512;
        if (maybeMinBufferLength) {
            // Compute the first power of two that is as big as maybeMinBufferLength.
            while (this.minBufferLength < maybeMinBufferLength) {
                this.minBufferLength *= 2;
            }
        }
    }
    get isEmpty() {
        while (!this.eof && this.bufferLength === 0) {
            this.readBlockChecked();
        }
        return this.bufferLength === 0;
    }
    getByte() {
        const pos = this.pos;
        while (this.bufferLength <= pos) {
            if (this.eof) {
                return -1;
            }
            this.readBlockChecked();
        }
        return this.buffer[this.pos++];
    }
    getUint16() {
        const b0 = this.getByte();
        const b1 = this.getByte();
        if (b0 === -1 || b1 === -1) {
            return -1;
        }
        return (b0 << 8) + b1;
    }
    getInt32() {
        const b0 = this.getByte();
        const b1 = this.getByte();
        const b2 = this.getByte();
        const b3 = this.getByte();
        return (b0 << 24) + (b1 << 16) + (b2 << 8) + b3;
    }
    getBytes(length, forceClamped = false) {
        let end;
        const pos = this.pos;
        if (length) {
            // Reservation only; clamp so a large request can't trip the cap or
            // allocate more than the stream may ever hold.
            this.ensureBuffer(Math.min(pos + length, this.maxDecodedSize));
            end = pos + length;
            while (!this.eof && this.bufferLength < end) {
                this.readBlockChecked();
            }
            const bufEnd = this.bufferLength;
            if (end > bufEnd) {
                end = bufEnd;
            }
        }
        else {
            while (!this.eof) {
                this.readBlockChecked();
            }
            end = this.bufferLength;
        }
        this.pos = end;
        const subarray = this.buffer.subarray(pos, end);
        // `this.buffer` is either a `Uint8Array` or `Uint8ClampedArray` here.
        return forceClamped && !(subarray instanceof Uint8ClampedArray)
            ? new Uint8ClampedArray(subarray)
            : subarray;
    }
    peekByte() {
        const peekedByte = this.getByte();
        this.pos--;
        return peekedByte;
    }
    peekBytes(length, forceClamped = false) {
        const bytes = this.getBytes(length, forceClamped);
        this.pos -= bytes.length;
        return bytes;
    }
    skip(n) {
        if (!n) {
            n = 1;
        }
        this.pos += n;
    }
    reset() {
        this.pos = 0;
    }
    makeSubStream(start, length /* dict */) {
        const end = start + length;
        while (this.bufferLength <= end && !this.eof) {
            this.readBlockChecked();
        }
        return new Stream(this.buffer, start, length /* dict */);
    }
    decode() {
        while (!this.eof)
            this.readBlockChecked();
        return this.buffer.subarray(0, this.bufferLength);
    }
    readBlock() {
        throw new MethodNotImplementedError(this.constructor.name, 'readBlock');
    }
    /**
     * Reads one block and enforces the decoded-size cap on the output actually
     * produced (not on decoders' reservation estimates).
     */
    readBlockChecked() {
        this.readBlock();
        if (this.bufferLength > this.maxDecodedSize) {
            throw new DecodedStreamTooLargeError(this.bufferLength, this.maxDecodedSize);
        }
    }
    ensureBuffer(requested) {
        const buffer = this.buffer;
        if (requested <= buffer.byteLength) {
            return buffer;
        }
        const max = this.maxDecodedSize;
        // Decoders reserve ahead of what they produce (estimates, worst cases),
        // so a reservation past the cap is not itself an error: the cap is
        // enforced on produced output in readBlockChecked(). But a single
        // readBlock() can emit arbitrarily much (one Flate block), so refuse
        // growth once a reservation goes clearly beyond any per-call estimate.
        if (requested > max + RESERVATION_SLACK) {
            throw new DecodedStreamTooLargeError(requested, max);
        }
        let size = this.minBufferLength;
        while (size < requested) {
            size *= 2;
        }
        // Don't let power-of-two growth overshoot the cap needlessly.
        if (size > max)
            size = Math.max(max, requested);
        const buffer2 = new Uint8Array(size);
        buffer2.set(buffer);
        return (this.buffer = buffer2);
    }
}
export default DecodeStream;
//# sourceMappingURL=DecodeStream.js.map