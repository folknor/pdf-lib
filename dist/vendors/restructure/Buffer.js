/**
 * Restructure - Buffer type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
import { NumberT } from './Number.js';
import * as utils from './utils.js';
export class BufferT extends Base {
    length;
    constructor(length) {
        super();
        this.length = length;
    }
    decode(stream, parent) {
        const length = utils.resolveLength(this.length, stream, parent ?? null);
        return stream.readBuffer(length);
    }
    size(val, parent) {
        if (!val) {
            return utils.resolveLength(this.length, null, parent ?? null);
        }
        let len = val.length;
        if (this.length instanceof NumberT) {
            len += this.length.size();
        }
        return len;
    }
    encode(stream, buf) {
        if (this.length instanceof NumberT) {
            this.length.encode(stream, buf.length);
        }
        stream.writeBuffer(buf);
    }
}
export { BufferT as Buffer };
//# sourceMappingURL=Buffer.js.map