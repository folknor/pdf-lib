import type GlyphInfo from './GlyphInfo.js';
interface GlyphIteratorOptions {
    flags?: {
        ignoreMarks?: boolean;
        ignoreBaseGlyphs?: boolean;
        ignoreLigatures?: boolean;
    };
    markAttachmentType?: number;
}
export default class GlyphIterator {
    glyphs: GlyphInfo[];
    options: GlyphIteratorOptions;
    flags: NonNullable<GlyphIteratorOptions['flags']>;
    markAttachmentType: number;
    index: number;
    constructor(glyphs: GlyphInfo[], options?: GlyphIteratorOptions);
    reset(options?: GlyphIteratorOptions, index?: number): void;
    get cur(): GlyphInfo | null;
    shouldIgnore(glyph: GlyphInfo): boolean;
    move(dir: number): GlyphInfo | null;
    next(): GlyphInfo | null;
    prev(): GlyphInfo | null;
    peek(count?: number): GlyphInfo | null;
    peekIndex(count?: number): number;
    increment(count?: number): GlyphInfo | null;
}
export {};
//# sourceMappingURL=GlyphIterator.d.ts.map