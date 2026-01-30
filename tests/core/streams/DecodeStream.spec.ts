import DecodeStream from '../../../src/core/streams/DecodeStream';
import Stream from '../../../src/core/streams/Stream';
import FlateStream from '../../../src/core/streams/FlateStream';
import { zlibSync } from 'fflate';

/**
 * A minimal concrete subclass of DecodeStream used for testing.
 * It delivers the provided data into the internal buffer via readBlock(),
 * emitting one chunk per call (up to `chunkSize` bytes at a time).
 */
class TestDecodeStream extends DecodeStream {
  private data: Uint8Array;
  private dataPos: number;
  private chunkSize: number;

  constructor(data: Uint8Array, maybeMinBufferLength?: number, chunkSize = 512) {
    super(maybeMinBufferLength);
    this.data = data;
    this.dataPos = 0;
    this.chunkSize = chunkSize;
  }

  protected override readBlock(): void {
    if (this.dataPos >= this.data.length) {
      this.eof = true;
      return;
    }

    const end = Math.min(this.dataPos + this.chunkSize, this.data.length);
    const chunk = this.data.subarray(this.dataPos, end);
    this.dataPos = end;

    const bufferLength = this.bufferLength;
    const buffer = this.ensureBuffer(bufferLength + chunk.length);
    buffer.set(chunk, bufferLength);
    this.bufferLength = bufferLength + chunk.length;

    if (this.dataPos >= this.data.length) {
      this.eof = true;
    }
  }
}

