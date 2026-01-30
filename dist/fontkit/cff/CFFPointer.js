import * as r from '../../vendors/restructure/index.js';
// CFFPointer uses a custom approach where offsetType is dynamically replaced
// with partial implementations. We cast to any to allow this flexibility.
export default class CFFPointer extends r.Pointer {
    constructor(type, options = {}) {
        if (options['type'] == null) {
            options['type'] = 'global';
        }
        // Pass a dummy NumberT - it will be replaced dynamically
        super(r.uint8, type, options);
    }
    decode(stream, parent, operands) {
        // Replace offsetType with a minimal implementation that returns the operand
        this.offsetType = {
            decode: () => operands?.[0] ?? 0,
        };
        return super.decode(stream, parent);
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