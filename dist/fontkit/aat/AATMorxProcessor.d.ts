import type Glyph from '../glyph/Glyph.js';
import AATStateMachine from './AATStateMachine.js';
interface StateEntry {
    flags: number;
    newState: number;
    markIndex?: number;
    currentIndex?: number;
    action?: number;
    markedInsertIndex?: number;
    currentInsertIndex?: number;
}
interface MorxFeatures {
    [featureType: number]: {
        [featureSetting: number]: boolean;
    };
}
export default class AATMorxProcessor {
    font: any;
    morx: any;
    inputCache: Record<number, number[][]> | null;
    subtable: any;
    glyphs: Glyph[];
    ligatureStack: number[];
    markedGlyph: number | null;
    firstGlyph: number | null;
    lastGlyph: number | null;
    markedIndex: number | null;
    private _stateMachineCache?;
    constructor(font: any);
    process(glyphs: Glyph[], features?: MorxFeatures): Glyph[];
    processSubtable(subtable: any, glyphs: Glyph[]): Glyph[] | void;
    getStateMachine(subtable: any): AATStateMachine;
    getProcessor(): (glyph: Glyph | null, entry: StateEntry, index: number) => void;
    processIndicRearragement(_glyph: Glyph | null, entry: StateEntry, index: number): void;
    processContextualSubstitution(glyph: Glyph | null, entry: StateEntry, index: number): void;
    processLigature(_glyph: Glyph | null, entry: StateEntry, index: number): void;
    processNoncontextualSubstitutions(subtable: any, glyphs: Glyph[], _index?: number): void;
    _insertGlyphs(glyphIndex: number, insertionActionIndex: number, count: number, isBefore: boolean): void;
    processGlyphInsertion(_glyph: Glyph | null, entry: StateEntry, index: number): void;
    getSupportedFeatures(): [number, number][];
    generateInputs(gid: number): number[][];
    generateInputCache(): void;
    generateInputsForSubtable(subtable: any): void;
}
export {};
//# sourceMappingURL=AATMorxProcessor.d.ts.map