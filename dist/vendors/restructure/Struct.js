/**
 * Restructure - Struct type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
import { PropertyDescriptor } from './utils.js';
export class Struct extends Base {
    fields;
    process;
    preEncode;
    constructor(fields = {}) {
        super();
        this.fields = fields;
    }
    decode(stream, parent, length = 0) {
        const res = this._setup(stream, parent, length);
        this._parseFields(stream, res, this.fields);
        if (this.process != null) {
            this.process.call(res, stream);
        }
        return res;
    }
    _setup(stream, parent, length) {
        const res = {};
        Object.defineProperties(res, {
            parent: { value: parent },
            _startOffset: { value: stream.pos },
            _currentOffset: { value: 0, writable: true },
            _length: { value: length },
        });
        return res;
    }
    _parseFields(stream, res, fields) {
        for (const key in fields) {
            let val;
            const type = fields[key];
            if (typeof type === 'function') {
                val = type.call(res, res);
            }
            else {
                val = type.decode(stream, res);
            }
            if (val !== undefined) {
                if (val instanceof PropertyDescriptor) {
                    Object.defineProperty(res, key, val);
                }
                else {
                    res[key] = val;
                }
            }
            res._currentOffset = stream.pos - res._startOffset;
        }
    }
    size(val, parent, includePointers = true) {
        if (val == null) {
            val = {};
        }
        const ctx = {
            parent,
            val,
            pointerSize: 0,
        };
        if (this.preEncode != null) {
            this.preEncode.call(val);
        }
        let size = 0;
        for (const key in this.fields) {
            const type = this.fields[key];
            if (typeof type !== 'function' && type.size != null) {
                size += type.size(val[key], ctx);
            }
        }
        if (includePointers) {
            size += ctx.pointerSize;
        }
        return size;
    }
    encode(stream, val, parent) {
        if (this.preEncode != null) {
            this.preEncode.call(val, stream);
        }
        const ctx = {
            pointers: [],
            startOffset: stream.pos,
            parent,
            val,
            pointerOffset: 0,
            pointerSize: 0,
        };
        ctx.pointerOffset = stream.pos + this.size(val, ctx, false);
        for (const key in this.fields) {
            const type = this.fields[key];
            if (typeof type !== 'function' && type.encode != null) {
                type.encode(stream, val[key], ctx);
            }
        }
        let i = 0;
        while (i < ctx.pointers.length) {
            const ptr = ctx.pointers[i++];
            ptr.type.encode(stream, ptr.val, ptr.parent);
        }
    }
}
//# sourceMappingURL=Struct.js.map