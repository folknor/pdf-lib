import { zlibSync } from "fflate";

import { decodePDFRawStream } from "../../../src/core/streams/decode";
import {
  PDFContext,
  PDFDict,
  PDFName,
  PDFRawStream,
  PDFArray,
  PDFNumber,
  DecodedStreamTooLargeError,
  InvalidDecodeParmsError,
} from "../../../src/core";

// Helper: encode text content as ASCII hex (e.g. "AB" -> "4142>")
const asciiHexEncode = (data: Uint8Array): Uint8Array => {
  const hexChars: number[] = [];

  for (const byte of data) {
    const hex = byte.toString(16).padStart(2, "0").toUpperCase();
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

    let value = ((padded[0]! << 24) | (padded[1]! << 16) | (padded[2]! << 8) | padded[3]!) >>> 0;

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

describe("decodePDFRawStream", () => {
  const context = PDFContext.create();

  /**
   * Helper to create a PDFRawStream with a single /Filter entry.
   */
  const createRawStream = (contents: Uint8Array, filterName?: string): PDFRawStream => {
    const dict = PDFDict.withContext(context);

    if (filterName) {
      dict.set(PDFName.of("Filter"), PDFName.of(filterName));
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

    dict.set(PDFName.of("Filter"), filterArray);

    return PDFRawStream.of(dict, contents);
  };

  describe("with a per-document maxDecodedStreamSize", () => {
    it("applies the context limit to the decoding chain", () => {
      const ctx = PDFContext.create();
      ctx.maxDecodedStreamSize = 64 * 1024;
      const dict = PDFDict.withContext(ctx);
      dict.set(PDFName.of("Filter"), PDFName.of("FlateDecode"));
      const bomb = PDFRawStream.of(dict, zlibSync(new Uint8Array(4 << 20)));
      expect(() => decodePDFRawStream(bomb).decode()).toThrow(DecodedStreamTooLargeError);
    });

    it("leaves other documents on the global default", () => {
      const rawStream = createRawStream(zlibSync(new Uint8Array(128 * 1024)), "FlateDecode");

      expect(decodePDFRawStream(rawStream).decode().length).toBe(128 * 1024);
    });
  });

  describe("with no filter", () => {
    it("returns a stream wrapping the raw contents unchanged", () => {
      const data = Uint8Array.from([72, 101, 108, 108, 111]); // "Hello"
      const rawStream = createRawStream(data);

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(data);
    });

    it("handles empty contents with no filter", () => {
      const data = new Uint8Array(0);
      const rawStream = createRawStream(data);

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded.length).toBe(0);
    });
  });

  describe("with FlateDecode filter", () => {
    it("decodes flate-compressed content to the original data", () => {
      const original = new TextEncoder().encode("The quick brown fox jumps over the lazy dog");
      const compressed = zlibSync(original);
      const rawStream = createRawStream(compressed, "FlateDecode");

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });

    it("decodes flate-compressed binary data", () => {
      const original = Uint8Array.from([0, 1, 2, 255, 254, 253, 128, 64, 32]);
      const compressed = zlibSync(original);
      const rawStream = createRawStream(compressed, "FlateDecode");

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });

    it("decodes a larger flate-compressed payload", () => {
      const original = new Uint8Array(1000);

      for (let i = 0; i < 1000; i++) {
        original[i] = i % 256;
      }

      const compressed = zlibSync(original);
      const rawStream = createRawStream(compressed, "FlateDecode");

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });
  });

  describe("with ASCIIHexDecode filter", () => {
    it("decodes ASCII hex encoded content", () => {
      const original = Uint8Array.from([0xde, 0xad, 0xbe, 0xef]);
      const encoded = asciiHexEncode(original);
      const rawStream = createRawStream(encoded, "ASCIIHexDecode");

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });

    it("decodes ASCII hex encoded text", () => {
      const original = new TextEncoder().encode("Hi");
      // "Hi" = 0x48, 0x69 -> "4869>"
      const encoded = asciiHexEncode(original);
      const rawStream = createRawStream(encoded, "ASCIIHexDecode");

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });
  });

  describe("with ASCII85Decode filter", () => {
    it("decodes ASCII85 encoded content", () => {
      const original = Uint8Array.from([0x00, 0x00, 0x00, 0x00]);
      const encoded = ascii85Encode(original);
      const rawStream = createRawStream(encoded, "ASCII85Decode");

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });

    it("decodes ASCII85 encoded text data", () => {
      // "Test" = [0x54, 0x65, 0x73, 0x74] - exactly 4 bytes
      const original = new TextEncoder().encode("Test");
      const encoded = ascii85Encode(original);
      const rawStream = createRawStream(encoded, "ASCII85Decode");

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });

    it("decodes ASCII85 data that is not a multiple of 4 bytes", () => {
      // 5 bytes: "Hello" = [72, 101, 108, 108, 111]
      const original = new TextEncoder().encode("Hello");
      const encoded = ascii85Encode(original);
      const rawStream = createRawStream(encoded, "ASCII85Decode");

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });
  });

  describe("with chained filters (PDFArray of filter names)", () => {
    it("applies filters in order: FlateDecode then ASCIIHexDecode", () => {
      const original = new TextEncoder().encode("chained filters test");

      // First, flate-compress the original data
      const flateCompressed = zlibSync(original);
      // Then, ASCII hex encode the compressed data
      const asciiHexEncoded = asciiHexEncode(flateCompressed);

      // The PDF filter array specifies the decode order:
      // First apply ASCIIHexDecode (to get flateCompressed), then FlateDecode (to get original)
      const rawStream = createRawStreamWithFilters(asciiHexEncoded, [
        "ASCIIHexDecode",
        "FlateDecode",
      ]);

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });

    it("applies filters in order: FlateDecode then ASCII85Decode", () => {
      const original = new TextEncoder().encode("double decode");

      // First, flate-compress the original data
      const flateCompressed = zlibSync(original);
      // Then, ASCII85 encode the compressed data
      const ascii85Encoded = ascii85Encode(flateCompressed);

      // Decode order: first ASCII85Decode then FlateDecode
      const rawStream = createRawStreamWithFilters(ascii85Encoded, [
        "ASCII85Decode",
        "FlateDecode",
      ]);

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });

    it("applies a single filter from a PDFArray correctly", () => {
      const original = new TextEncoder().encode("single filter in array");
      const compressed = zlibSync(original);

      const rawStream = createRawStreamWithFilters(compressed, ["FlateDecode"]);

      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });
  });

  describe("with unsupported encoding", () => {
    it("throws UnsupportedEncodingError for an unknown filter", () => {
      const data = Uint8Array.from([1, 2, 3]);
      const rawStream = createRawStream(data, "BogusFilter");

      expect(() => decodePDFRawStream(rawStream)).toThrow("stream encoding not supported");
    });

    it("throws UnsupportedEncodingError for an unknown filter in an array", () => {
      const data = Uint8Array.from([1, 2, 3]);
      const rawStream = createRawStreamWithFilters(data, ["UnknownDecode"]);

      expect(() => decodePDFRawStream(rawStream)).toThrow("stream encoding not supported");
    });
  });

  describe("with invalid Filter object type", () => {
    it("throws UnexpectedObjectTypeError when Filter is not a PDFName or PDFArray", () => {
      const dict = PDFDict.withContext(context);
      // Set Filter to a PDFNumber, which is neither PDFName nor PDFArray
      dict.set(PDFName.of("Filter"), PDFNumber.of(42));
      const data = Uint8Array.from([1, 2, 3]);
      const rawStream = PDFRawStream.of(dict, data);

      expect(() => decodePDFRawStream(rawStream)).toThrow("Expected instance of");
    });
  });

  describe("stream interface methods on decoded result", () => {
    it("returns a stream that supports getByte()", () => {
      const original = Uint8Array.from([0xca, 0xfe, 0xba, 0xbe]);
      const compressed = zlibSync(original);
      const rawStream = createRawStream(compressed, "FlateDecode");

      const result = decodePDFRawStream(rawStream);

      expect(result.getByte()).toBe(0xca);
      expect(result.getByte()).toBe(0xfe);
      expect(result.getByte()).toBe(0xba);
      expect(result.getByte()).toBe(0xbe);
      expect(result.getByte()).toBe(-1);
    });

    it("returns a stream that supports getBytes()", () => {
      const original = Uint8Array.from([10, 20, 30, 40, 50]);
      const compressed = zlibSync(original);
      const rawStream = createRawStream(compressed, "FlateDecode");

      const result = decodePDFRawStream(rawStream);
      const bytes = result.getBytes(3);

      expect(bytes).toEqual(Uint8Array.from([10, 20, 30]));
    });

    it("returns a stream that supports peekByte()", () => {
      const original = Uint8Array.from([77, 88]);
      const compressed = zlibSync(original);
      const rawStream = createRawStream(compressed, "FlateDecode");

      const result = decodePDFRawStream(rawStream);

      expect(result.peekByte()).toBe(77);
      expect(result.peekByte()).toBe(77);
      expect(result.getByte()).toBe(77);
      expect(result.getByte()).toBe(88);
    });

    it("returns a stream that supports getUint16()", () => {
      // 0x01, 0x00 -> (1 << 8) + 0 = 256
      const original = Uint8Array.from([0x01, 0x00]);
      const compressed = zlibSync(original);
      const rawStream = createRawStream(compressed, "FlateDecode");

      const result = decodePDFRawStream(rawStream);

      expect(result.getUint16()).toBe(256);
    });

    it("returns a stream that supports skip() and reset()", () => {
      const original = Uint8Array.from([1, 2, 3, 4, 5]);
      const compressed = zlibSync(original);
      const rawStream = createRawStream(compressed, "FlateDecode");

      const result = decodePDFRawStream(rawStream);

      result.skip(3);
      expect(result.getByte()).toBe(4);

      result.reset();
      expect(result.getByte()).toBe(1);
    });

    it("returns a stream whose isEmpty is false for non-empty data", () => {
      const original = Uint8Array.from([1]);
      const compressed = zlibSync(original);
      const rawStream = createRawStream(compressed, "FlateDecode");

      const result = decodePDFRawStream(rawStream);
      expect(result.isEmpty).toBe(false);
    });
  });

  describe("raw stream with no filter returns a basic Stream", () => {
    it("the returned stream supports all StreamType interface methods", () => {
      const data = Uint8Array.from([0xaa, 0xbb, 0xcc, 0xdd]);
      const rawStream = createRawStream(data);

      const result = decodePDFRawStream(rawStream);

      // getByte
      expect(result.getByte()).toBe(0xaa);

      // peekByte
      expect(result.peekByte()).toBe(0xbb);

      // getBytes
      const bytes = result.getBytes(2);
      expect(bytes).toEqual(Uint8Array.from([0xbb, 0xcc]));

      // skip (skip past DD)
      result.skip(1);
      expect(result.getByte()).toBe(-1);

      // reset
      result.reset();
      expect(result.getByte()).toBe(0xaa);
    });
  });

  describe("with predictors", () => {
    const predicted = (
      rows: number[],
      parms: Record<string, unknown> | unknown[],
      filter: string | string[] = "FlateDecode",
      ctx = context,
    ) =>
      PDFRawStream.of(
        ctx.obj({ Filter: filter, DecodeParms: parms } as never) as PDFDict,
        zlibSync(Uint8Array.from(rows)),
      );

    const decode = (stream: PDFRawStream, strict = false) =>
      Array.from(decodePDFRawStream(stream, { strict }).decode());

    it("reverses PNG Paeth and Average rows against the row above", () => {
      const parms = { Predictor: 12, Columns: 2 };
      expect(decode(predicted([0, 10, 20, 4, 1, 1], parms))).toEqual([10, 20, 11, 21]);
      expect(decode(predicted([0, 10, 20, 3, 5, 5], parms))).toEqual([10, 20, 10, 20]);
    });

    it("takes the PNG left neighbour a whole pixel back", () => {
      const parms = { Predictor: 15, Colors: 2, Columns: 2 };
      expect(decode(predicted([1, 1, 2, 3, 4], parms))).toEqual([1, 2, 4, 6]);
    });

    it("reverses TIFF 8-bit samples per component, row by row", () => {
      const parms = { Predictor: 2, Colors: 2, Columns: 3 };
      const row = [1, 2, 1, 1, 1, 1];
      expect(decode(predicted([...row, ...row], parms))).toEqual([
        1, 2, 2, 3, 3, 4, 1, 2, 2, 3, 3, 4,
      ]);
    });

    it("reverses packed TIFF samples and passes padding bits through", () => {
      const parms = { Predictor: 2, BitsPerComponent: 4, Columns: 3 };
      expect(decode(predicted([0x11, 0x1f], parms))).toEqual([0x12, 0x3f]);
    });

    it("reverses 16-bit TIFF samples, dropping a partial one unless strict", () => {
      const parms = { Predictor: 2, BitsPerComponent: 16, Columns: 2 };
      const data = [0x00, 0xff, 0x00, 0x01, 0x00, 0x01, 0x00];
      expect(decode(predicted(data, parms))).toEqual([0x00, 0xff, 0x01, 0x00, 0x00, 0x01]);
      expect(() => decode(predicted(data, parms), true)).toThrow(InvalidDecodeParmsError);
    });

    it("keeps a partial PNG row unless strict", () => {
      const parms = { Predictor: 10, Columns: 3 };
      const data = [0, 1, 2, 3, 0, 4];
      expect(decode(predicted(data, parms))).toEqual([1, 2, 3, 4]);
      expect(() => decode(predicted(data, parms), true)).toThrow(InvalidDecodeParmsError);
      expect(decode(predicted([], parms), true)).toEqual([]);
    });

    it("applies each predictor at its own stage of a filter chain", () => {
      const hex = [..."4142>"].map((c) => c.charCodeAt(0));

      const stream = predicted(
        [0, ...hex],
        [{ Predictor: 12, Columns: 5 }, null],
        ["FlateDecode", "ASCIIHexDecode"],
      );

      expect(decode(stream)).toEqual([0x41, 0x42]);
    });

    it("accepts a dictionary or a one-element array for a single filter", () => {
      const rows = [2, 1, 2];
      const parms = { Predictor: 12, Columns: 2 };
      expect(decode(predicted(rows, [parms]))).toEqual([1, 2]);
      expect(decode(predicted(rows, parms, ["FlateDecode"]))).toEqual([1, 2]);
    });

    it("refuses /DecodeParms it would have to guess at", () => {
      const parms = { Predictor: 12, Columns: 2 };
      const two = ["FlateDecode", "ASCIIHexDecode"];

      for (const stream of [
        predicted([0, 1, 2], parms, two),
        predicted([0, 1, 2], [parms], two),
        predicted([0, 1, 2], { Predictor: 5 }),
        predicted([0, 1, 2], { Predictor: 2, BitsPerComponent: 3 }),
        predicted([0, 1, 2], { Predictor: 12, Columns: 0 }),
        predicted([7, 1, 2], parms),
      ]) {
        expect(() => decode(stream)).toThrow(InvalidDecodeParmsError);
      }
    });

    it("holds the predictor and its row size to the document limit", () => {
      const ctx = PDFContext.create();
      ctx.maxDecodedStreamSize = 64 * 1024;
      const wide = predicted([0], { Predictor: 12, Columns: 1 << 20 }, "FlateDecode", ctx);
      expect(() => decode(wide)).toThrow(InvalidDecodeParmsError);

      const bomb = predicted(
        Array.from(new Uint8Array(1 << 20)),
        { Predictor: 12, Columns: 1 },
        "FlateDecode",
        ctx,
      );

      expect(() => decode(bomb)).toThrow(DecodedStreamTooLargeError);
    });
  });

  describe("with DecodeParms", () => {
    it("treats /Predictor 1 as no predictor", () => {
      const original = new TextEncoder().encode("params test");
      const compressed = zlibSync(original);

      const dict = PDFDict.withContext(context);
      dict.set(PDFName.of("Filter"), PDFName.of("FlateDecode"));
      const paramsDict = PDFDict.withContext(context);
      paramsDict.set(PDFName.of("Predictor"), PDFNumber.of(1));
      dict.set(PDFName.of("DecodeParms"), paramsDict);

      const rawStream = PDFRawStream.of(dict, compressed);
      const result = decodePDFRawStream(rawStream);
      const decoded = result.decode();

      expect(decoded).toEqual(original);
    });
  });
});