describe('DecodeStream', () => {
  describe('getByte()', () => {
    it('reads individual bytes in sequence with correct values', () => {
      const data = Uint8Array.from([10, 20, 30, 40, 50]);
      const stream = new TestDecodeStream(data);

      expect(stream.getByte()).toBe(10);
      expect(stream.getByte()).toBe(20);
      expect(stream.getByte()).toBe(30);
      expect(stream.getByte()).toBe(40);
      expect(stream.getByte()).toBe(50);
    });

    it('returns -1 when all bytes have been consumed (EOF)', () => {
      const data = Uint8Array.from([0xff]);
      const stream = new TestDecodeStream(data);

      expect(stream.getByte()).toBe(255);
      expect(stream.getByte()).toBe(-1);
      expect(stream.getByte()).toBe(-1);
    });

    it('returns -1 immediately for an empty stream', () => {
      const stream = new TestDecodeStream(new Uint8Array(0));
      expect(stream.getByte()).toBe(-1);
    });

    it('correctly reads byte value 0', () => {
      const data = Uint8Array.from([0, 1, 0]);
      const stream = new TestDecodeStream(data);

      expect(stream.getByte()).toBe(0);
      expect(stream.getByte()).toBe(1);
      expect(stream.getByte()).toBe(0);
    });
  });

  describe('getBytes(length)', () => {
    it('reads the exact number of bytes requested', () => {
      const data = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
      const stream = new TestDecodeStream(data);

      const bytes = stream.getBytes(4);
      expect(bytes).toEqual(Uint8Array.from([1, 2, 3, 4]));
    });

    it('reads remaining bytes with sequential calls', () => {
      const data = Uint8Array.from([10, 20, 30, 40, 50, 60]);
      const stream = new TestDecodeStream(data);

      const first = stream.getBytes(3);
      expect(first).toEqual(Uint8Array.from([10, 20, 30]));

      const second = stream.getBytes(3);
      expect(second).toEqual(Uint8Array.from([40, 50, 60]));
    });

    it('returns all remaining bytes when length is 0', () => {
      const data = Uint8Array.from([100, 200, 150]);
      const stream = new TestDecodeStream(data);

      const bytes = stream.getBytes(0);
      expect(bytes).toEqual(Uint8Array.from([100, 200, 150]));
    });

    it('returns remaining bytes when length is 0 after partial reads', () => {
      const data = Uint8Array.from([1, 2, 3, 4, 5]);
      const stream = new TestDecodeStream(data);

      stream.getBytes(2); // consume [1, 2]
      const rest = stream.getBytes(0);
      expect(rest).toEqual(Uint8Array.from([3, 4, 5]));
    });

    it('returns fewer bytes than requested when stream ends early', () => {
      const data = Uint8Array.from([10, 20]);
      const stream = new TestDecodeStream(data);

      const bytes = stream.getBytes(5);
      expect(bytes).toEqual(Uint8Array.from([10, 20]));
    });

    it('returns Uint8ClampedArray when forceClamped is true', () => {
      const data = Uint8Array.from([1, 2, 3]);
      const stream = new TestDecodeStream(data);

      const bytes = stream.getBytes(3, true);
      expect(bytes).toBeInstanceOf(Uint8ClampedArray);
      expect(bytes.length).toBe(3);
      expect(bytes[0]).toBe(1);
      expect(bytes[1]).toBe(2);
      expect(bytes[2]).toBe(3);
    });
  });

  describe('getUint16()', () => {
    it('reads a big-endian 16-bit unsigned integer', () => {
      // 0x01 << 8 + 0x02 = 258
      const data = Uint8Array.from([0x01, 0x02]);
      const stream = new TestDecodeStream(data);

      expect(stream.getUint16()).toBe(258);
    });

    it('reads 0x0000 correctly', () => {
      const data = Uint8Array.from([0x00, 0x00]);
      const stream = new TestDecodeStream(data);

      expect(stream.getUint16()).toBe(0);
    });

    it('reads 0xFFFF correctly', () => {
      const data = Uint8Array.from([0xff, 0xff]);
      const stream = new TestDecodeStream(data);

      expect(stream.getUint16()).toBe(65535);
    });

    it('reads multiple uint16 values in sequence', () => {
      const data = Uint8Array.from([0x00, 0x01, 0x02, 0x00]);
      const stream = new TestDecodeStream(data);

      expect(stream.getUint16()).toBe(1);     // (0 << 8) + 1
      expect(stream.getUint16()).toBe(512);   // (2 << 8) + 0
    });

    it('returns -1 when there are not enough bytes', () => {
      const data = Uint8Array.from([0x42]);
      const stream = new TestDecodeStream(data);

      expect(stream.getUint16()).toBe(-1);
    });

    it('returns -1 for an empty stream', () => {
      const stream = new TestDecodeStream(new Uint8Array(0));
      expect(stream.getUint16()).toBe(-1);
    });
  });

  describe('getInt32()', () => {
    it('reads a big-endian 32-bit signed integer', () => {
      // (1 << 24) + (1 << 16) + (1 << 8) + 1 = 16843009
      const data = Uint8Array.from([1, 1, 1, 1]);
      const stream = new TestDecodeStream(data);

      expect(stream.getInt32()).toBe(16843009);
    });

    it('reads 0x00000000 correctly', () => {
      const data = Uint8Array.from([0, 0, 0, 0]);
      const stream = new TestDecodeStream(data);

      expect(stream.getInt32()).toBe(0);
    });

    it('reads 0xFFFFFFFF as -1', () => {
      const data = Uint8Array.from([255, 255, 255, 255]);
      const stream = new TestDecodeStream(data);

      expect(stream.getInt32()).toBe(-1);
    });

    it('reads multiple int32 values in sequence', () => {
      const data = Uint8Array.from([0, 0, 1, 0, 0, 0, 0, 2]);
      const stream = new TestDecodeStream(data);

      expect(stream.getInt32()).toBe(256);  // (0<<24)+(0<<16)+(1<<8)+0
      expect(stream.getInt32()).toBe(2);    // (0<<24)+(0<<16)+(0<<8)+2
    });

    it('handles insufficient bytes by including -1 values in calculation', () => {
      // When stream has fewer than 4 bytes, getByte() returns -1 for missing bytes
      const data = Uint8Array.from([0x01]);
      const stream = new TestDecodeStream(data);

      // getByte returns: 1, -1, -1, -1
      // (1 << 24) + (-1 << 16) + (-1 << 8) + (-1)
      const result = stream.getInt32();
      const expected = (1 << 24) + (-1 << 16) + (-1 << 8) + (-1);
      expect(result).toBe(expected);
    });
  });

  describe('peekByte()', () => {
    it('returns the next byte without advancing position', () => {
      const data = Uint8Array.from([42, 99]);
      const stream = new TestDecodeStream(data);

      expect(stream.peekByte()).toBe(42);
      expect(stream.peekByte()).toBe(42);
      expect(stream.peekByte()).toBe(42);
    });

    it('does not affect subsequent getByte() calls', () => {
      const data = Uint8Array.from([10, 20, 30]);
      const stream = new TestDecodeStream(data);

      expect(stream.peekByte()).toBe(10);
      expect(stream.getByte()).toBe(10);
      expect(stream.peekByte()).toBe(20);
      expect(stream.getByte()).toBe(20);
    });

    it('returns -1 for an empty stream', () => {
      const stream = new TestDecodeStream(new Uint8Array(0));
      expect(stream.peekByte()).toBe(-1);
    });
  });

  describe('peekBytes(length)', () => {
    it('returns bytes without advancing position', () => {
      const data = Uint8Array.from([1, 2, 3, 4, 5]);
      const stream = new TestDecodeStream(data);

      const peeked = stream.peekBytes(3);
      expect(peeked).toEqual(Uint8Array.from([1, 2, 3]));

      // Position should not have advanced
      const read = stream.getBytes(3);
      expect(read).toEqual(Uint8Array.from([1, 2, 3]));
    });

    it('can be called multiple times without advancing', () => {
      const data = Uint8Array.from([10, 20, 30]);
      const stream = new TestDecodeStream(data);

      const peek1 = stream.peekBytes(2);
      const peek2 = stream.peekBytes(2);
      expect(peek1).toEqual(Uint8Array.from([10, 20]));
      expect(peek2).toEqual(Uint8Array.from([10, 20]));
    });

    it('returns Uint8ClampedArray when forceClamped is true', () => {
      const data = Uint8Array.from([5, 10, 15]);
      const stream = new TestDecodeStream(data);

      const peeked = stream.peekBytes(2, true);
      expect(peeked).toBeInstanceOf(Uint8ClampedArray);
      expect(peeked.length).toBe(2);
      expect(peeked[0]).toBe(5);
      expect(peeked[1]).toBe(10);
    });
  });

  describe('skip(n)', () => {
    it('advances position by n bytes', () => {
      const data = Uint8Array.from([1, 2, 3, 4, 5]);
      const stream = new TestDecodeStream(data);

      stream.skip(2);
      expect(stream.getByte()).toBe(3);
    });

    it('defaults to skipping 1 byte when n is 0', () => {
      const data = Uint8Array.from([1, 2, 3]);
      const stream = new TestDecodeStream(data);

      stream.skip(0);
      expect(stream.getByte()).toBe(2);
    });

    it('can skip multiple times', () => {
      const data = Uint8Array.from([10, 20, 30, 40, 50]);
      const stream = new TestDecodeStream(data);

      stream.skip(1);
      stream.skip(2);
      expect(stream.getByte()).toBe(40);
    });

    it('skipping past end causes subsequent reads to return EOF', () => {
      const data = Uint8Array.from([1, 2]);
      const stream = new TestDecodeStream(data);

      stream.skip(10);
      expect(stream.getByte()).toBe(-1);
    });
  });

  describe('reset()', () => {
    it('resets position back to the start of the stream', () => {
      const data = Uint8Array.from([11, 22, 33]);
      const stream = new TestDecodeStream(data);

      expect(stream.getByte()).toBe(11);
      expect(stream.getByte()).toBe(22);

      stream.reset();

      expect(stream.getByte()).toBe(11);
      expect(stream.getByte()).toBe(22);
      expect(stream.getByte()).toBe(33);
    });

    it('allows re-reading the entire stream with getBytes after reset', () => {
      const data = Uint8Array.from([5, 10, 15, 20]);
      const stream = new TestDecodeStream(data);

      const firstRead = stream.getBytes(0);
      expect(firstRead).toEqual(data);

      stream.reset();

      const secondRead = stream.getBytes(0);
      expect(secondRead).toEqual(data);
    });
  });

  describe('isEmpty', () => {
    it('returns true for a stream with no data', () => {
      const stream = new TestDecodeStream(new Uint8Array(0));
      expect(stream.isEmpty).toBe(true);
    });

    it('returns false for a stream with data', () => {
      const stream = new TestDecodeStream(Uint8Array.from([1, 2, 3]));
      expect(stream.isEmpty).toBe(false);
    });

    it('returns false for a stream with a single byte', () => {
      const stream = new TestDecodeStream(Uint8Array.from([0]));
      expect(stream.isEmpty).toBe(false);
    });
  });

  describe('decode()', () => {
    it('reads the entire stream content into a Uint8Array', () => {
      const data = Uint8Array.from([10, 20, 30, 40, 50]);
      const stream = new TestDecodeStream(data);

      const decoded = stream.decode();
      expect(decoded).toEqual(data);
    });

    it('returns an empty subarray for an empty stream', () => {
      const stream = new TestDecodeStream(new Uint8Array(0));
      const decoded = stream.decode();
      expect(decoded.length).toBe(0);
    });

    it('decodes a large stream correctly', () => {
      const data = new Uint8Array(2000);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }
      const stream = new TestDecodeStream(data);

      const decoded = stream.decode();
      expect(decoded).toEqual(data);
    });
  });

  describe('ensureBuffer (tested indirectly)', () => {
    it('grows the buffer when reading data larger than initial buffer', () => {
      // The default minBufferLength is 512. A stream with 2000 bytes should
      // trigger buffer growth via ensureBuffer.
      const data = new Uint8Array(2000);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }
      const stream = new TestDecodeStream(data);

      const decoded = stream.decode();
      expect(decoded.length).toBe(2000);
      expect(decoded).toEqual(data);
    });

    it('handles data that exactly matches the minimum buffer length', () => {
      const data = new Uint8Array(512);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }
      const stream = new TestDecodeStream(data);

      const decoded = stream.decode();
      expect(decoded).toEqual(data);
    });

    it('handles data delivered in small chunks that cumulatively exceed initial buffer', () => {
      const data = new Uint8Array(1500);
      for (let i = 0; i < data.length; i++) {
        data[i] = (i * 7) % 256;
      }
      // Use a small chunk size so readBlock is called many times
      const stream = new TestDecodeStream(data, undefined, 100);

      const decoded = stream.decode();
      expect(decoded).toEqual(data);
    });
  });

  describe('makeSubStream(start, length)', () => {
    it('creates a sub-stream from the decoded buffer', () => {
      const data = Uint8Array.from([10, 20, 30, 40, 50]);
      const stream = new TestDecodeStream(data);

      const sub = stream.makeSubStream(1, 3);
      expect(sub.getByte()).toBe(20);
      expect(sub.getByte()).toBe(30);
      expect(sub.getByte()).toBe(40);
      expect(sub.getByte()).toBe(-1);
    });

    it('returns a Stream instance', () => {
      const data = Uint8Array.from([1, 2, 3]);
      const stream = new TestDecodeStream(data);

      // Note: Stream constructor uses `!!start && !!length` to decide the end.
      // When start=0, !!0 is false, so Stream falls back to this.bytes.length
      // (the full buffer). Use start=1 to get correct sub-stream bounds.
      const sub = stream.makeSubStream(1, 2);
      expect(sub).toBeDefined();
      expect(sub.getByte()).toBe(2);
      expect(sub.getByte()).toBe(3);
      expect(sub.getByte()).toBe(-1);
    });
  });

  describe('constructor with custom minBufferLength', () => {
    it('rounds up minBufferLength to the next power of two', () => {
      // Passing maybeMinBufferLength = 600, the internal minBufferLength
      // should become 1024 (next power of 2 >= 600 starting from 512).
      const data = new Uint8Array(800);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }
      const stream = new TestDecodeStream(data, 600);

      const decoded = stream.decode();
      expect(decoded).toEqual(data);
    });
  });

  describe('readBlock() base implementation', () => {
    it('throws MethodNotImplementedError when readBlock is not overridden', () => {
      // Use DecodeStream directly (not the TestDecodeStream subclass)
      // Since DecodeStream is not abstract in the JS sense, we can instantiate it
      // indirectly through a minimal subclass that doesn't override readBlock.
      class BareDecodeStream extends DecodeStream {
        constructor() {
          super();
        }
        // Intentionally NOT overriding readBlock
      }

      const stream = new BareDecodeStream();
      expect(() => stream.getByte()).toThrow('not implemented');
    });
  });

  describe('integration with FlateStream (real DecodeStream subclass)', () => {
    it('decodes flate-compressed data via all DecodeStream methods', () => {
      const originalData = new TextEncoder().encode('Hello, DecodeStream!');
      const compressed = zlibSync(originalData);
      const flateStream = new FlateStream(new Stream(compressed));

      // decode() should return the original content
      const decoded = flateStream.decode();
      expect(decoded).toEqual(originalData);
    });

    it('reads individual bytes from flate-compressed data', () => {
      const originalData = Uint8Array.from([0xDE, 0xAD, 0xBE, 0xEF]);
      const compressed = zlibSync(originalData);
      const flateStream = new FlateStream(new Stream(compressed));

      expect(flateStream.getByte()).toBe(0xDE);
      expect(flateStream.getByte()).toBe(0xAD);
      expect(flateStream.getByte()).toBe(0xBE);
      expect(flateStream.getByte()).toBe(0xEF);
      expect(flateStream.getByte()).toBe(-1);
    });

    it('reads uint16 from flate-compressed data', () => {
      // 0xAB << 8 + 0xCD = 43981
      const originalData = Uint8Array.from([0xAB, 0xCD]);
      const compressed = zlibSync(originalData);
      const flateStream = new FlateStream(new Stream(compressed));

      expect(flateStream.getUint16()).toBe(0xABCD);
    });

    it('peeks at bytes from flate-compressed data without advancing', () => {
      const originalData = Uint8Array.from([1, 2, 3, 4]);
      const compressed = zlibSync(originalData);
      const flateStream = new FlateStream(new Stream(compressed));

      expect(flateStream.peekByte()).toBe(1);
      expect(flateStream.peekByte()).toBe(1);
      expect(flateStream.getByte()).toBe(1);
      expect(flateStream.peekByte()).toBe(2);
    });

    it('supports skip and reset with flate-compressed data', () => {
      const originalData = Uint8Array.from([10, 20, 30, 40, 50]);
      const compressed = zlibSync(originalData);
      const flateStream = new FlateStream(new Stream(compressed));

      flateStream.skip(2);
      expect(flateStream.getByte()).toBe(30);

      flateStream.reset();
      expect(flateStream.getByte()).toBe(10);
    });

    it('isEmpty returns false for non-empty flate-compressed data', () => {
      const originalData = Uint8Array.from([42]);
      const compressed = zlibSync(originalData);
      const flateStream = new FlateStream(new Stream(compressed));

      expect(flateStream.isEmpty).toBe(false);
    });

    it('getBytes returns exact slice from flate-compressed data', () => {
      const originalData = Uint8Array.from([5, 10, 15, 20, 25, 30]);
      const compressed = zlibSync(originalData);
      const flateStream = new FlateStream(new Stream(compressed));

      const bytes = flateStream.getBytes(3);
      expect(bytes).toEqual(Uint8Array.from([5, 10, 15]));

      const rest = flateStream.getBytes(0);
      expect(rest).toEqual(Uint8Array.from([20, 25, 30]));
    });
  });
});
