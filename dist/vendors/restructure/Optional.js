/**
 * Restructure - Optional type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
export class Optional extends Base {
    type;
    condition;
    constructor(type, condition = true) {
        super();
        this.type = type;
        this.condition = condition;
    }
    decode(stream, parent) {
        let condition = this.condition;
        if (typeof condition === 'function') {
            condition = condition.call(parent, parent);
        }
        if (condition) {
            return this.type.decode(stream, parent);
        }
        return;
    }
    size(val, parent) {
        let condition = this.condition;
        if (typeof condition === 'function') {
            condition = condition.call(parent, parent);
        }
        if (condition) {
            return this.type.size(val, parent);
        }
        else {
            return 0;
        }
    }
    encode(stream, val, parent) {
        let condition = this.condition;
        if (typeof condition === 'function') {
            condition = condition.call(parent, parent);
        }
        if (condition && val !== undefined) {
            this.type.encode(stream, val, parent);
        }
    }
}
//# sourceMappingURL=Optional.js.map