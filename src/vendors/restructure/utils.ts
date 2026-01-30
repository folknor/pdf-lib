/**
 * Restructure - Utilities
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */

import type { DecodeStream } from './DecodeStream.js';
import type { RType } from './types.js';

export { PropertyDescriptor } from './types.js';

export type LengthType =
  | number
  | string
  | ((parent: unknown) => number)
  | RType<number>
  | undefined;

export function resolveLength(
  length: LengthType,
  stream: DecodeStream | null,
  parent: Record<string, unknown> | null | undefined,
): number {
  let res: number;

  if (typeof length === 'number') {
    res = length;
  } else if (typeof length === 'function') {
    res = length.call(parent, parent);
  } else if (parent && typeof length === 'string') {
    res = parent[length] as number;
  } else if (
    stream &&
    length &&
    typeof (length as RType<number>).decode === 'function'
  ) {
    res = (length as RType<number>).decode(stream);
  } else {
    res = NaN;
  }

  if (Number.isNaN(res)) {
    throw new Error('Not a fixed size');
  }

  return res;
}
