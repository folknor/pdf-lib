import type Glyph from '../glyph/Glyph.js';
import AATLookupTable from './AATLookupTable.js';
interface StateEntry {
    flags: number;
    newState: number;
}
interface TraverseOptions {
    enter?: (glyph: number, entry: StateEntry) => void;
    exit?: (glyph: number, entry: StateEntry) => void;
}
export default class AATStateMachine {
    stateTable: any;
    lookupTable: AATLookupTable;
    constructor(stateTable: any);
    process(glyphs: Glyph[], reverse: boolean, processEntry: (glyph: Glyph | null, entry: StateEntry, index: number) => void): Glyph[];
    /**
     * Performs a depth-first traversal of the glyph strings
     * represented by the state machine.
     */
    traverse(opts: TraverseOptions, state?: number, visited?: Set<number>): void;
}
export {};
//# sourceMappingURL=AATStateMachine.d.ts.map