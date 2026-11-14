import fontkit, { type Font } from "src/fontkit.js";
import fs from "fs";

import { createCmap, type ToUnicodeEntry } from "../../../src/core/embedders/CMap";

const ubuntuFont = fs.readFileSync("./assets/fonts/ubuntu/Ubuntu-R.ttf");

const sourceHansJpFont = fs.readFileSync(
  "./assets/fonts/source_hans_jp/SourceHanSerifJP-Regular.otf",
);

const ubuntuFontCmap = fs.readFileSync("./tests/core/embedders/data/Ubuntu-R.ttf.cmap");

const sourceHansJpFontCmap = fs.readFileSync(
  "./tests/core/embedders/data/SourceHanSerifJP-Regular.otf.cmap",
);

// Each glyph the cmap reaches, with the lowest code point mapping to it.
const cmapEntries = (font: Font): ToUnicodeEntry[] => {
  const entries = new Map<number, number[]>();

  for (const codePoint of [...font.characterSet].sort((a, b) => a - b)) {
    const { id } = font.glyphForCodePoint(codePoint);

    if (!entries.has(id)) entries.set(id, [codePoint]);
  }

  return [...entries].sort(([a], [b]) => a - b);
};

describe("createCmap", () => {
  it("creates CMaps for embedded Ubuntu-R font files", () => {
    const font = fontkit.create(ubuntuFont);

    const cmap = createCmap(cmapEntries(font));

    expect(cmap).toEqual(String(ubuntuFontCmap));
  });

  it("creates CMaps for embedded SourceHanSerifJP-Regular font files", () => {
    const font = fontkit.create(sourceHansJpFont);

    const cmap = createCmap(cmapEntries(font));

    expect(cmap).toEqual(String(sourceHansJpFontCmap));
  });
});
