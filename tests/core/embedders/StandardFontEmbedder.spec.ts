import { FontNames } from "../../../src/vendors/standard-fonts/index.js";
import {
  PDFContext,
  PDFDict,
  PDFHexString,
  PDFRef,
  StandardFontEmbedder,
} from "../../../src/index";

describe("StandardFontEmbedder", () => {
  it("can be constructed with StandardFontEmbedder.for(...)", () => {
    const embedder = StandardFontEmbedder.for(FontNames.Helvetica);
    expect(embedder).toBeInstanceOf(StandardFontEmbedder);
  });

  it.each([
    { ascent: 700, descent: -200, top: 700, bottom: -200 },
    { ascent: 0, descent: -200, top: 900, bottom: -200 },
    { ascent: 700, descent: 0, top: 700, bottom: -300 },
  ])(
    "measures ascent $ascent and descent $descent independently",
    ({ ascent, descent, top, bottom }) => {
      const embedder = StandardFontEmbedder.for(FontNames.Helvetica);
      const originalFont = embedder.font;
      const font = Object.create(originalFont);
      Object.defineProperties(font, {
        Ascender: { value: ascent },
        Descender: { value: descent },
        FontBBox: { value: [0, -300, 1000, 900] },
      });
      Object.defineProperty(embedder, "font", { value: font });

      expect(embedder.heightOfFontAtSize(24)).toBeCloseTo(((top - bottom) / 1000) * 24);
      expect(embedder.heightOfFontAtSize(24, { descender: false })).toBeCloseTo((top / 1000) * 24);
      expect(embedder.sizeOfFontAtHeight(24)).toBeCloseTo((1000 * 24) / (top - bottom));
    },
  );

  it("exposes the font's name", () => {
    const embedder = StandardFontEmbedder.for(FontNames.HelveticaOblique);
    expect(embedder.fontName).toBe("Helvetica-Oblique");
  });

  it("can use a custom font name", () => {
    const customName = "Roboto 2";

    const embedder = StandardFontEmbedder.for(FontNames.HelveticaOblique, customName);

    expect(embedder.customName).toBe(customName);
  });

  it("can embed standard font dictionaries into PDFContexts without a predefined ref", () => {
    const context = PDFContext.create();
    const embedder = StandardFontEmbedder.for(FontNames.Courier);

    expect(context.enumerateIndirectObjects().length).toBe(0);
    const ref = embedder.embedIntoContext(context);
    expect(context.enumerateIndirectObjects().length).toBe(1);
    expect(context.lookup(ref)).toBeInstanceOf(PDFDict);
  });

  it("can embed standard font dictionaries into PDFContexts with a predefined ref", () => {
    const context = PDFContext.create();
    const predefinedRef = PDFRef.of(9999);
    const embedder = StandardFontEmbedder.for(FontNames.Courier);

    expect(context.enumerateIndirectObjects().length).toBe(0);
    const ref = embedder.embedIntoContext(context, predefinedRef);
    expect(context.enumerateIndirectObjects().length).toBe(1);
    expect(context.lookup(predefinedRef)).toBeInstanceOf(PDFDict);
    expect(ref).toBe(predefinedRef);
  });

  it("can encode text strings into PDFHexString objects", () => {
    const text = "Stuff and thingz!";
    const embedder = StandardFontEmbedder.for(FontNames.TimesRoman);
    expect(embedder.encodeText(text).toHexString()).toBeInstanceOf(PDFHexString);
    expect(String(embedder.encodeText(text).toHexString())).toBe(
      String(PDFHexString.of("537475666620616E64207468696E677A21")),
    );
  });

  it("can measure the width of text strings at the given font size", () => {
    const text = "Stuff and thingz!";
    const embedder = StandardFontEmbedder.for(FontNames.HelveticaBold);
    expect(embedder.widthOfTextAtSize(text, 12)).toBe(94.656);
    expect(embedder.widthOfTextAtSize(text, 24)).toBe(189.312);
  });

  it("can measure the height of the font at the given size", () => {
    const embedder = StandardFontEmbedder.for(FontNames.HelveticaBold);
    expect(embedder.heightOfFontAtSize(12)).toBeCloseTo(11.1);
    expect(embedder.heightOfFontAtSize(24)).toBeCloseTo(22.2);
  });

  it("can measure the size of the font at a given height", () => {
    const embedder = StandardFontEmbedder.for(FontNames.HelveticaBold);
    expect(embedder.sizeOfFontAtHeight(12)).toBeCloseTo(12.972);
    expect(embedder.sizeOfFontAtHeight(24)).toBeCloseTo(25.945);
  });
});
