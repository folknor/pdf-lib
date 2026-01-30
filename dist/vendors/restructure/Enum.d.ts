/**
 * Restructure - Enum type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import type { NumberT } from './Number.js';
export declare class Enum<T extends string = string> extends Base<T | number> {
    type: NumberT;
    options: T[];
    constructor(type: NumberT, options?: T[]);
    decode(stream: DecodeStream): T | number;
    size(): number;
    encode(stream: EncodeStream, val: T | number): void;
}
//# sourceMappingURL=Enum.d.ts.map