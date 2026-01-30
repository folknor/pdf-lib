/**
 * Restructure - Base class
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { DecodeStream } from './DecodeStream.js';
import { EncodeStream } from './EncodeStream.js';
export class Base {
    fromBuffer(buffer) {
        const stream = new DecodeStream(buffer);
        return this.decode(stream);
    }
    toBuffer(value) {
        const size = this.size(value);
        const buffer = new Uint8Array(size);
        const stream = new EncodeStream(buffer);
        this.encode(stream, value);
        return buffer;
    }
}
//# sourceMappingURL=Base.js.map