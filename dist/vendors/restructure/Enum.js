/**
 * Restructure - Enum type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
export class Enum extends Base {
    type;
    options;
    constructor(type, options = []) {
        super();
        this.type = type;
        this.options = options;
    }
    decode(stream) {
        const index = this.type.decode(stream);
        return this.options[index] ?? index;
    }
    size() {
        return this.type.size();
    }
    encode(stream, val) {
        const index = this.options.indexOf(val);
        if (index === -1) {
            throw new Error(`Unknown option in enum: ${val}`);
        }
        this.type.encode(stream, index);
    }
}
//# sourceMappingURL=Enum.js.map