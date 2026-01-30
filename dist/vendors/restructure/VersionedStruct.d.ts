/**
 * Restructure - VersionedStruct type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import type { NumberT } from './Number.js';
import { type Fields, Struct } from './Struct.js';
type VersionType = NumberT | string;
type VersionFields = Record<string | number, Fields | VersionedStruct> & {
    header?: Fields;
};
export declare class VersionedStruct extends Struct {
    type: VersionType;
    versions: VersionFields;
    versionPath?: string[];
    constructor(type: VersionType, versions?: VersionFields);
    decode(stream: DecodeStream, parent?: unknown, length?: number): Record<string, unknown>;
    size(val?: Record<string, unknown> | null, parent?: unknown, includePointers?: boolean): number;
    encode(stream: EncodeStream, val: Record<string, unknown>, parent?: unknown): void;
}
export {};
//# sourceMappingURL=VersionedStruct.d.ts.map