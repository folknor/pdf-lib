import fontkit from 'src/fontkit.js';
import fs from 'fs';

import { deriveFontFlags } from '../../../src/core/embedders/FontFlags';
import CFFFont from '../../../src/fontkit/cff/CFFFont';
import { DecodeStream } from '../../../src/vendors/restructure/index';
import {
  CustomFontEmbedder,
  CustomFontSubsetEmbedder,
  decodePDFRawStream,
  PDFArray,
  PDFContext,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
} from '../../../src/index';
import { compressWidths } from '../../../src/core/embedders/CustomFontEmbedder';

const ubuntuFont = fs.readFileSync('./assets/fonts/ubuntu/Ubuntu-R.ttf');

describe('CustomFontEmbedder', () => {
  it('can be constructed with CustomFontEmbedder.for(...)', async () => {
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    expect(embedder).toBeInstanceOf(CustomFontEmbedder);
  });

  it("exposes the font's name", async () => {
    const embedder = await CustomFontEmbedder.for(
      fontkit,
      new Uint8Array(ubuntuFont),
    );
    expect(embedder.fontName).toBe('Ubuntu');
  });

  it('can set a custom font name', async () => {
    const customName = 'abc123';
    const embedder = await CustomFontEmbedder.for(
      fontkit,
      new Uint8Array(ubuntuFont),
      customName,
    );
    expect(embedder.customName).toBe(customName);
  });

  it('can embed font dictionaries into PDFContexts without a predefined ref', async () => {
    const context = PDFContext.create();
    const embedder = await CustomFontEmbedder.for(
      fontkit,
      new Uint8Array(ubuntuFont),
    );

    expect(context.enumerateIndirectObjects().length).toBe(0);
    const ref = await embedder.embedIntoContext(context);
    expect(context.enumerateIndirectObjects().length).toBe(5);
    expect(context.lookup(ref)).toBeInstanceOf(PDFDict);
  });

  it('can embed font dictionaries into PDFContexts with a predefined ref', async () => {
    const context = PDFContext.create();
    const predefinedRef = PDFRef.of(9999);
    const embedder = await CustomFontEmbedder.for(
      fontkit,
      new Uint8Array(ubuntuFont),
    );

    expect(context.enumerateIndirectObjects().length).toBe(0);
    const ref = await embedder.embedIntoContext(context, predefinedRef);
    expect(context.enumerateIndirectObjects().length).toBe(5);
    expect(context.lookup(predefinedRef)).toBeInstanceOf(PDFDict);
    expect(ref).toBe(predefinedRef);
  });

  it('can encode text strings into PDFHexString objects', async () => {
    const text = 'Stuff and thingz!';
    const hexCodes =
      '00360057005801AA000300440051004700030057004B004C0051004A005D0004';
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);

    expect(embedder.encodeText(text)).toBeInstanceOf(PDFHexString);
    expect(String(embedder.encodeText(text))).toBe(
      String(PDFHexString.of(hexCodes)),
    );
  });

  it('can measure the width of text strings at the given font size', async () => {
    const text = 'Stuff and thingz!';
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    expect(embedder.widthOfTextAtSize(text, 12)).toBe(90.624);
    expect(embedder.widthOfTextAtSize(text, 24)).toBe(181.248);
  });

  it('can measure the height of the font at the given size', async () => {
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    expect(embedder.heightOfFontAtSize(12)).toBeCloseTo(13.452);
    expect(embedder.heightOfFontAtSize(24)).toBeCloseTo(26.904);
  });

  it('can measure the size of the font at a given height', async () => {
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    expect(embedder.sizeOfFontAtHeight(12)).toBeCloseTo(10.705);
    expect(embedder.sizeOfFontAtHeight(24)).toBeCloseTo(21.409);
  });

  it('does not create orphan objects when re-embedded', async () => {
    const context = PDFContext.create();
    const predefinedRef = PDFRef.of(9999);
    const embedder = await CustomFontEmbedder.for(
      fontkit,
      new Uint8Array(ubuntuFont),
    );

    // First embedding creates 5 objects
    await embedder.embedIntoContext(context, predefinedRef);
    expect(context.enumerateIndirectObjects().length).toBe(5);

    // Re-embedding should reuse the same refs, not create new objects
    await embedder.embedIntoContext(context, predefinedRef);
    expect(context.enumerateIndirectObjects().length).toBe(5);

    // Third embedding also shouldn't create orphans
    await embedder.embedIntoContext(context, predefinedRef);
    expect(context.enumerateIndirectObjects().length).toBe(5);
  });

  it('writes the width of every glyph, including glyphs without code points', async () => {
    const context = PDFContext.create();
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    const { font } = embedder;

    const ref = await embedder.embedIntoContext(context);
    const widths = widthsOf(context, ref);

    expect(widths.size).toBe(font.numGlyphs);
    for (let id = 0; id < font.numGlyphs; id++) {
      expect(widths.get(id)).toBeCloseTo(
        font.getGlyph(id).advanceWidth * (1000 / font.unitsPerEm),
      );
    }
  });

  it('writes the width of ligature glyphs produced by shaping', async () => {
    const context = PDFContext.create();
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    const { font } = embedder;

    const { glyphs } = font.layout('Stuff');
    const ligature = glyphs.find((glyph) => glyph.codePoints.length > 1);
    expect(ligature).toBeDefined();

    const ref = await embedder.embedIntoContext(context);
    expect(widthsOf(context, ref).get(ligature!.id)).toBeCloseTo(
      ligature!.advanceWidth * (1000 / font.unitsPerEm),
    );
  });

  it('keeps ToUnicode mappings and omits glyphs without code points', async () => {
    const context = PDFContext.create();
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);

    const ref = await embedder.embedIntoContext(context);
    const cmap = toUnicodeOf(context, ref);

    expect(cmap).not.toMatch(/<[0-9a-f]{4}> <>/i);
    // 'A' (glyph 0x24 in Ubuntu) must survive /W touching every glyph first.
    expect(cmap).toContain('<0024> <0041>');
  });

  it('skips code points whose glyph lookup returns null', async () => {
    const context = PDFContext.create();
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    const font = embedder.font as any;
    const original = font.glyphForCodePoint.bind(font);
    font.glyphForCodePoint = (codePoint: number) =>
      codePoint === 0x41 ? null : original(codePoint);

    const ref = await embedder.embedIntoContext(context);
    const cmap = toUnicodeOf(context, ref);
    expect(cmap).not.toContain('<0024> <0041>');
    expect(cmap).toContain('<0025> <0042>');
  });

  it('passes the PostScript name through to fontkit.create', async () => {
    const calls: unknown[][] = [];
    const recordingFontkit = {
      create: (...args: [Uint8Array, string?]) => {
        calls.push(args);
        return fontkit.create(args[0]);
      },
    };
    await CustomFontEmbedder.for(
      recordingFontkit,
      ubuntuFont,
      undefined,
      undefined,
      'Ubuntu',
    );
    expect(calls[0]![1]).toBe('Ubuntu');
  });

  it('rejects font collections and missing faces with a clear error', async () => {
    const returning = (value: unknown) => ({ create: () => value as any });
    await expect(
      CustomFontEmbedder.for(returning({ type: 'TTC', fonts: [] }), ubuntuFont),
    ).rejects.toThrow(/font collection/);
    await expect(
      CustomFontSubsetEmbedder.for(returning(null), ubuntuFont),
    ).rejects.toThrow(/returned no font/);
  });

  // The Fantasque WOFF wraps CFF outlines; the WOFF2 wraps TrueType outlines
  // with a transformed glyf/loca, so both embedding routes are covered.
  describe('with a WOFF (CFF) source font', () => {
    const webFont = fs.readFileSync(
      './assets/fonts/fantasque/Webfonts/FantasqueSansMono-Regular.woff',
    );

    it('embeds a decoded CFF instead of the compressed web font', async () => {
      const context = PDFContext.create();
      const embedder = await CustomFontEmbedder.for(fontkit, webFont);
      const ref = await embedder.embedIntoContext(context);

      const { key, bytes } = fontFileOf(context, ref);
      expect(key).toBe('FontFile3');
      // CFF header: major version 1 (not the 'wOFF' signature).
      expect(bytes[0]).toBe(1);

      const source = embedder.font as any;
      const embedded = CFFFont.decode(new DecodeStream(bytes));
      expect(embedded.topDict['CharStrings'].length).toBe(source.numGlyphs);

      // Glyph ids are kept, so text encoded against the source font still
      // addresses the same outlines.
      for (const char of 'Ag&') {
        const id = source.glyphForCodePoint(char.codePointAt(0)!).id;
        expect(embedded.getCharString(id)).toEqual(
          source['CFF '].getCharString(id),
        );
      }
    });
  });

  it.each([
    ['name-keyed', './assets/fonts/fantasque/OTF/FantasqueSansMono-Regular.otf'],
    ['CID-keyed', './assets/fonts/source_hans_jp/SourceHanSerifJP-Regular.otf'],
  ])(
    'embeds a whole %s OpenType font as an identity-mapped bare CFF',
    async (_kind, path) => {
      const otf = fs.readFileSync(path);
      const context = PDFContext.create();
      const embedder = await CustomFontEmbedder.for(fontkit, otf);
      const ref = await embedder.embedIntoContext(context);

      const cidFont = context
        .lookup(ref, PDFDict)
        .lookup(PDFName.of('DescendantFonts'), PDFArray)
        .lookup(0, PDFDict);
      expect(cidFont.get(PDFName.of('Subtype'))).toBe(
        PDFName.of('CIDFontType0'),
      );
      const descriptor = cidFont.lookup(PDFName.of('FontDescriptor'), PDFDict);
      const stream = descriptor.lookup(PDFName.of('FontFile3'), PDFRawStream);
      expect(stream.dict.get(PDFName.of('Subtype'))).toBe(
        PDFName.of('CIDFontType0C'),
      );

      const source = embedder.font as any;
      const embedded = CFFFont.decode(
        new DecodeStream(decodePDFRawStream(stream).decode()),
      );
      const numGlyphs = source.numGlyphs;
      expect(embedded.isCIDFont).toBe(true);
      expect(embedded.topDict['CharStrings'].length).toBe(numGlyphs);
      // Identity charset: GID n is CID n for every glyph.
      expect(embedded.topDict['charset'].ranges).toEqual([
        expect.objectContaining({ first: 1, nLeft: numGlyphs - 2 }),
      ]);

      const gid = source.glyphForCodePoint(0x41).id;
      expect(Array.from(embedded.getCharString(gid))).toEqual(
        Array.from(source['CFF '].getCharString(gid)),
      );
    },
    60_000,
  );

  it('maps Source Han GID 365 to CID 365 (its source CID is 621)', async () => {
    const otf = fs.readFileSync(
      './assets/fonts/source_hans_jp/SourceHanSerifJP-Regular.otf',
    );
    const embedder = await CustomFontEmbedder.for(fontkit, otf);
    const source = embedder.font as any;
    const context = PDFContext.create();
    const ref = await embedder.embedIntoContext(context);
    const { bytes } = fontFileOf(context, ref);
    const embedded = CFFFont.decode(new DecodeStream(bytes));
    expect(embedded.topDict['charset'].ranges).toEqual([
      expect.objectContaining({ first: 1 }),
    ]);
    expect(Array.from(embedded.getCharString(365))).toEqual(
      Array.from(source['CFF '].getCharString(365)),
    );
  }, 60_000);

  describe('with a WOFF2 (TrueType) source font', () => {
    const webFont = fs.readFileSync(
      './assets/fonts/fantasque/Webfonts/FantasqueSansMono-Regular.woff2',
    );

    it('embeds a decoded sfnt instead of the compressed web font', async () => {
      const context = PDFContext.create();
      const embedder = await CustomFontEmbedder.for(fontkit, webFont);
      const ref = await embedder.embedIntoContext(context);

      const { key, bytes } = fontFileOf(context, ref);
      expect(key).toBe('FontFile2');
      expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('true');

      const source = embedder.font as any;
      const embedded = fontkit.create(bytes);
      expect(embedded.numGlyphs).toBe(source.numGlyphs);

      // Glyph ids are kept, so text encoded against the source font still
      // addresses the same outlines and widths.
      for (const char of 'Ag&') {
        const id = source.glyphForCodePoint(char.codePointAt(0)!).id;
        const expected = source.getGlyph(id);
        const actual = embedded.getGlyph(id);
        expect(actual.advanceWidth).toBe(expected.advanceWidth);
        expectBBoxClose(actual.path.bbox, expected.path.bbox);
      }

      // Flattened glyphs can exceed the source maxp limits; they must be
      // recomputed to match the encoded glyphs exactly.
      let maxPoints = 0;
      let maxContours = 0;
      for (let id = 0; id < embedded.numGlyphs; id++) {
        const decoded = embedded.getGlyph(id)._decode();
        expect(decoded.numberOfContours).toBeGreaterThanOrEqual(0);
        if (decoded.numberOfContours === 0) continue;
        maxPoints = Math.max(maxPoints, decoded.points.length);
        maxContours = Math.max(maxContours, decoded.numberOfContours);
        // Every re-encoded outline decodes back to the source outline, up to
        // rounding scaled composite components to the integer grid.
        const actual = embedded.getGlyph(id).path.bbox;
        const expected = source.getGlyph(id).path.bbox;
        for (const key of ['minX', 'minY', 'maxX', 'maxY'] as const) {
          expect(Math.abs(actual[key] - expected[key])).toBeLessThanOrEqual(1);
        }
      }
      expect(embedded.maxp.maxPoints).toBe(maxPoints);
      expect(embedded.maxp.maxContours).toBe(maxContours);
      expect(embedded.maxp.maxComponentElements).toBe(0);
      expect(embedded.maxp.maxComponentDepth).toBe(0);
    });

    it('embeds a valid sfnt when subsetting', async () => {
      const context = PDFContext.create();
      const embedder = await CustomFontSubsetEmbedder.for(fontkit, webFont);
      embedder.encodeText('A');
      const ref = await embedder.embedIntoContext(context);

      const embedded = fontkit.create(fontFileOf(context, ref).bytes);
      const source = embedder.font as any;
      const expected = source.glyphForCodePoint(0x41);
      const actual = embedded.getGlyph(1);
      expect(actual.advanceWidth).toBe(expected.advanceWidth);
      expectBBoxClose(actual.path.bbox, expected.path.bbox);
    });
  });

  describe('with a CFF2 (variable PostScript-outline) source font', () => {
    const otf = fs.readFileSync(
      './assets/fonts/fonttest/AdobeVFPrototype-Subset.otf',
    );

    for (const subset of [false, true]) {
      it(`embeds a converted TrueType font (${subset ? 'subset' : 'whole'})`, async () => {
        const context = PDFContext.create();
        const embedder = subset
          ? await CustomFontSubsetEmbedder.for(fontkit, otf)
          : await CustomFontEmbedder.for(fontkit, otf);
        embedder.encodeText('$');
        const ref = await embedder.embedIntoContext(context);

        const { key, bytes } = fontFileOf(context, ref);
        expect(key).toBe('FontFile2');
        const cidFont = context
          .lookup(ref, PDFDict)
          .lookup(PDFName.of('DescendantFonts'), PDFArray)
          .lookup(0, PDFDict);
        expect(cidFont.get(PDFName.of('Subtype'))).toBe(
          PDFName.of('CIDFontType2'),
        );

        const embedded = fontkit.create(bytes) as any;
        expect(embedded.directory.tables.glyf).toBeDefined();
        const source = embedder.font as any;
        const expected = source.glyphForCodePoint(0x24);
        const actual = embedded.getGlyph(subset ? 1 : expected.id);
        expect(actual.advanceWidth).toBe(Math.round(expected.advanceWidth));
        // /W carries the same (rounded) advance the font file holds.
        expect(widthsOf(context, ref).get(subset ? 1 : expected.id)).toBe(
          actual.advanceWidth,
        );
        const a = actual.path.bbox;
        const e = expected.path.bbox;
        for (const k of ['minX', 'minY', 'maxX', 'maxY'] as const) {
          expect(Math.abs(a[k] - e[k])).toBeLessThanOrEqual(1);
        }
      });
    }
  });
});

