export default class CmapProcessor {
    encoding: Map<number, number> | null;
    cmap: any;
    uvs: any;
    private _characterSet?;
    private _codePointsCache?;
    constructor(cmapTable: any);
    findSubtable(cmapTable: any, pairs: [number, number][]): any;
    lookup(codepoint: number, variationSelector?: number): number;
    getVariationSelector(codepoint: number, variationSelector: number): number;
    getCharacterSet(): number[];
    codePointsForGlyph(gid: number): number[];
}
//# sourceMappingURL=CmapProcessor.d.ts.map