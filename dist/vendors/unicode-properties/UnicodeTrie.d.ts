/**
 * Unicode Trie - Fast lookup of Unicode character properties
 * Originally from https://github.com/foliojs/unicode-trie
 * Absorbed and converted to TypeScript for pdf-lib
 */
export declare class UnicodeTrie {
    data: Uint32Array;
    highStart: number;
    errorValue: number;
    constructor(input: Uint8Array);
    get(codePoint: number): number;
}
//# sourceMappingURL=UnicodeTrie.d.ts.map