describe('deriveFontFlags', () => {
  it('tolerates fonts without post, head or OS/2 tables', () => {
    expect(deriveFontFlags({} as any)).toBe(1 << 2);
    expect(deriveFontFlags({ head: {} } as any)).toBe(1 << 2);
  });

  it('reads fixed pitch and italic flags when present', () => {
    const flags = deriveFontFlags({
      post: { isFixedPitch: 1 },
      head: { macStyle: { italic: true } },
    } as any);
    expect(flags).toBe((1 << 0) | (1 << 2) | (1 << 6));
  });
});

describe('compressWidths', () => {
  it('returns an empty array for no glyphs', () => {
    expect(compressWidths([])).toEqual([]);
  });

  it('groups consecutive ids into sections', () => {
    expect(
      compressWidths([
        [1, 10],
        [2, 20],
        [3, 10],
        [7, 5],
        [8, 6],
      ]),
    ).toEqual([1, [10, 20, 10], 7, [5, 6]]);
  });

  it('writes runs of equal widths as ranges', () => {
    expect(
      compressWidths([
        [0, 7],
        [1, 500],
        [2, 500],
        [3, 500],
        [4, 500],
        [5, 8],
        [6, 9],
        [10, 1],
        [11, 1],
        [12, 1],
      ]),
    ).toEqual([0, [7], 1, 4, 500, 5, [8, 9], 10, [1, 1, 1]]);
  });

  it('compresses a font with many same-width glyphs', async () => {
    const entries: [number, number][] = [];
    for (let id = 0; id < 20000; id++) entries.push([id, 1000]);
    expect(compressWidths(entries)).toEqual([0, 19999, 1000]);
  });
});

