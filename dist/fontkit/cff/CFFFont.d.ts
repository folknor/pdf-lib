declare class CFFFont {
    stream: any;
    version: number;
    topDictIndex: any[];
    topDict: Record<string, any>;
    nameIndex: string[];
    stringIndex: string[];
    isCIDFont: boolean;
    globalSubrIndex: any[];
    constructor(stream: any);
    static decode(stream: any): CFFFont;
    decode(): this;
    string(sid: number): string | null;
    get postscriptName(): string | null;
    get fullName(): string | null;
    get familyName(): string | null;
    getCharString(glyph: number): Uint8Array;
    getGlyphName(gid: number): string | null;
    fdForGlyph(gid: number): number | null;
    privateDictForGlyph(gid: number): Record<string, any> | null;
}
export default CFFFont;
//# sourceMappingURL=CFFFont.d.ts.map