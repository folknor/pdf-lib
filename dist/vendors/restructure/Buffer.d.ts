/**
 * Restructure - Buffer type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import { NumberT } from './Number.js';
type LengthType = number | string | NumberT | ((parent: unknown) => number);
export declare class BufferT extends Base<Uint8Array> {
    length: LengthType | undefined;
    constructor(length?: LengthType);
    decode(stream: DecodeStream, parent?: Record<string, unknown>): Uint8Array;
    size(val?: Uint8Array | null, parent?: Record<string, unknown>): number;
    encode(stream: EncodeStream, buf: Uint8Array): void;
}
export { BufferT as Buffer };
//# sourceMappingURL=Buffer.d.ts.map