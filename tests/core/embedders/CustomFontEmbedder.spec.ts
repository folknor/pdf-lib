import fontkit from "src/fontkit.js";
import fs from "fs";

import { deriveFontFlags } from "../../../src/core/embedders/FontFlags";
import CFFFont from "../../../src/fontkit/cff/CFFFont";
import { DecodeStream } from "../../../src/vendors/restructure/index";
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
} from "../../../src/index";
import { compressWidths } from "../../../src/core/embedders/CustomFontEmbedder";

const ubuntuFont = fs.readFileSync("./assets/fonts/ubuntu/Ubuntu-R.ttf");

const notoSansThai = fs.readFileSync("./assets/fonts/noto_sans_thai/NotoSansThai[wdth,wght].ttf");

const sourceHanFont = fs.readFileSync("./assets/fonts/source_hans_jp/SourceHanSerifJP-Regular.otf");

describe("CustomFontEmbedder", () => {
  it("can be constructed with CustomFontEmbedder.for(...)", async () => {
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    expect(embedder).toBeInstanceOf(CustomFontEmbedder);
  });

  it("exposes the font's name", async () => {
    const embedder = await CustomFontEmbedder.for(fontkit, new Uint8Array(ubuntuFont));

    expect(embedder.fontName).toBe("Ubuntu");
  });

  it("can set a custom font name", async () => {
    const customName = "abc123";

    const embedder = await CustomFontEmbedder.for(fontkit, new Uint8Array(ubuntuFont), customName);

    expect(embedder.customName).toBe(customName);
  });

  it("can embed font dictionaries into PDFContexts without a predefined ref", async () => {
    const context = PDFContext.create();

    const embedder = await CustomFontEmbedder.for(fontkit, new Uint8Array(ubuntuFont));

    expect(context.enumerateIndirectObjects().length).toBe(0);
    const ref = await embedder.embedIntoContext(context);
    expect(context.enumerateIndirectObjects().length).toBe(5);
    expect(context.lookup(ref)).toBeInstanceOf(PDFDict);
  });

  it("can embed font dictionaries into PDFContexts with a predefined ref", async () => {
    const context = PDFContext.create();
    const predefinedRef = PDFRef.of(9999);

    const embedder = await CustomFontEmbedder.for(fontkit, new Uint8Array(ubuntuFont));

    expect(context.enumerateIndirectObjects().length).toBe(0);
    const ref = await embedder.embedIntoContext(context, predefinedRef);
    expect(context.enumerateIndirectObjects().length).toBe(5);
    expect(context.lookup(predefinedRef)).toBeInstanceOf(PDFDict);
    expect(ref).toBe(predefinedRef);
  });

  it.each([false, true])(
    "writes the decoded TrueType program length (subset: %s)",
    async (subset) => {
      const context = PDFContext.create();

      const embedder = subset
        ? await CustomFontSubsetEmbedder.for(fontkit, ubuntuFont)
        : await CustomFontEmbedder.for(fontkit, ubuntuFont);

      embedder.encodeText("A");
      const ref = await embedder.embedIntoContext(context);
      const { key, bytes, stream } = fontFileOf(context, ref);

      expect(key).toBe("FontFile2");
      expect(stream.dict.lookup(PDFName.of("Length1"), PDFNumber).asNumber()).toBe(bytes.length);

      if (!subset) expect(bytes.length).toBe(ubuntuFont.length);
      else expect(bytes.length).toBeLessThan(ubuntuFont.length);
    },
  );

  it("can encode text strings into PDFHexString objects", async () => {
    const text = "Stuff and thingz!";

    const hexCodes = "00360057005801AA000300440051004700030057004B004C0051004A005D0004";

    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);

    expect(embedder.encodeText(text).toHexString()).toBeInstanceOf(PDFHexString);
    expect(String(embedder.encodeText(text).toHexString())).toBe(String(PDFHexString.of(hexCodes)));
  });

  it("encodes the positions of kerned glyphs and measures with them", async () => {
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    const encoded = embedder.encodeText("AVA");
    // Ubuntu kerns A V through GPOS: the advance is narrower than /W's.
    expect(encoded.advances[0]).toBeLessThan(encoded.widths[0]!);
    expect(encoded.isUnpositioned()).toBe(false);
    expect(embedder.widthOfTextAtSize("AVA", 1000)).toBeCloseTo(encoded.advance);
    const unkerned = encoded.widths.reduce((sum, w) => sum + w, 0);
    expect(encoded.advance).toBeLessThan(unkerned);
  });

  it("gives a hidden default-ignorable no advance", async () => {
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    const withZwsp = embedder.encodeText("a​b");
    const without = embedder.encodeText("ab");
    expect(withZwsp.codes.length).toBe(3);
    expect(withZwsp.advances[1]).toBe(0);
    expect(withZwsp.advance).toBeCloseTo(without.advance);
  });

  it("can measure the width of text strings at the given font size", async () => {
    const text = "Stuff and thingz!";
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    // Measured from the shaped glyphs encodeText() emits ("ff" is a ligature).
    expect(embedder.widthOfTextAtSize(text, 12)).toBe(90.672);
    expect(embedder.widthOfTextAtSize(text, 24)).toBe(181.344);
  });

  it("measures the glyphs it encodes", async () => {
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    const text = "office ffl";
    const encoded = embedder.encodeText(text);
    const ids = encoded.codes.map((h) => parseInt(h, 16));

    const expected = ids.reduce(
      (sum, id) => sum + Math.round(embedder.font.getGlyph(id).advanceWidth),
      0,
    );

    expect(ids.length).toBeLessThan(text.length);
    // No kerning in this string, so the advances are the /W widths.
    expect(encoded.isUnpositioned()).toBe(true);
    expect(embedder.widthOfTextAtSize(text, 1000)).toBeCloseTo(
      (expected * 1000) / embedder.font.unitsPerEm,
    );
  });

  it("can measure the height of the font at the given size", async () => {
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    expect(embedder.heightOfFontAtSize(12)).toBeCloseTo(13.452);
    expect(embedder.heightOfFontAtSize(24)).toBeCloseTo(26.904);
  });

  for (const Embedder of [CustomFontEmbedder, CustomFontSubsetEmbedder]) {
    describe(`${Embedder.name} height metrics`, () => {
      it.each([
        { ascent: 1500, descent: -400, top: 1500, bottom: -400 },
        { ascent: 0, descent: -400, top: 1800, bottom: -400 },
        { ascent: 1500, descent: 0, top: 1500, bottom: -600 },
      ])(
        "measures ascent $ascent and descent $descent independently",
        async ({ ascent, descent, top, bottom }) => {
          const font = fontkit.create(ubuntuFont);
          Object.defineProperties(font, {
            unitsPerEm: { value: 2000 },
            ascent: { value: ascent },
            descent: { value: descent },
            bbox: { value: { minX: 0, minY: -600, maxX: 2000, maxY: 1800 } },
          });
          const embedder = await Embedder.for({ create: () => font }, ubuntuFont);

          expect(embedder.heightOfFontAtSize(24)).toBeCloseTo(((top - bottom) / 2000) * 24);
          expect(embedder.heightOfFontAtSize(24, { descender: false })).toBeCloseTo(
            (top / 2000) * 24,
          );
          expect(embedder.sizeOfFontAtHeight(24)).toBeCloseTo((2000 * 24) / (top - bottom));
        },
      );
    });
  }

  it("can measure the size of the font at a given height", async () => {
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    expect(embedder.sizeOfFontAtHeight(12)).toBeCloseTo(10.705);
    expect(embedder.sizeOfFontAtHeight(24)).toBeCloseTo(21.409);
  });

  it("does not create orphan objects when re-embedded", async () => {
    const context = PDFContext.create();
    const predefinedRef = PDFRef.of(9999);

    const embedder = await CustomFontEmbedder.for(fontkit, new Uint8Array(ubuntuFont));

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

  it("writes the width of every glyph, including glyphs without code points", async () => {
    const context = PDFContext.create();
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    const { font } = embedder;

    const ref = await embedder.embedIntoContext(context);
    const widths = widthsOf(context, ref);

    expect(widths.size).toBe(font.numGlyphs);

    for (let id = 0; id < font.numGlyphs; id++) {
      expect(widths.get(id)).toBeCloseTo(font.getGlyph(id).advanceWidth * (1000 / font.unitsPerEm));
    }
  });

  it("writes the width of ligature glyphs produced by shaping", async () => {
    const context = PDFContext.create();
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    const { font } = embedder;

    const { glyphs, codePoints } = font.layout("Stuff");
    const ligature = glyphs.find((_, idx) => codePoints![idx]!.length > 1);
    expect(ligature).toBeDefined();

    const ref = await embedder.embedIntoContext(context);
    expect(widthsOf(context, ref).get(ligature!.id)).toBeCloseTo(
      ligature!.advanceWidth * (1000 / font.unitsPerEm),
    );
  });

  it("keeps ToUnicode mappings and omits glyphs without code points", async () => {
    const context = PDFContext.create();
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);

    const ref = await embedder.embedIntoContext(context);
    const cmap = toUnicodeOf(context, ref);

    expect(cmap).not.toMatch(/<[0-9a-f]{4}> <>/i);
    // 'A' (glyph 0x24 in Ubuntu) must survive /W touching every glyph first.
    expect(cmap).toContain("<0024> <0041>");
  });

  // Noto Sans Thai picks uni0E49.small (glyph 0x31), which no cmap entry
  // reaches, for the tone mark of น้ำ.
  it("maps glyphs only shaping reaches to the text they were drawn for", async () => {
    for (const Embedder of [CustomFontEmbedder, CustomFontSubsetEmbedder]) {
      const context = PDFContext.create();
      const embedder = await Embedder.for(fontkit, notoSansThai);
      const { codes } = embedder.encodeText("น้ำ");
      const cmap = toUnicodeOf(context, await embedder.embedIntoContext(context));
      expect(cmap).toContain(`<${codes[2]!.toUpperCase()}> <0E49>`);
    }
  });

  it("maps a glyph by the first text encoded with it, not by layout history", async () => {
    const context = PDFContext.create();
    const embedder = await CustomFontEmbedder.for(fontkit, sourceHanFont);
    // Lay out a soft hyphen first: it shares glyph 14 with U+002D.
    embedder.font.layout("a­b");
    embedder.encodeText("a-b");
    const cmap = toUnicodeOf(context, await embedder.embedIntoContext(context));
    expect(cmap).toContain("<000E> <002D>");
  });

  it("gives no mapping to a glyph encoded only for hidden text", async () => {
    for (const Embedder of [CustomFontEmbedder, CustomFontSubsetEmbedder]) {
      const context = PDFContext.create();
      const embedder = await Embedder.for(fontkit, ubuntuFont);
      // A hidden soft hyphen is drawn as the space glyph.
      const { codes } = embedder.encodeText("a­b");
      const cmap = toUnicodeOf(context, await embedder.embedIntoContext(context));
      expect(cmap).not.toContain(`<${codes[1]!.toUpperCase()}>`);
      expect(cmap).toContain(`<${codes[0]!.toUpperCase()}> <0061>`);
    }
  });

  it("gives word spacing to U+0020, not to a no-break space", async () => {
    const embedder = await CustomFontEmbedder.for(fontkit, sourceHanFont);
    const encoded = embedder.encodeText("a b c");
    // Source Han draws both with one glyph.
    expect(encoded.codes[1]).toBe(encoded.codes[3]);
    const base = { characters: 1, spaces: 0 };
    expect(encoded.spacing).toEqual([base, { characters: 1, spaces: 1 }, base, base, base]);
    // The no-break space extracts as the space its glyph is mapped to, so
    // it gets /ActualText; nothing else does.
    expect(encoded.actualText).toEqual([{ start: 3, end: 4, text: "\u00a0" }]);
  });

  it("writes the typed text as ActualText where shaping changed it", async () => {
    for (const Embedder of [CustomFontEmbedder, CustomFontSubsetEmbedder]) {
      const embedder = await Embedder.for(fontkit, notoSansThai);
      // SARA AM is drawn as NIKHAHIT, tone mark, SARA AA: one cluster.
      const encoded = embedder.encodeText("กน้ำ");
      expect(encoded.actualText).toEqual([{ start: 1, end: encoded.codes.length, text: "น้ำ" }]);
      expect(encoded.spacing.map((k) => k.characters)).toEqual([
        1,
        ...encoded.codes.slice(2).map(() => 0),
        2,
      ]);
    }
  });

  it("wraps a hidden default-ignorable whose drawn glyph may map to a space", async () => {
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    embedder.encodeText(" ");
    const encoded = embedder.encodeText("a\u00adb");
    expect(encoded.actualText).toEqual([{ start: 0, end: 2, text: "a\u00ad" }]);
    expect(encoded.spacing.map((k) => k.characters)).toEqual([0, 1, 1]);
  });

  it("skips code points whose glyph lookup returns null", async () => {
    const context = PDFContext.create();
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    const font = embedder.font as any;
    const original = font.glyphForCodePoint.bind(font);
    font.glyphForCodePoint = (codePoint: number) =>
      codePoint === 0x41 ? null : original(codePoint);

    const ref = await embedder.embedIntoContext(context);
    const cmap = toUnicodeOf(context, ref);
    expect(cmap).not.toContain("<0024> <0041>");
    expect(cmap).toContain("<0025> <0042>");
  });

  it("passes the PostScript name through to fontkit.create", async () => {
    const calls: unknown[][] = [];

    const recordingFontkit = {
      create: (...args: [Uint8Array, string?]) => {
        calls.push(args);

        return fontkit.create(args[0]);
      },
    };

    await CustomFontEmbedder.for(recordingFontkit, ubuntuFont, undefined, undefined, "Ubuntu");
    expect(calls[0]![1]).toBe("Ubuntu");
  });

  it("rejects font collections and missing faces with a clear error", async () => {
    const returning = (value: unknown) => ({ create: () => value as any });
    await expect(
      CustomFontEmbedder.for(returning({ type: "TTC", fonts: [] }), ubuntuFont),
    ).rejects.toThrow(/font collection/);
    await expect(CustomFontSubsetEmbedder.for(returning(null), ubuntuFont)).rejects.toThrow(
      /returned no font/,
    );
  });

  // The Fantasque WOFF wraps CFF outlines; the WOFF2 wraps TrueType outlines
  // with a transformed glyf/loca, so both embedding routes are covered.
  describe("with a WOFF (CFF) source font", () => {
    const webFont = fs.readFileSync(
      "./assets/fonts/fantasque/Webfonts/FantasqueSansMono-Regular.woff",
    );

    it("embeds a decoded CFF instead of the compressed web font", async () => {
      const context = PDFContext.create();
      const embedder = await CustomFontEmbedder.for(fontkit, webFont);
      const ref = await embedder.embedIntoContext(context);

      const { key, bytes, stream } = fontFileOf(context, ref);
      expect(key).toBe("FontFile3");
      // CFF header: major version 1 (not the 'wOFF' signature).
      expect(bytes[0]).toBe(1);

      expect(stream.dict.has(PDFName.of("Length1"))).toBe(false);

      const source = embedder.font as any;
      const embedded = CFFFont.decode(new DecodeStream(bytes));
      expect(embedded.topDict["CharStrings"].length).toBe(source.numGlyphs);

      // Glyph ids are kept, so text encoded against the source font still
      // addresses the same outlines.
      for (const char of "Ag&") {
        const id = source.glyphForCodePoint(char.codePointAt(0)!).id;
        expect(embedded.getCharString(id)).toEqual(source["CFF "].getCharString(id));
      }
    });
  });

  it.each([
    ["name-keyed", "./assets/fonts/fantasque/OTF/FantasqueSansMono-Regular.otf"],
    ["CID-keyed", "./assets/fonts/source_hans_jp/SourceHanSerifJP-Regular.otf"],
  ])(
    "embeds a whole %s OpenType font as an identity-mapped bare CFF",
    async (_kind, path) => {
      const otf = fs.readFileSync(path);
      const context = PDFContext.create();
      const embedder = await CustomFontEmbedder.for(fontkit, otf);
      const ref = await embedder.embedIntoContext(context);

      const cidFont = context
        .lookup(ref, PDFDict)
        .lookup(PDFName.of("DescendantFonts"), PDFArray)
        .lookup(0, PDFDict);

      expect(cidFont.get(PDFName.of("Subtype"))).toBe(PDFName.of("CIDFontType0"));
      const descriptor = cidFont.lookup(PDFName.of("FontDescriptor"), PDFDict);
      const stream = descriptor.lookup(PDFName.of("FontFile3"), PDFRawStream);
      expect(stream.dict.get(PDFName.of("Subtype"))).toBe(PDFName.of("CIDFontType0C"));

      const source = embedder.font as any;

      const embedded = CFFFont.decode(new DecodeStream(decodePDFRawStream(stream).decode()));

      const numGlyphs = source.numGlyphs;
      expect(embedded.isCIDFont).toBe(true);
      expect(embedded.topDict["CharStrings"].length).toBe(numGlyphs);
      // Identity charset: GID n is CID n for every glyph.
      expect(embedded.topDict["charset"].ranges).toEqual([
        expect.objectContaining({ first: 1, nLeft: numGlyphs - 2 }),
      ]);

      const gid = source.glyphForCodePoint(0x41).id;
      expect(Array.from(embedded.getCharString(gid))).toEqual(
        Array.from(source["CFF "].getCharString(gid)),
      );
    },
    60_000,
  );

  it("maps Source Han GID 365 to CID 365 (its source CID is 621)", async () => {
    const otf = fs.readFileSync("./assets/fonts/source_hans_jp/SourceHanSerifJP-Regular.otf");

    const embedder = await CustomFontEmbedder.for(fontkit, otf);
    const source = embedder.font as any;
    const context = PDFContext.create();
    const ref = await embedder.embedIntoContext(context);
    const { bytes } = fontFileOf(context, ref);
    const embedded = CFFFont.decode(new DecodeStream(bytes));
    expect(embedded.topDict["charset"].ranges).toEqual([expect.objectContaining({ first: 1 })]);
    expect(Array.from(embedded.getCharString(365))).toEqual(
      Array.from(source["CFF "].getCharString(365)),
    );
  }, 60_000);

  describe("with a WOFF2 (TrueType) source font", () => {
    const webFont = fs.readFileSync(
      "./assets/fonts/fantasque/Webfonts/FantasqueSansMono-Regular.woff2",
    );

    it("embeds a decoded sfnt instead of the compressed web font", async () => {
      const context = PDFContext.create();
      const embedder = await CustomFontEmbedder.for(fontkit, webFont);
      const ref = await embedder.embedIntoContext(context);

      const { key, bytes, stream } = fontFileOf(context, ref);
      expect(key).toBe("FontFile2");
      expect(stream.dict.lookup(PDFName.of("Length1"), PDFNumber).asNumber()).toBe(bytes.length);
      expectWellFormedSfnt(bytes);

      const source = embedder.font as any;
      const embedded = fontkit.create(bytes);
      expect(embedded.numGlyphs).toBe(source.numGlyphs);

      // Glyph ids are kept, so text encoded against the source font still
      // addresses the same outlines and widths.
      for (const char of "Ag&") {
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

        for (const key of ["minX", "minY", "maxX", "maxY"] as const) {
          expect(Math.abs(actual[key] - expected[key])).toBeLessThanOrEqual(1);
        }
      }

      expect(embedded.maxp.maxPoints).toBe(maxPoints);
      expect(embedded.maxp.maxContours).toBe(maxContours);
      expect(embedded.maxp.maxComponentElements).toBe(0);
      expect(embedded.maxp.maxComponentDepth).toBe(0);
    });

    it("embeds a valid sfnt when subsetting", async () => {
      const context = PDFContext.create();
      const embedder = await CustomFontSubsetEmbedder.for(fontkit, webFont);
      embedder.encodeText("A");
      const ref = await embedder.embedIntoContext(context);

      const { bytes } = fontFileOf(context, ref);
      expectWellFormedSfnt(bytes);
      const embedded = fontkit.create(bytes);
      const source = embedder.font as any;
      const expected = source.glyphForCodePoint(0x41);
      const actual = embedded.getGlyph(1);
      expect(actual.advanceWidth).toBe(expected.advanceWidth);
      expectBBoxClose(actual.path.bbox, expected.path.bbox);
    });
  });

  describe("with a CFF2 (variable PostScript-outline) source font", () => {
    const otf = fs.readFileSync("./assets/fonts/fonttest/AdobeVFPrototype-Subset.otf");

    for (const subset of [false, true]) {
      it(`embeds a converted TrueType font (${subset ? "subset" : "whole"})`, async () => {
        const context = PDFContext.create();

        const embedder = subset
          ? await CustomFontSubsetEmbedder.for(fontkit, otf)
          : await CustomFontEmbedder.for(fontkit, otf);

        embedder.encodeText("$");
        const ref = await embedder.embedIntoContext(context);

        const { key, bytes, stream } = fontFileOf(context, ref);
        expect(key).toBe("FontFile2");
        expect(stream.dict.lookup(PDFName.of("Length1"), PDFNumber).asNumber()).toBe(bytes.length);

        const cidFont = context
          .lookup(ref, PDFDict)
          .lookup(PDFName.of("DescendantFonts"), PDFArray)
          .lookup(0, PDFDict);

        expect(cidFont.get(PDFName.of("Subtype"))).toBe(PDFName.of("CIDFontType2"));

        const embedded = fontkit.create(bytes) as any;
        expect(embedded.directory.tables.glyf).toBeDefined();
        const source = embedder.font as any;
        const expected = source.glyphForCodePoint(0x24);
        const actual = embedded.getGlyph(subset ? 1 : expected.id);
        expect(actual.advanceWidth).toBe(Math.round(expected.advanceWidth));
        // /W carries the same (rounded) advance the font file holds.
        expect(widthsOf(context, ref).get(subset ? 1 : expected.id)).toBe(actual.advanceWidth);
        const a = actual.path.bbox;
        const e = expected.path.bbox;

        for (const k of ["minX", "minY", "maxX", "maxY"] as const) {
          expect(Math.abs(a[k] - e[k])).toBeLessThanOrEqual(1);
        }

        // FontBBox is the converted program's own head box, not the source's.
        const scale = 1000 / embedded.unitsPerEm;
        const { minX, minY, maxX, maxY } = embedded.bbox;
        expect(fontBBoxOf(context, ref)).toEqual([
          minX * scale,
          minY * scale,
          maxX * scale,
          maxY * scale,
        ]);
        expect(maxY).toBeGreaterThanOrEqual(a.maxY);
        expect(minY).toBeLessThanOrEqual(a.minY);
      });
    }
  });
});

