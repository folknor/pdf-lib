/**
 * Runtime matcher from the `dfa` package (v1.2.0), converted to TypeScript.
 * https://github.com/devongovett/dfa
 *
 * MIT License
 *
 * Copyright (c) 2016 Devon Govett <devongovett@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Only the runtime matcher is vendored; state tables are precompiled.
 */
/** Precompiled DFA, as produced by dfa's compiler. */
export interface CompiledDFA {
    stateTable: number[][];
    accepting: boolean[];
    tags: string[][];
}
/** A match: [startIndex, endIndex (inclusive), tags]. */
export type DFAMatch = [number, number, string[]];
/**
 * A StateMachine represents a deterministic finite automaton.
 * It can perform matches over a sequence of values, similar to a regular expression.
 */
export default class StateMachine {
    stateTable: number[][];
    accepting: boolean[];
    tags: string[][];
    constructor(dfa: CompiledDFA);
    /**
     * Returns an iterable object that yields pattern matches over the input sequence.
     * Matches are of the form [startIndex, endIndex, tags].
     */
    match(str: ArrayLike<number>): Iterable<DFAMatch>;
    /**
     * For each match over the input sequence, action functions matching
     * the tag definitions in the input pattern are called with the startIndex,
     * endIndex, and sub-match sequence.
     */
    apply(str: number[], actions: Record<string, ((start: number, end: number, match: number[]) => void) | undefined>): void;
}
//# sourceMappingURL=index.d.ts.map