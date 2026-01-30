/**
 * Restructure - Reserved type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import type { NumberT } from './Number.js';
type CountType = number | string | ((parent: unknown) => number);
export declare class Reserved extends Base<undefined> {
    type: NumberT;
    count: CountType;
    constructor(type: NumberT, count?: CountType);
    decode(stream: DecodeStream, parent?: unknown): undefined;
    size(_data?: unknown, parent?: unknown): number;
    encode(stream: EncodeStream, _val: undefined, parent?: unknown): void;
}
export {};
//# sourceMappingURL=Reserved.d.ts.map