import { unzlibSync } from "fflate";
import * as Script from "../../src/fontkit/layout/Script.js";
import { decodeBase64 } from "../../src/fontkit/utils.js";
import {
  getCategory,
  getCombiningClass,
  getEastAsianWidth,
  getNumericValue,
  getScript,
  isMark,
} from "../../src/vendors/unicode-properties/index.js";
import trieB64 from "../../src/vendors/unicode-properties/trie.json" with { type: "json" };
import { UnicodeTrie } from "../../src/vendors/unicode-properties/UnicodeTrie.js";
// Written by scripts/reencode-unicode-properties-trie.mjs from the original
// unicode-trie 0.3 blob, after checking every assigned code point against the
// Unicode 8 UCD.
import fixture from "./unicodeProperties.fixture.json" with { type: "json" };

describe("vendored unicode-properties", () => {
  it("matches the original unicode-trie lookups", () => {
    const trie = new UnicodeTrie(unzlibSync(decodeBase64(trieB64 as string)));
    expect(fixture.values).toHaveLength(fixture.codePoints.length);
    expect(fixture.codePoints.map((cp) => trie.get(cp))).toEqual(fixture.values);
  });

  // The blob copied in by the TypeScript migration was read with the wrong
  // header and layout, so BMP code points all came back as Cc, Common,
  // Not_Reordered, and supplementary ones as one fixed garbage value.
  it("answers real properties", () => {
    expect(getCategory(0x41)).toBe("Lu");
    expect(getCategory(0x5d0)).toBe("Lo");
    expect(getCategory(0x1f600)).toBe("So");
    expect(getScript(0x5d0)).toBe("Hebrew");
    expect(getScript(0x627)).toBe("Arabic");
    expect(getScript(0x41)).toBe("Latin");
    expect(getScript(0x301)).toBe("Inherited");
    expect(getCombiningClass(0x5b0)).toBe("CCC10"); // HEBREW POINT SHEVA
    expect(getCombiningClass(0x5bd)).toBe("CCC22"); // HEBREW POINT METEG
    expect(getCombiningClass(0x301)).toBe("Above");
    expect(getCombiningClass(0x41)).toBe("Not_Reordered");
    expect(getEastAsianWidth(0x4e00)).toBe("W");
    expect(getEastAsianWidth(0x41)).toBe("Na");
    expect(getNumericValue(0x661)).toBe(1);
    expect(isMark(0x5b7)).toBe(true);
    expect(isMark(0x5d0)).toBe(false);
  });

  it("lets layout detect right-to-left scripts", () => {
    expect(Script.forString("שלום")).toBe("hebr");
    expect(Script.forString("سلام")).toBe("arab");
    expect(Script.direction(Script.forString("שלום"))).toBe("rtl");
    expect(Script.forString("hello")).toBe("latn");
  });
});
