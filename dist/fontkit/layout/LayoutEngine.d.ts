import AATLayoutEngine from '../aat/AATLayoutEngine.js';
import type Glyph from '../glyph/Glyph.js';
import OTLayoutEngine from '../opentype/OTLayoutEngine.js';
import GlyphPosition from './GlyphPosition.js';
import GlyphRun from './GlyphRun.js';
import KernProcessor from './KernProcessor.js';
import UnicodeLayoutEngine from './UnicodeLayoutEngine.js';
export default class LayoutEngine {
    font: any;
    unicodeLayoutEngine: UnicodeLayoutEngine | null;
    kernProcessor: KernProcessor | null;
    engine?: AATLayoutEngine | OTLayoutEngine;
    constructor(font: any);
    layout(string: string | Glyph[], features?: string[] | Record<string, boolean> | string, script?: string | string[] | null, language?: string | null, direction?: string | null): GlyphRun;
    substitute(glyphRun: GlyphRun): void;
    position(glyphRun: GlyphRun): void;
    hideDefaultIgnorables(glyphs: Glyph[], positions: GlyphPosition[]): void;
    isDefaultIgnorable(ch: number): boolean;
    getAvailableFeatures(script: string, language?: string): string[];
    stringsForGlyph(gid: number): string[];
}
//# sourceMappingURL=LayoutEngine.d.ts.map