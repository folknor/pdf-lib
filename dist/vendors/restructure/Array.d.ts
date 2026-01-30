/**
 * Restructure - Array type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import { NumberT } from './Number.js';
type LengthType = number | string | NumberT | ((parent: unknown) => number);
export declare class ArrayT<T = unknown> extends Base<T[]> {
    type: Base<T>;
    length: LengthType | undefined;
    lengthType: 'count' | 'bytes';
    constructor(type: Base<T>, length?: LengthType, lengthType?: 'count' | 'bytes');
    decode(stream: DecodeStream, parent?: unknown): T[];
    size(array?: T[] | null, ctx?: {
        parent?: unknown;
        pointerSize: number;
    }, includePointers?: boolean): number;
    encode(stream: EncodeStream, array: T[], parent?: unknown): void;
}
export { ArrayT as Array };
//# sourceMappingURL=Array.d.ts.map