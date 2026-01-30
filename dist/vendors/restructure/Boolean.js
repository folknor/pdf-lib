/**
 * Restructure - Boolean type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
export class BooleanT extends Base {
    type;
    constructor(type) {
        super();
        this.type = type;
    }
    decode(stream, _parent) {
        return Boolean(this.type.decode(stream));
    }
    size(_val, _parent) {
        return this.type.size();
    }
    encode(stream, val, _parent) {
        this.type.encode(stream, Number(val));
    }
}
export { BooleanT as Boolean };
//# sourceMappingURL=Boolean.js.map