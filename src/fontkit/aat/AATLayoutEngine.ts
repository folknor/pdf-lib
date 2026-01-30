import type GlyphRun from '../layout/GlyphRun.js';
import * as AATFeatureMap from './AATFeatureMap.js';
import AATMorxProcessor from './AATMorxProcessor.js';

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
    if (glyphRun.direction === 'rtl') {
      glyphRun.glyphs.reverse();
    }

    this.morxProcessor.process(
      glyphRun.glyphs,
      AATFeatureMap.mapOTToAAT(glyphRun.features),
    );
  }

  getAvailableFeatures(_script: string, _language?: string): string[] {
    return AATFeatureMap.mapAATToOT(this.morxProcessor.getSupportedFeatures());
  }

  stringsForGlyph(gid: number): Set<string> {
    const glyphStrings = this.morxProcessor.generateInputs(gid);
    const result = new Set<string>();

    for (const glyphs of glyphStrings) {
      this._addStrings(glyphs, 0, result, '');
    }

    return result;
  }

  _addStrings(
    glyphs: number[],
    index: number,
    strings: Set<string>,
    string: string,
  ): void {
    const codePoints = this.font._cmapProcessor.codePointsForGlyph(
      glyphs[index],
    );

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
