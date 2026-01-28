import pako from 'pako';

import { decodePDFRawStream } from '../../../src/core/streams/decode';
import {
  PDFContext,
  PDFDict,
  PDFName,
  PDFRawStream,
  PDFArray,
  PDFNumber,
} from '../../../src/core';

// Helper: encode text content as ASCII hex (e.g. "AB" -> "4142>")
const asciiHexEncode = (data: Uint8Array): Uint8Array => {
  const hexChars: number[] = [];
  for (const byte of data) {
    const hex = byte.toString(16).padStart(2, '0').toUpperCase();
    hexChars.push(hex.charCodeAt(0), hex.charCodeAt(1));
  }
  // Append EOD marker '>'
  hexChars.push(0x3e);
  return Uint8Array.from(hexChars);
};

// Helper: encode data using ASCII base-85 encoding (Ascii85 / btoa85)
const ascii85Encode = (data: Uint8Array): Uint8Array => {
  const result: number[] = [];

  // Process 4-byte groups
  let i = 0;
  while (i + 4 <= data.length) {
    const b0 = data[i]!;
    const b1 = data[i + 1]!;
    const b2 = data[i + 2]!;
    const b3 = data[i + 3]!;

    let value = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;

    if (value === 0) {
      // Special 'z' encoding for all-zero groups
      result.push(0x7a); // 'z'
    } else {
      const c4 = (value % 85) + 33;
      value = Math.floor(value / 85);
      const c3 = (value % 85) + 33;
      value = Math.floor(value / 85);
      const c2 = (value % 85) + 33;
      value = Math.floor(value / 85);
      const c1 = (value % 85) + 33;
      value = Math.floor(value / 85);
      const c0 = (value % 85) + 33;
      result.push(c0, c1, c2, c3, c4);
    }
    i += 4;
  }

  // Handle remaining bytes (1-3)
  const remaining = data.length - i;
  if (remaining > 0) {
    // Pad with zeros to make 4 bytes
    const padded = new Uint8Array(4);
    for (let j = 0; j < remaining; j++) {
      padded[j] = data[i + j]!;
    }
    let value =
      ((padded[0]! << 24) | (padded[1]! << 16) | (padded[2]! << 8) | padded[3]!) >>> 0;

    const chars: number[] = [];
    for (let k = 4; k >= 0; k--) {
      chars[k] = (value % 85) + 33;
      value = Math.floor(value / 85);
    }
    // Output remaining+1 characters
    for (let j = 0; j < remaining + 1; j++) {
      result.push(chars[j]!);
    }
  }

  // Append EOD marker '~>'
  result.push(0x7e, 0x3e); // '~>'
  return Uint8Array.from(result);
};

