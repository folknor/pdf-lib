import fs from 'fs';

import { DecodeStream, DecodedStreamTooLargeError, PDFDocument } from 'src/index.js';
import fontkit from 'src/fontkit.js';

const read = (path: string) => new Uint8Array(fs.readFileSync(path));
const woff = read('./assets/fonts/fantasque/Webfonts/FantasqueSansMono-Regular.woff');

const woff2 = read(
  './assets/fonts/fantasque/Webfonts/FantasqueSansMono-Regular.woff2',
);

const u16 = (v: number) => [(v >>> 8) & 0xff, v & 0xff];

const u32 = (v: number) => [
  (v >>> 24) & 0xff,
  (v >>> 16) & 0xff,
  (v >>> 8) & 0xff,
  v & 0xff,
];

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

// A WOFF whose two tables each declare a uint32 length of 2^32-1. The old
// `(length + 3) & ~3` summed these to a negative size.
const hugeWoff = (): Uint8Array => {
  const entry = (tag: string) => [
    ...ascii(tag),
    ...u32(44 + 40),
    ...u32(4),
    ...u32(0xffffffff),
    ...u32(0),
  ];

  return new Uint8Array([
    ...ascii('wOFF'),
    ...u32(0x00010000),
    ...u32(88),
    ...u16(2),
    ...u16(0),
    ...u32(0),
    ...u16(1),
    ...u16(0),
    ...u32(0),
    ...u32(0),
    ...u32(0),
    ...u32(0),
    ...u32(0),
    ...entry('head'),
    ...entry('maxp'),
    0,
    0,
    0,
    0,
  ]);
};

// A WOFF2 with one table (known tag index 0, cmap) whose UIntBase128 length
// is 2^32-1, which the old signed decoder read as -1.
const hugeWoff2 = (): Uint8Array =>
  new Uint8Array([
    ...ascii('wOF2'),
    ...u32(0x00010000),
    ...u32(54),
    ...u16(1),
    ...u16(0),
    ...u32(0),
    ...u32(0),
    ...u16(1),
    ...u16(0),
    ...u32(0),
    ...u32(0),
    ...u32(0),
    ...u32(0),
    ...u32(0),
    0x00,
    0x8f,
    0xff,
    0xff,
    0xff,
    0x7f,
  ]);

describe('WOFF/WOFF2 decode cap', () => {
  it('rejects a WOFF whose declared table space exceeds the cap', () => {
    expect(() => fontkit.create(woff, undefined, { maxDecodedSize: 16 })).toThrow(
      DecodedStreamTooLargeError,
    );
    expect(fontkit.create(woff, undefined, { maxDecodedSize: Infinity }).postscriptName).toBe(
      'FantasqueSansMono-Regular',
    );
  });

  it('rejects a WOFF2 whose declared table space exceeds the cap', () => {
    expect(() =>
      fontkit.create(woff2, undefined, { maxDecodedSize: 16 }),
    ).toThrow(DecodedStreamTooLargeError);
    expect(fontkit.create(woff2).postscriptName).toBe(
      'FantasqueSansMono-Regular',
    );
  });

  it('sums uint32 WOFF lengths without wrapping', () => {
    expect(() => fontkit.create(hugeWoff())).toThrow(
      `Decoded stream size (${2 * 2 ** 32} bytes)`,
    );
  });

  it('decodes WOFF2 UIntBase128 lengths as unsigned', () => {
    expect(() => fontkit.create(hugeWoff2())).toThrow(
      `Decoded stream size (${2 ** 32 - 1} bytes)`,
    );
  });

  it('defaults to DecodeStream.maxDecodedSize', () => {
    const saved = DecodeStream.maxDecodedSize;

    try {
      DecodeStream.maxDecodedSize = 16;
      expect(() => fontkit.create(woff)).toThrow(DecodedStreamTooLargeError);
    } finally {
      DecodeStream.maxDecodedSize = saved;
    }
  });

  it("applies the document's maxDecodedStreamSize in embedFont", async () => {
    const bytes = await (await PDFDocument.create()).save({
      useObjectStreams: false,
    });

    const capped = await PDFDocument.load(bytes, { maxDecodedStreamSize: 16 });
    capped.registerFontkit(fontkit);

    for (const font of [woff, woff2]) {
      await expect(capped.embedFont(font)).rejects.toThrow(
        'exceeds the maximum of 16 bytes',
      );
      await expect(capped.embedFont(font, { subset: true })).rejects.toThrow(
        'exceeds the maximum of 16 bytes',
      );
    }

    const uncapped = await PDFDocument.load(bytes);
    uncapped.registerFontkit(fontkit);
    await expect(uncapped.embedFont(woff)).resolves.toBeDefined();
  });
});
