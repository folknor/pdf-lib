import type StateMachine from "../../../vendors/dfa/index.js";

/**
 * A run of a syllable split: a match of the cluster state machine, or a gap
 * no match covers. `end` is exclusive; `tags` is null for a gap only (a
 * match may carry empty tags).
 */
export interface SyllableRun {
  start: number;
  end: number;
  tags: string[] | null;
}

/**
 * Splits a category sequence into syllables: every match the state machine
 * yields, exactly as it yields it, and one run per maximal stretch between
 * matches. The runs are contiguous and cover every index, so a shaper that
 * gives each run its own syllable leaves no glyph without one.
 */
export function* syllableRuns(machine: StateMachine, categories: number[]): Generator<SyllableRun> {
  let last = 0;

  for (const [start, end, tags] of machine.match(categories)) {
    if (start > last) yield { start: last, end: start, tags: null };
    yield { start, end: end + 1, tags };
    last = end + 1;
  }

  if (last < categories.length) {
    yield { start: last, end: categories.length, tags: null };
  }
}
