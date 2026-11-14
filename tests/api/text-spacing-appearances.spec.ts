import fs from "fs";
import fontkit from "../../src/fontkit.js";
import { PDFDocument, StandardFonts, TextAlignment } from "../../src/index.js";
import {
  layoutSinglelineText,
  layoutMultilineText,
  layoutCombedText,
} from "../../src/api/text/layout.js";
import { defaultTextFieldAppearanceProvider } from "../../src/api/form/appearances.js";

it("measures, aligns, wraps and auto sizes the positioned text", async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const spacing = { characterSpacing: 2, wordSpacing: 5 };

  const options = {
    font,
    spacing,
    fontSize: 12,
    alignment: TextAlignment.Right,
    bounds: { x: 10, y: 0, width: 100, height: 100 },
  };

  const { line } = layoutSinglelineText("A A", options);
  expect(line.width).toBeCloseTo(font.widthOfTextAtSize("A A", 12) + 11);
  expect((line.encoded.advance * 12) / 1000).toBeCloseTo(line.width);
  expect(line.x).toBeCloseTo(110 - line.width);

  const wrapped = layoutMultilineText("A A A", {
    ...options,
    bounds: { ...options.bounds, width: font.widthOfTextAtSize("A A", 12) + 1 },
  });

  expect(wrapped.lines.map((value) => value.text)).toEqual(["A", "A", "A"]);
  const sized = layoutSinglelineText("A A", { ...options, fontSize: undefined });
  expect(sized.line.width).toBeLessThan(100);
  expect(font.widthOfTextAtSize("A A", sized.fontSize + 1, spacing)).toBeGreaterThanOrEqual(100);
  const comb = layoutCombedText("A ", { ...options, cellCount: 2 });

  for (const cell of comb.cells) {
    expect((cell.encoded.advance * 12) / 1000).toBeCloseTo(cell.width);
  }
});

it("keeps custom font clusters intact while adding spacing", async () => {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fs.readFileSync("./assets/fonts/ubuntu/Ubuntu-R.ttf"));
  const text = "ffi a\u0301 ";
  const raw = font.encodeText(text);

  const { line } = layoutSinglelineText(text, {
    font,
    fontSize: 12,
    alignment: TextAlignment.Left,
    bounds: { x: 0, y: 0, width: 200, height: 100 },
    spacing: { characterSpacing: 2, wordSpacing: 3 },
  });

  expect(line.encoded).toEqual(raw.withSpacing(2, 3, 12));
  expect(line.width).toBeCloseTo((line.encoded.advance * 12) / 1000);
});

it("reads last DA spacing operators, preserves them and leaves unspaced fields alone", async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const field = doc.getForm().createTextField("spacing");
  field.setText("A A");
  field.addToPage(doc.addPage(), { width: 150, height: 40 });
  const widget = field.acroField.getWidgets()[0]!;

  const appearance = (da: string) => {
    field.acroField.setDefaultAppearance(da);

    return defaultTextFieldAppearanceProvider(field, widget, font)
      .map((op) => op.toString())
      .join("\n");
  };

  const plain = appearance("/Helv 12 Tf 0 g");
  expect(appearance("/Helv 12 Tf 0 g % 7 Tc\n (9 Tw) ignored")).toBe(plain);
  const spaced = appearance("/Helv 12 Tf 0 g 8 Tc -1.5 Tc +4 Tw");
  expect(spaced).not.toBe(plain);
  expect(spaced).toContain("TJ");
  expect(spaced).not.toMatch(/\sT[cw]\b/);
  expect(field.acroField.getDefaultAppearance()).toContain("-1.5 Tc");
  expect(field.acroField.getDefaultAppearance()).toContain("4 Tw");
  expect(
    defaultTextFieldAppearanceProvider(field, widget, font)
      .map((op) => op.toString())
      .join("\n"),
  ).toBe(spaced);
});

it.each(["single", "multiline", "comb"])(
  "uses widget DA overrides in %s fields without emitting Tc/Tw",
  async (mode) => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const field = doc.getForm().createTextField("widget");
    field.setText("A A");

    if (mode === "multiline") field.enableMultiline();

    if (mode === "comb") {
      field.setMaxLength(3);
      field.enableCombing();
    }

    field.addToPage(doc.addPage(), { width: 150, height: 40 });
    field.acroField.setDefaultAppearance("/Helv 12 Tf 0 g 2 Tc 5 Tw");
    const widget = field.acroField.getWidgets()[0]!;
    widget.setDefaultAppearance("/Helv 12 Tf 0 g -3 Tw");
    const encode = vi.spyOn(font, "encodeText");

    const appearance = defaultTextFieldAppearanceProvider(field, widget, font)
      .map((op) => op.toString())
      .join("\n");

    expect(appearance).toContain("TJ");
    expect(appearance).not.toMatch(/\sT[cw]\b/);
    // The field's Tc remains effective when the widget overrides only Tw.
    expect(field.acroField.getDefaultAppearance()).toContain("2 Tc");
    expect(widget.getDefaultAppearance()).toContain("-3 Tw");
    expect(encode).toHaveBeenCalled();
  },
);
