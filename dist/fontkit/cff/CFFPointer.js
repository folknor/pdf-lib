// @ts-nocheck
import * as r from '../../vendors/restructure/index.js';
export default class CFFPointer extends r.Pointer {
    constructor(type, options = {}) {
        if (options.type == null) {
            options.type = 'global';
        }
        super(null, type, options);
    }
    decode(stream, parent, operands) {
        this.offsetType = {
            decode: () => operands[0],
        };
        return super.decode(stream, parent, operands);
    }
    encode(stream, value, ctx) {
        if (!stream) {
            // compute the size (so ctx.pointerSize is correct)
            this.offsetType = {
                size: () => 0,
            };
            this.size(value, ctx);
            return [new Ptr(0)];
        }
        let ptr = null;
        this.offsetType = {
            encode: (_stream, val) => (ptr = val),
        };
        super.encode(stream, value, ctx);
        return [new Ptr(ptr)];
    }
}
class Ptr {
    val;
    forceLarge;
    constructor(val) {
        this.val = val;
        this.forceLarge = true;
    }
    valueOf() {
        return this.val;
    }
}
//# sourceMappingURL=CFFPointer.js.map