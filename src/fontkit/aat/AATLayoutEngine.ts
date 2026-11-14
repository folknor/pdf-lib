import type GlyphRun from "../layout/GlyphRun.js";
import * as AATFeatureMap from "./AATFeatureMap.js";
import AATMorxProcessor, { type MorxGlyph } from "./AATMorxProcessor.js";

export default class AATLayoutEngine {
  font: any;
  morxProcessor: AATMorxProcessor;
  fallbackPosition: boolean;

  constructor(font: any) {
    this.font = font;
    this.morxProcessor = new AATMorxProcessor(font);
    this.fallbackPosition = false;
  }

  substitute(glyphRun: GlyphRun): void {
    // AAT expects the glyphs to be in visual order prior to morx processing,
    // so reverse the glyphs if the script is right-to-left.
    // Occurrences move as records, so code points stay with their glyphs.
    const records: MorxGlyph[] = glyphRun.glyphs.map((glyph, i) => ({
      id: glyph.id,
      codePoints: [...glyphRun.codePoints[i]!],
      text: [...glyphRun.text[i]!],
      cluster: glyphRun.clusters[i]!,
      components: glyphRun.components[i]!,
    }));

    if (glyphRun.direction === "rtl") {
      records.reverse();
    }

    const out = this.morxProcessor.process(records, AATFeatureMap.mapOTToAAT(glyphRun.features));

    glyphRun.glyphs = out.map((record) => this.font.getGlyph(record.id));
    glyphRun.codePoints = out.map((record) => record.codePoints);
    glyphRun.text = out.map((record) => record.text);
    glyphRun.clusters = out.map((record) => record.cluster);
    glyphRun.components = out.map((record) => record.components);
  }

  /** morx output stays in the order it was processed in: visual for RTL. */
  reversesBeforeSubstitution(glyphRun: GlyphRun): boolean {
    return glyphRun.direction === "rtl";
  }

  getAvailableFeatures(_script: string, _language?: string): string[] {
    return AATFeatureMap.mapAATToOT(this.morxProcessor.getSupportedFeatures());
  }

  stringsForGlyph(gid: number): Set<string> {
    const glyphStrings = this.morxProcessor.generateInputs(gid);
    const result = new Set<string>();

    for (const glyphs of glyphStrings) {
      this._addStrings(glyphs, 0, result, "");
    }

    return result;
  }

  _addStrings(glyphs: number[], index: number, strings: Set<string>, string: string): void {
    const codePoints = this.font._cmapProcessor.codePointsForGlyph(glyphs[index]);

    for (const codePoint of codePoints) {
      const s = string + String.fromCodePoint(codePoint);

      if (index < glyphs.length - 1) {
        this._addStrings(glyphs, index + 1, strings, s);
      } else {
        strings.add(s);
      }
    }
  }
}
