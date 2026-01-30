/**
 * Restructure - LazyArray type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { ArrayT } from './Array.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
declare class LazyArrayValue<T> {
    type: {
        size: (val: T | null, ctx: unknown) => number;
        decode: (stream: DecodeStream, ctx: unknown) => T;
    };
    length: number;
    stream: DecodeStream;
    ctx: unknown;
    base: number;
    items: (T | undefined)[];
    constructor(type: {
        size: (val: T | null, ctx: unknown) => number;
        decode: (stream: DecodeStream, ctx: unknown) => T;
    }, length: number, stream: DecodeStream, ctx: unknown);
    get(index: number): T | undefined;
    toArray(): T[];
}
export declare class LazyArray<T = unknown> extends ArrayT<T> {
    decode(stream: DecodeStream, parent?: unknown): T[];
    size(val?: T[] | LazyArrayValue<T> | null, ctx?: {
        parent?: unknown;
        pointerSize: number;
    }): number;
    encode(stream: EncodeStream, val: T[] | LazyArrayValue<T>, ctx?: unknown): void;
}
export {};
//# sourceMappingURL=LazyArray.d.ts.map