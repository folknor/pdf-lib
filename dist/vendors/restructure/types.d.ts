/**
 * Restructure - Shared types
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
export interface RType<T = unknown> {
    decode(stream: DecodeStream, parent?: unknown): T;
    encode?(stream: EncodeStream, value: T, parent?: unknown): void;
    size(value?: T | null, parent?: unknown): number;
}
export interface DecodeContext {
    parent?: DecodeContext;
    _startOffset: number;
    _currentOffset: number;
    _length: number;
    [key: string]: unknown;
}
export interface EncodeContext {
    parent?: EncodeContext;
    val: Record<string, unknown>;
    pointers: Array<{
        type: RType;
        val: unknown;
        parent: EncodeContext;
    }>;
    startOffset: number;
    pointerOffset: number;
    pointerSize: number;
}
export interface SizeContext {
    parent?: SizeContext;
    val?: Record<string, unknown>;
    pointerSize: number;
}
export declare class PropertyDescriptor implements PropertyDescriptor {
    enumerable: boolean;
    configurable: boolean;
    get?: () => unknown;
    value?: unknown;
    constructor(opts?: Partial<PropertyDescriptor>);
}
//# sourceMappingURL=types.d.ts.map