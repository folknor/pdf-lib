/**
 * Restructure - Boolean type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import type { NumberT } from './Number.js';
export declare class BooleanT extends Base<boolean> {
    type: NumberT;
    constructor(type: NumberT);
    decode(stream: DecodeStream, _parent?: unknown): boolean;
    size(_val?: boolean | null | undefined, _parent?: unknown): number;
    encode(stream: EncodeStream, val: boolean, _parent?: unknown): void;
}
export { BooleanT as Boolean };
//# sourceMappingURL=Boolean.d.ts.map