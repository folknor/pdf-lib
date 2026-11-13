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
const INITIAL_STATE = 1;
const FAIL_STATE = 0;
/**
 * A StateMachine represents a deterministic finite automaton.
 * It can perform matches over a sequence of values, similar to a regular expression.
 */
export default class StateMachine {
    stateTable;
    accepting;
    tags;
    constructor(dfa) {
        this.stateTable = dfa.stateTable;
        this.accepting = dfa.accepting;
        this.tags = dfa.tags;
    }
    /**
     * Returns an iterable object that yields pattern matches over the input sequence.
     * Matches are of the form [startIndex, endIndex, tags].
     */
    match(str) {
        const self = this;
        return {
            *[Symbol.iterator]() {
                let state = INITIAL_STATE;
                let startRun = null;
                let lastAccepting = null;
                let lastState = null;
                for (let p = 0; p < str.length; p++) {
                    const c = str[p];
                    lastState = state;
                    state = self.stateTable[state][c];
                    if (state === FAIL_STATE) {
                        // yield the last match if any
                        if (startRun != null &&
                            lastAccepting != null &&
                            lastAccepting >= startRun) {
                            yield [startRun, lastAccepting, self.tags[lastState]];
                        }
                        // reset the state as if we started over from the initial state
                        state = self.stateTable[INITIAL_STATE][c];
                        startRun = null;
                    }
                    // start a run if not in the failure state
                    if (state !== FAIL_STATE && startRun == null) {
                        startRun = p;
                    }
                    // if accepting, mark the potential match end
                    if (self.accepting[state]) {
                        lastAccepting = p;
                    }
                    // reset the state to the initial state if we get into the failure state
                    if (state === FAIL_STATE) {
                        state = INITIAL_STATE;
                    }
                }
                // yield the last match if any
                if (startRun != null &&
                    lastAccepting != null &&
                    lastAccepting >= startRun) {
                    yield [startRun, lastAccepting, self.tags[state]];
                }
            },
        };
    }
    /**
     * For each match over the input sequence, action functions matching
     * the tag definitions in the input pattern are called with the startIndex,
     * endIndex, and sub-match sequence.
     */
    apply(str, actions) {
        for (const [start, end, tags] of this.match(str)) {
            for (const tag of tags) {
                const action = actions[tag];
                if (typeof action === 'function') {
                    action(start, end, str.slice(start, end + 1));
                }
            }
        }
    }
}
//# sourceMappingURL=index.js.map