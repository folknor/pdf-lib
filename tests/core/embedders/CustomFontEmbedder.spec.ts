import fontkit from 'src/fontkit.js';
import fs from 'fs';

import {
  CustomFontEmbedder,
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

const toUnicodeOf = (context: PDFContext, fontRef: PDFRef) => {
  const stream = context
    .lookup(fontRef, PDFDict)
    .lookup(PDFName.of('ToUnicode'), PDFRawStream);
  return new TextDecoder().decode(decodePDFRawStream(stream).decode());
};
