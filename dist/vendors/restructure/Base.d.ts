/**
 * Restructure - Base class
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { DecodeStream } from './DecodeStream.js';
import { EncodeStream } from './EncodeStream.js';
export declare abstract class Base<T = unknown> {
    abstract decode(stream: DecodeStream, parent?: unknown): T;
    abstract encode(stream: EncodeStream, value: T, parent?: unknown): void;
    abstract size(value?: T | null | undefined, parent?: unknown): number;
    fromBuffer(buffer: Uint8Array): T;
    toBuffer(value: T): Uint8Array;
}
//# sourceMappingURL=Base.d.ts.map