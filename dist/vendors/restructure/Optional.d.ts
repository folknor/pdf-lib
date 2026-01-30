/**
 * Restructure - Optional type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
type ConditionType = boolean | ((this: unknown, parent: unknown) => boolean);
export declare class Optional<T = unknown> extends Base<T | undefined> {
    type: Base<T>;
    condition: ConditionType;
    constructor(type: Base<T>, condition?: ConditionType);
    decode(stream: DecodeStream, parent?: unknown): T | undefined;
    size(val?: T | null, parent?: unknown): number;
    encode(stream: EncodeStream, val: T | undefined, parent?: unknown): void;
}
export {};
//# sourceMappingURL=Optional.d.ts.map