/**
 * Restructure - Bitfield type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import type { NumberT } from './Number.js';
export declare class Bitfield extends Base<Record<string, boolean>> {
    type: NumberT;
    flags: (string | null)[];
    constructor(type: NumberT, flags?: (string | null)[]);
    decode(stream: DecodeStream): Record<string, boolean>;
    size(): number;
    encode(stream: EncodeStream, keys: Record<string, boolean>): void;
}
//# sourceMappingURL=Bitfield.d.ts.map