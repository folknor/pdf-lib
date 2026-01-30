/**
 * Restructure - Bitfield type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
export class Bitfield extends Base {
    type;
    flags;
    constructor(type, flags = []) {
        super();
        this.type = type;
        this.flags = flags;
    }
    decode(stream) {
        const val = this.type.decode(stream);
        const res = {};
        for (let i = 0; i < this.flags.length; i++) {
            const flag = this.flags[i];
            if (flag != null) {
                res[flag] = Boolean(val & (1 << i));
            }
        }
        return res;
    }
    size() {
        return this.type.size();
    }
    encode(stream, keys) {
        let val = 0;
        for (let i = 0; i < this.flags.length; i++) {
            const flag = this.flags[i];
            if (flag != null) {
                if (keys[flag]) {
                    val |= 1 << i;
                }
            }
        }
        this.type.encode(stream, val);
    }
}
//# sourceMappingURL=Bitfield.js.map