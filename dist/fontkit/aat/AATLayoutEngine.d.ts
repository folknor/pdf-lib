import type GlyphRun from '../layout/GlyphRun.js';
import AATMorxProcessor from './AATMorxProcessor.js';
export default class AATLayoutEngine {
    font: any;
    morxProcessor: AATMorxProcessor;
    fallbackPosition: boolean;
    constructor(font: any);
    substitute(glyphRun: GlyphRun): void;
    getAvailableFeatures(_script: string, _language?: string): string[];
    stringsForGlyph(gid: number): Set<string>;
    _addStrings(glyphs: number[], index: number, strings: Set<string>, string: string): void;
}
//# sourceMappingURL=AATLayoutEngine.d.ts.map