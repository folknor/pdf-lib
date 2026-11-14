import { syllableRuns } from "../../src/fontkit/opentype/shapers/syllables.js";
import StateMachine, { type CompiledDFA } from "../../src/vendors/dfa/index.js";

// Hand-compiled DFA for the pattern `x: a b+` over the alphabet a=0, b=1.
// State 0 = fail, 1 = initial, 2 = seen "a", 3 = seen "a b+" (accepting).
const dfa: CompiledDFA = {
  stateTable: [
    [0, 0],
    [2, 0],
    [0, 3],
    [0, 3],
  ],
  accepting: [false, false, false, true],
  tags: [[], [], [], ["x"]],
};

const A = 0;
const B = 1;

describe("vendored dfa StateMachine", () => {
  const sm = new StateMachine(dfa);

  it("yields longest matches and restarts after failure", () => {
    expect([...sm.match([A, B, B, A, B, A, A, B])]).toEqual([
      [0, 2, ["x"]],
      [3, 4, ["x"]],
      [6, 7, ["x"]],
    ]);
  });

  it("yields nothing when there is no match", () => {
    expect([...sm.match([])]).toEqual([]);
    expect([...sm.match([B, B])]).toEqual([]);
    expect([...sm.match([A])]).toEqual([]);
    expect([...sm.match([A, A, A])]).toEqual([]);
  });

  it("skips leading garbage and handles a trailing match", () => {
    expect([...sm.match([B, A, B])]).toEqual([[1, 2, ["x"]]]);
  });

  it("is re-iterable", () => {
    const m = sm.match([A, B]);
    expect([...m]).toEqual([[0, 1, ["x"]]]);
    expect([...m]).toEqual([[0, 1, ["x"]]]);
  });

  it("apply calls tagged actions with the matched slice", () => {
    const calls: [number, number, number[]][] = [];
    sm.apply([A, B, B, B, A, B], {
      x: (start, end, match) => calls.push([start, end, match]),
      y: () => {
        throw new Error("unexpected tag");
      },
    });
    expect(calls).toEqual([
      [0, 3, [A, B, B, B]],
      [4, 5, [A, B]],
    ]);
  });

  it("syllableRuns covers every index with matches and gaps", () => {
    expect([...syllableRuns(sm, [B, A, B, A, A, B, A])]).toEqual([
      { start: 0, end: 1, tags: null },
      { start: 1, end: 3, tags: ["x"] },
      { start: 3, end: 4, tags: null },
      { start: 4, end: 6, tags: ["x"] },
      { start: 6, end: 7, tags: null },
    ]);
    expect([...syllableRuns(sm, [])]).toEqual([]);
  });
});
