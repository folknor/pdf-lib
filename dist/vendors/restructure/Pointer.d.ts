/**
 * Restructure - Pointer type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import type { NumberT } from './Number.js';
type PointerType = 'local' | 'immediate' | 'parent' | 'global';
interface PointerOptions {
    type?: PointerType;
    allowNull?: boolean;
    nullValue?: number;
    lazy?: boolean;
    relativeTo?: (ctx: unknown) => number;
}
interface DecodeContext {
    _startOffset: number;
    parent?: DecodeContext;
    [key: string]: unknown;
}
interface EncodeContext {
    startOffset: number;
    parent?: EncodeContext;
    val: Record<string, unknown>;
    pointers: Array<{
        type: Base;
        val: unknown;
        parent: EncodeContext;
    }>;
    pointerOffset: number;
    pointerSize?: number;
}
export declare class Pointer<T = unknown> extends Base<T | null> {
    offsetType: NumberT;
    type: Base<T> | null;
    options: Omit<Required<PointerOptions>, 'relativeTo'> & {
        relativeTo?: (ctx: unknown) => number;
    };
    relativeToGetter?: (ctx: unknown) => number;
    constructor(offsetType: NumberT, type: Base<T> | 'void' | null, options?: PointerOptions);
    decode(stream: DecodeStream, ctx?: DecodeContext): T | null;
    size(val?: T | VoidPointer<T> | null | undefined, ctx?: unknown): number;
    encode(stream: EncodeStream, val: T | VoidPointer<T> | null, ctx: EncodeContext): void;
}
export declare class VoidPointer<T = unknown> {
    type: Base<T>;
    value: T;
    constructor(type: Base<T>, value: T);
}
export {};
//# sourceMappingURL=Pointer.d.ts.map