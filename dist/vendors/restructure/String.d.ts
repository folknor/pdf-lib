/**
 * Restructure - String type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import { NumberT } from './Number.js';
type EncodingResolver = (parent: unknown) => string;
type LengthType = number | string | NumberT | ((parent: unknown) => number);
export declare class StringT extends Base<string> {
    length: LengthType | undefined;
    encoding: string | EncodingResolver;
    constructor(length?: LengthType, encoding?: string | EncodingResolver);
    decode(stream: DecodeStream, parent?: Record<string, unknown>): string;
    size(val?: string | null, parent?: {
        val?: Record<string, unknown>;
    }): number;
    encode(stream: EncodeStream, val: string, parent?: {
        val?: Record<string, unknown>;
    }): void;
}
export { StringT as String };
//# sourceMappingURL=String.d.ts.map