const widthsOf = (context: PDFContext, fontRef: PDFRef) => {
  const cidFontDict = context
    .lookup(fontRef, PDFDict)
    .lookup(PDFName.of('DescendantFonts'), PDFArray)
    .lookup(0, PDFDict);
  const W = cidFontDict.lookup(PDFName.of('W'), PDFArray);

  const widths = new Map<number, number>();
  let idx = 0;
  while (idx < W.size()) {
    const first = W.lookup(idx, PDFNumber).asNumber();
    const next = W.lookup(idx + 1);
    if (next instanceof PDFArray) {
      next.asArray().forEach((width, offset) => {
        widths.set(first + offset, (width as PDFNumber).asNumber());
      });
      idx += 2;
    } else {
      const last = (next as PDFNumber).asNumber();
      const width = W.lookup(idx + 2, PDFNumber).asNumber();
      for (let id = first; id <= last; id++) widths.set(id, width);
      idx += 3;
    }
  }
  return widths;
};

const fontFileOf = (context: PDFContext, fontRef: PDFRef) => {
  const descriptor = context
    .lookup(fontRef, PDFDict)
    .lookup(PDFName.of('DescendantFonts'), PDFArray)
    .lookup(0, PDFDict)
    .lookup(PDFName.of('FontDescriptor'), PDFDict);
  const key = descriptor.has(PDFName.of('FontFile2'))
    ? 'FontFile2'
    : 'FontFile3';
  const stream = descriptor.lookup(PDFName.of(key), PDFRawStream);
  return { key, bytes: decodePDFRawStream(stream).decode() };
};

const expectBBoxClose = (
  actual: { minX: number; minY: number; maxX: number; maxY: number },
  expected: { minX: number; minY: number; maxX: number; maxY: number },
) => {
  expect(actual.minX).toBeCloseTo(expected.minX);
  expect(actual.minY).toBeCloseTo(expected.minY);
  expect(actual.maxX).toBeCloseTo(expected.maxX);
  expect(actual.maxY).toBeCloseTo(expected.maxY);
};

const toUnicodeOf =(context: PDFContext, fontRef: PDFRef) => {
  const stream = context
    .lookup(fontRef, PDFDict)
    .lookup(PDFName.of('ToUnicode'), PDFRawStream);
  return new TextDecoder().decode(decodePDFRawStream(stream).decode());
};
