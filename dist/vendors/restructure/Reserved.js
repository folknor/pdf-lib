/**
 * Restructure - Reserved type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
import * as utils from './utils.js';
export class Reserved extends Base {
    type;
    count;
    constructor(type, count = 1) {
        super();
        this.type = type;
        this.count = count;
    }
    decode(stream, parent) {
        stream.pos += this.size(null, parent);
        return undefined;
    }
    size(_data, parent) {
        const count = utils.resolveLength(this.count, null, parent);
        return this.type.size() * count;
    }
    encode(stream, _val, parent) {
        stream.fill(0, this.size(null, parent));
    }
}
//# sourceMappingURL=Reserved.js.map