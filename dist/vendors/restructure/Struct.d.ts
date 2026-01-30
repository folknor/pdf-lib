/**
 * Restructure - Struct type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
export type FieldDefinition = Base | ((res: Record<string, unknown>) => unknown);
export type Fields = Record<string, FieldDefinition>;
interface StructContext {
    parent?: unknown;
    _startOffset: number;
    _currentOffset: number;
    _length: number;
    [key: string]: unknown;
}
export declare class Struct extends Base<Record<string, unknown>> {
    fields: Fields;
    process?: (this: Record<string, unknown>, stream: DecodeStream) => void;
    preEncode?: (this: Record<string, unknown>, stream?: EncodeStream) => void;
    constructor(fields?: Fields);
    decode(stream: DecodeStream, parent?: unknown, length?: number): Record<string, unknown>;
    _setup(stream: DecodeStream, parent: unknown, length: number): StructContext;
    _parseFields(stream: DecodeStream, res: StructContext, fields: Fields): void;
    size(val?: Record<string, unknown> | null, parent?: unknown, includePointers?: boolean): number;
    encode(stream: EncodeStream, val: Record<string, unknown>, parent?: unknown): void;
}
export {};
//# sourceMappingURL=Struct.d.ts.map