describe("deriveFontFlags", () => {
  it("tolerates fonts without post, head or OS/2 tables", () => {
    expect(deriveFontFlags({} as any)).toBe(1 << 2);
    expect(deriveFontFlags({ head: {} } as any)).toBe(1 << 2);
  });

  it("reads fixed pitch and italic flags when present", () => {
    const flags = deriveFontFlags({
      post: { isFixedPitch: 1 },
      head: { macStyle: { italic: true } },
    } as any);

    expect(flags).toBe((1 << 0) | (1 << 2) | (1 << 6));
  });
});

describe("compressWidths", () => {
  it("returns an empty array for no glyphs", () => {
    expect(compressWidths([])).toEqual([]);
  });

  it("groups consecutive ids into sections", () => {
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

  it("writes runs of equal widths as ranges", () => {
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

  it("compresses a font with many same-width glyphs", async () => {
    const entries: [number, number][] = [];

    for (let id = 0; id < 20000; id++) entries.push([id, 1000]);
    expect(compressWidths(entries)).toEqual([0, 19999, 1000]);
  });
});

const widthsOf = (context: PDFContext, fontRef: PDFRef) => {
  const cidFontDict = context
    .lookup(fontRef, PDFDict)
    .lookup(PDFName.of("DescendantFonts"), PDFArray)
    .lookup(0, PDFDict);

  const W = cidFontDict.lookup(PDFName.of("W"), PDFArray);

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

const fontBBoxOf = (context: PDFContext, fontRef: PDFRef) =>
  context
    .lookup(fontRef, PDFDict)
    .lookup(PDFName.of("DescendantFonts"), PDFArray)
    .lookup(0, PDFDict)
    .lookup(PDFName.of("FontDescriptor"), PDFDict)
    .lookup(PDFName.of("FontBBox"), PDFArray)
    .asArray()
    .map((n) => (n as PDFNumber).asNumber());

const fontFileOf = (context: PDFContext, fontRef: PDFRef) => {
  const descriptor = context
    .lookup(fontRef, PDFDict)
    .lookup(PDFName.of("DescendantFonts"), PDFArray)
    .lookup(0, PDFDict)
    .lookup(PDFName.of("FontDescriptor"), PDFDict);

  const key = descriptor.has(PDFName.of("FontFile2")) ? "FontFile2" : "FontFile3";

  const stream = descriptor.lookup(PDFName.of(key), PDFRawStream);

  return { key, bytes: decodePDFRawStream(stream).decode(), stream };
};

// Checks the sfnt layout from the raw bytes, independently of the encoder:
// TrueType signature, search fields, records sorted by tag, 4-aligned table
// offsets, per-table checksums (head taken with checkSumAdjustment zero) and
// the whole-file sum 0xB1B0AFBA.
const expectWellFormedSfnt = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const sum = (start: number, length: number) => {
    let total = 0;

    for (let i = 0; i < length; i += 4) {
      let word = 0;

      for (let b = 0; b < 4; b++) {
        const at = start + i + b;
        word = word * 256 + (i + b < length ? bytes[at]! : 0);
      }

      total = (total + word) % 2 ** 32;
    }

    return total;
  };

  expect(view.getUint32(0)).toBe(0x00010000);
  const numTables = view.getUint16(4);
  const searchRange = 2 ** Math.floor(Math.log2(numTables)) * 16;
  expect(view.getUint16(6)).toBe(searchRange);
  expect(view.getUint16(8)).toBe(Math.log2(searchRange / 16));
  expect(view.getUint16(10)).toBe(numTables * 16 - searchRange);

  const tags: string[] = [];

  for (let i = 0; i < numTables; i++) {
    const record = 12 + 16 * i;
    const tag = String.fromCharCode(...bytes.subarray(record, record + 4));
    const checkSum = view.getUint32(record + 4);
    const offset = view.getUint32(record + 8);
    const length = view.getUint32(record + 12);
    tags.push(tag);
    expect(offset % 4).toBe(0);
    expect(offset + length).toBeLessThanOrEqual(bytes.length);
    let expected = sum(offset, length);

    if (tag === "head") {
      expected = (expected - view.getUint32(offset + 8) + 2 ** 32) % 2 ** 32;
    }

    expect(checkSum).toBe(expected);
  }

  expect(tags).toEqual([...tags].sort());
  expect(tags).toContain("head");
  expect(bytes.length % 4).toBe(0);
  expect(sum(0, bytes.length)).toBe(0xb1b0afba);
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

const toUnicodeOf = (context: PDFContext, fontRef: PDFRef) => {
  const stream = context.lookup(fontRef, PDFDict).lookup(PDFName.of("ToUnicode"), PDFRawStream);

  return new TextDecoder().decode(decodePDFRawStream(stream).decode());
};
