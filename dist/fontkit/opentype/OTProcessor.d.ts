import type GlyphPosition from '../layout/GlyphPosition.js';
import type GlyphInfo from './GlyphInfo.js';
import GlyphIterator from './GlyphIterator.js';
export default class OTProcessor {
    font: any;
    table: any;
    script: any;
    scriptTag: string | null;
    language: any;
    languageTag: string | null;
    features: Record<string, any>;
    lookups: Record<string, any>;
    variationsIndex: number;
    direction: string;
    glyphs: GlyphInfo[];
    positions: GlyphPosition[];
    ligatureID: number;
    currentFeature: string | null;
    glyphIterator: GlyphIterator;
    constructor(font: any, table: any);
    findScript(script: string | string[]): any;
    selectScript(script?: string | string[], language?: string | null, direction?: string | null): string | null;
    lookupsForFeatures(userFeatures?: string[], exclude?: number[]): Array<{
        feature: string;
        index: number;
        lookup: any;
    }>;
    substituteFeatureForVariations(featureIndex: number): any;
    findVariationsIndex(coords: number[]): number;
    variationConditionsMatch(conditions: any[], coords: number[]): boolean;
    applyFeatures(userFeatures: string[], glyphs: GlyphInfo[], advances?: GlyphPosition[]): void;
    applyLookups(lookups: Array<{
        feature: string;
        index: number;
        lookup: any;
    }>, glyphs: GlyphInfo[], positions?: GlyphPosition[]): void;
    applyLookup(_lookup: number, _table: any): boolean;
    applyLookupList(lookupRecords: any[]): boolean;
    coverageIndex(coverage: any, glyph?: number): number;
    match(sequenceIndex: number, sequence: any[], fn: (item: any, glyph: GlyphInfo) => boolean, matched?: number[]): boolean | number[];
    sequenceMatches(sequenceIndex: number, sequence: number[]): boolean | number[];
    sequenceMatchIndices(sequenceIndex: number, sequence: number[]): boolean | number[];
    coverageSequenceMatches(sequenceIndex: number, sequence: any[]): boolean | number[];
    getClassID(glyph: number, classDef: any): number;
    classSequenceMatches(sequenceIndex: number, sequence: number[], classDef: any): boolean | number[];
    applyContext(table: any): boolean;
    applyChainingContext(table: any): boolean;
}
//# sourceMappingURL=OTProcessor.d.ts.map