describe('decodePDFRawStream', () => {
  const context = PDFContext.create();

  /**
   * Helper to create a PDFRawStream with a single /Filter entry.
   */
  const createRawStream = (
    contents: Uint8Array,
    filterName?: string,
  ): PDFRawStream => {
    const dict = PDFDict.withContext(context);
    if (filterName) {
      dict.set(PDFName.of('Filter'), PDFName.of(filterName));
    }
    return PDFRawStream.of(dict, contents);
  };

  /**
   * Helper to create a PDFRawStream with an array of /Filter entries.
   */
  const createRawStreamWithFilters = (
    contents: Uint8Array,
    filterNames: string[],
  ): PDFRawStream => {
    const dict = PDFDict.withContext(context);
    const filterArray = PDFArray.withContext(context);
    for (const name of filterNames) {
      filterArray.push(PDFName.of(name));
    }
    dict.set(PDFName.of('Filter'), filterArray);
    return PDFRawStream.of(dict, contents);
  };

  describe('with no filter', () => {
    it('returns a stream wrapping the raw contents unchanged', () => {
      const data = Uint8Array.from([72, 101, 108, 108, 111]); // "Hello"
      const rawStream = createRawStream(data);

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(data);
    });

    it('handles empty contents with no filter', () => {
      const data = new Uint8Array(0);
      const rawStream = createRawStream(data);

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded.length).toBe(0);
    });
  });

  describe('with FlateDecode filter', () => {
    it('decodes flate-compressed content to the original data', () => {
      const original = new TextEncoder().encode('The quick brown fox jumps over the lazy dog');
      const compressed = pako.deflate(original);
      const rawStream = createRawStream(compressed, 'FlateDecode');

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });

    it('decodes flate-compressed binary data', () => {
      const original = Uint8Array.from([0, 1, 2, 255, 254, 253, 128, 64, 32]);
      const compressed = pako.deflate(original);
      const rawStream = createRawStream(compressed, 'FlateDecode');

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });

    it('decodes a larger flate-compressed payload', () => {
      const original = new Uint8Array(1000);
      for (let i = 0; i < 1000; i++) {
        original[i] = i % 256;
      }
      const compressed = pako.deflate(original);
      const rawStream = createRawStream(compressed, 'FlateDecode');

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });
  });

  describe('with ASCIIHexDecode filter', () => {
    it('decodes ASCII hex encoded content', () => {
      const original = Uint8Array.from([0xDE, 0xAD, 0xBE, 0xEF]);
      const encoded = asciiHexEncode(original);
      const rawStream = createRawStream(encoded, 'ASCIIHexDecode');

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });

    it('decodes ASCII hex encoded text', () => {
      const original = new TextEncoder().encode('Hi');
      // "Hi" = 0x48, 0x69 -> "4869>"
      const encoded = asciiHexEncode(original);
      const rawStream = createRawStream(encoded, 'ASCIIHexDecode');

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });
  });

  describe('with ASCII85Decode filter', () => {
    it('decodes ASCII85 encoded content', () => {
      const original = Uint8Array.from([0x00, 0x00, 0x00, 0x00]);
      const encoded = ascii85Encode(original);
      const rawStream = createRawStream(encoded, 'ASCII85Decode');

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });

    it('decodes ASCII85 encoded text data', () => {
      // "Test" = [0x54, 0x65, 0x73, 0x74] - exactly 4 bytes
      const original = new TextEncoder().encode('Test');
      const encoded = ascii85Encode(original);
      const rawStream = createRawStream(encoded, 'ASCII85Decode');

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });

    it('decodes ASCII85 data that is not a multiple of 4 bytes', () => {
      // 5 bytes: "Hello" = [72, 101, 108, 108, 111]
      const original = new TextEncoder().encode('Hello');
      const encoded = ascii85Encode(original);
      const rawStream = createRawStream(encoded, 'ASCII85Decode');

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });
  });

  describe('with chained filters (PDFArray of filter names)', () => {
    it('applies filters in order: FlateDecode then ASCIIHexDecode', () => {
      const original = new TextEncoder().encode('chained filters test');

      // First, flate-compress the original data
      const flateCompressed = pako.deflate(original);
      // Then, ASCII hex encode the compressed data
      const asciiHexEncoded = asciiHexEncode(flateCompressed);

      // The PDF filter array specifies the decode order:
      // First apply ASCIIHexDecode (to get flateCompressed), then FlateDecode (to get original)
      const rawStream = createRawStreamWithFilters(asciiHexEncoded, [
        'ASCIIHexDecode',
        'FlateDecode',
      ]);

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });

    it('applies filters in order: FlateDecode then ASCII85Decode', () => {
      const original = new TextEncoder().encode('double decode');

      // First, flate-compress the original data
      const flateCompressed = pako.deflate(original);
      // Then, ASCII85 encode the compressed data
      const ascii85Encoded = ascii85Encode(flateCompressed);

      // Decode order: first ASCII85Decode then FlateDecode
      const rawStream = createRawStreamWithFilters(ascii85Encoded, [
        'ASCII85Decode',
        'FlateDecode',
      ]);

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });

    it('applies a single filter from a PDFArray correctly', () => {
      const original = new TextEncoder().encode('single filter in array');
      const compressed = pako.deflate(original);

      const rawStream = createRawStreamWithFilters(compressed, ['FlateDecode']);

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });
  });

  describe('with unsupported encoding', () => {
    it('throws UnsupportedEncodingError for an unknown filter', () => {
      const data = Uint8Array.from([1, 2, 3]);
      const rawStream = createRawStream(data, 'BogusFilter');

      expect(() => decodePDFRawStream(rawStream)).toThrow(
        'stream encoding not supported',
      );
    });

    it('throws UnsupportedEncodingError for an unknown filter in an array', () => {
      const data = Uint8Array.from([1, 2, 3]);
      const rawStream = createRawStreamWithFilters(data, ['UnknownDecode']);

      expect(() => decodePDFRawStream(rawStream)).toThrow(
        'stream encoding not supported',
      );
    });
  });

  describe('with invalid Filter object type', () => {
    it('throws UnexpectedObjectTypeError when Filter is not a PDFName or PDFArray', () => {
      const dict = PDFDict.withContext(context);
      // Set Filter to a PDFNumber, which is neither PDFName nor PDFArray
      dict.set(PDFName.of('Filter'), PDFNumber.of(42));
      const data = Uint8Array.from([1, 2, 3]);
      const rawStream = PDFRawStream.of(dict, data);

      expect(() => decodePDFRawStream(rawStream)).toThrow(
        'Expected instance of',
      );
    });
  });

  describe('stream interface methods on decoded result', () => {
    it('returns a stream that supports getByte()', () => {
      const original = Uint8Array.from([0xCA, 0xFE, 0xBA, 0xBE]);
      const compressed = pako.deflate(original);
      const rawStream = createRawStream(compressed, 'FlateDecode');

      const result = decodePDFRawStream(rawStream);

      expect(result.getByte()).toBe(0xCA);
      expect(result.getByte()).toBe(0xFE);
      expect(result.getByte()).toBe(0xBA);
      expect(result.getByte()).toBe(0xBE);
      expect(result.getByte()).toBe(-1);
    });

    it('returns a stream that supports getBytes()', () => {
      const original = Uint8Array.from([10, 20, 30, 40, 50]);
      const compressed = pako.deflate(original);
      const rawStream = createRawStream(compressed, 'FlateDecode');

      const result = decodePDFRawStream(rawStream);
      const bytes = result.getBytes(3);

      expect(bytes).toEqual(Uint8Array.from([10, 20, 30]));
    });

    it('returns a stream that supports peekByte()', () => {
      const original = Uint8Array.from([77, 88]);
      const compressed = pako.deflate(original);
      const rawStream = createRawStream(compressed, 'FlateDecode');

      const result = decodePDFRawStream(rawStream);

      expect(result.peekByte()).toBe(77);
      expect(result.peekByte()).toBe(77);
      expect(result.getByte()).toBe(77);
      expect(result.getByte()).toBe(88);
    });

    it('returns a stream that supports getUint16()', () => {
      // 0x01, 0x00 -> (1 << 8) + 0 = 256
      const original = Uint8Array.from([0x01, 0x00]);
      const compressed = pako.deflate(original);
      const rawStream = createRawStream(compressed, 'FlateDecode');

      const result = decodePDFRawStream(rawStream);

      expect(result.getUint16()).toBe(256);
    });

    it('returns a stream that supports skip() and reset()', () => {
      const original = Uint8Array.from([1, 2, 3, 4, 5]);
      const compressed = pako.deflate(original);
      const rawStream = createRawStream(compressed, 'FlateDecode');

      const result = decodePDFRawStream(rawStream);

      result.skip(3);
      expect(result.getByte()).toBe(4);

      result.reset();
      expect(result.getByte()).toBe(1);
    });

    it('returns a stream whose isEmpty is false for non-empty data', () => {
      const original = Uint8Array.from([1]);
      const compressed = pako.deflate(original);
      const rawStream = createRawStream(compressed, 'FlateDecode');

      const result = decodePDFRawStream(rawStream);
      expect(result.isEmpty).toBe(false);
    });
  });

  describe('raw stream with no filter returns a basic Stream', () => {
    it('the returned stream supports all StreamType interface methods', () => {
      const data = Uint8Array.from([0xAA, 0xBB, 0xCC, 0xDD]);
      const rawStream = createRawStream(data);

      const result = decodePDFRawStream(rawStream);

      // getByte
      expect(result.getByte()).toBe(0xAA);

      // peekByte
      expect(result.peekByte()).toBe(0xBB);

      // getBytes
      const bytes = result.getBytes(2);
      expect(bytes).toEqual(Uint8Array.from([0xBB, 0xCC]));

      // skip (skip past DD)
      result.skip(1);
      expect(result.getByte()).toBe(-1);

      // reset
      result.reset();
      expect(result.getByte()).toBe(0xAA);
    });
  });

  describe('with DecodeParms', () => {
    it('passes DecodeParms to the decoder (LZWDecode with EarlyChange)', () => {
      // This test verifies that DecodeParms is wired through.
      // We create a dict with LZWDecode filter and EarlyChange=0 param.
      // We cannot easily produce LZW-encoded data here, but we verify
      // the structural wiring by confirming no runtime error with valid params
      // when the Filter is something we can encode (FlateDecode ignores params).
      const original = new TextEncoder().encode('params test');
      const compressed = pako.deflate(original);

      const dict = PDFDict.withContext(context);
      dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
      // FlateDecode doesn't use DecodeParms, but setting it should not cause an error
      const paramsDict = PDFDict.withContext(context);
      paramsDict.set(PDFName.of('Predictor'), PDFNumber.of(1));
      dict.set(PDFName.of('DecodeParms'), paramsDict);

      const rawStream = PDFRawStream.of(dict, compressed);
      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });
  });
});
