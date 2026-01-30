/**
 * Restructure - Utilities
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import type { DecodeStream } from './DecodeStream.js';
import type { RType } from './types.js';
export { PropertyDescriptor } from './types.js';
export type LengthType = number | string | ((parent: unknown) => number) | RType<number> | undefined;
export declare function resolveLength(length: LengthType, stream: DecodeStream | null, parent: Record<string, unknown> | null | undefined): number;
//# sourceMappingURL=utils.d.ts.map