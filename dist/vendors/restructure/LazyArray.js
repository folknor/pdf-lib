/**
 * Restructure - LazyArray type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { ArrayT } from './Array.js';
import { NumberT } from './Number.js';
import * as utils from './utils.js';
class LazyArrayValue {
    type;
    length;
    stream;
    ctx;
    base;
    items;
    constructor(type, length, stream, ctx) {
        this.type = type;
        this.length = length;
        this.stream = stream;
        this.ctx = ctx;
        this.base = this.stream.pos;
        this.items = [];
    }
    get(index) {
        if (index < 0 || index >= this.length) {
            return undefined;
        }
        if (this.items[index] == null) {
            const { pos } = this.stream;
            this.stream.pos = this.base + this.type.size(null, this.ctx) * index;
            this.items[index] = this.type.decode(this.stream, this.ctx);
            this.stream.pos = pos;
        }
        return this.items[index];
    }
    toArray() {
        const result = [];
        for (let i = 0; i < this.length; i++) {
            result.push(this.get(i));
        }
        return result;
    }
}
export class LazyArray extends ArrayT {
    decode(stream, parent) {
        const { pos } = stream;
        const length = utils.resolveLength(this.length, stream, parent);
        let ctx = parent;
        if (this.length instanceof NumberT) {
            ctx = {
                parent,
                _startOffset: pos,
                _currentOffset: 0,
                _length: length,
            };
        }
        const res = new LazyArrayValue(this.type, length, stream, ctx);
        stream.pos += length * this.type.size(null, ctx);
        // Return LazyArrayValue cast as T[] - consumers handle both types
        return res;
    }
    size(val, ctx) {
        if (val instanceof LazyArrayValue) {
            val = val.toArray();
        }
        return super.size(val, ctx);
    }
    encode(stream, val, ctx) {
        if (val instanceof LazyArrayValue) {
            val = val.toArray();
        }
        super.encode(stream, val, ctx);
    }
}
//# sourceMappingURL=LazyArray.js.map