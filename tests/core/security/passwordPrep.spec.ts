import { describe, expect, it } from 'vitest';
import { r6PasswordCandidates } from '../../../src/core/security/passwordPrep.js';

const candidates = (password: string) =>
  r6PasswordCandidates(password).map((bytes) => new TextDecoder().decode(bytes));

describe('Unicode 3.2 SASLprep queries', () => {
  it('leaves 3.2-unassigned characters alone while normalizing their neighbours', () => {
    expect(candidates('\u1d2c\uff21')).toEqual(['\u1d2cA', '\u1d2c\uff21']);
  });

  it('checks bidi after normalization with Unicode 3.2 D.1/D.2', () => {
    expect(candidates('\u05d0\u00a0\u05d1')[0]).toBe('\u05d0 \u05d1');
    // Mapping would change these strings, but the resulting bidi is invalid.
    expect(candidates('\u05d0\u00a0A\u05d1')).toEqual(['\u05d0\u00a0A\u05d1']);
    expect(candidates('\u05d0\u00a0')).toEqual(['\u05d0\u00a0']);
  });

  it('orders marks, composes Hangul and canonical pairs, and preserves case', () => {
    expect(candidates('A\u0315\u0300')[0]).toBe('\u00c0\u0315');
    expect(candidates('\u1100\u1161\u11a8')[0]).toBe('\uac01');
    expect(candidates('USER')[0]).toBe('USER');
  });

  it('does not offer prohibited prepared output', () => {
    expect(candidates('\u00a0\u0007')).toEqual(['\u00a0\u0007']);
  });
});
