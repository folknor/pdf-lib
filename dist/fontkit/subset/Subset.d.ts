interface SubsetStream {
    on(event: string, handler: (data?: unknown) => void): SubsetStream;
}
export default class Subset {
    font: any;
    glyphs: number[];
    mapping: Record<number, number>;
    constructor(font: any);
    includeGlyph(glyph: number | {
        id: number;
    }): number;
    encode(): Uint8Array;
    encodeStream(): SubsetStream;
}
export {};
//# sourceMappingURL=Subset.d.ts.map