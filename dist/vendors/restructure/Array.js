/**
 * Restructure - Array type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
import { NumberT } from './Number.js';
import * as utils from './utils.js';
export class ArrayT extends Base {
    type;
    length;
    lengthType;
    constructor(type, length, lengthType = 'count') {
        super();
        this.type = type;
        this.length = length;
        this.lengthType = lengthType;
    }
    decode(stream, parent) {
        let length;
        const { pos } = stream;
        const res = [];
        let ctx = parent;
        if (this.length != null) {
            length = utils.resolveLength(this.length, stream, parent);
        }
        if (this.length instanceof NumberT) {
            Object.defineProperties(res, {
                parent: { value: parent },
                _startOffset: { value: pos },
                _currentOffset: { value: 0, writable: true },
                _length: { value: length },
            });
            ctx = res;
        }
        if (length == null || this.lengthType === 'bytes') {
            const target = length != null
                ? stream.pos + length
                : parent?._length
                    ? parent._startOffset +
                        parent._length
                    : stream.length;
            while (stream.pos < target) {
                res.push(this.type.decode(stream, ctx));
            }
        }
        else {
            for (let i = 0; i < length; i++) {
                res.push(this.type.decode(stream, ctx));
            }
        }
        return res;
    }
    size(array, ctx, includePointers = true) {
        if (!array) {
            return (this.type.size(null, ctx) *
                utils.resolveLength(this.length, null, ctx));
        }
        let size = 0;
        let localCtx = ctx;
        if (this.length instanceof NumberT) {
            size += this.length.size();
            localCtx = { parent: ctx, pointerSize: 0 };
        }
        for (const item of array) {
            size += this.type.size(item, localCtx);
        }
        if (localCtx && includePointers && this.length instanceof NumberT) {
            size += localCtx.pointerSize;
        }
        return size;
    }
    encode(stream, array, parent) {
        let ctx = parent;
        if (this.length instanceof NumberT) {
            const encodeCtx = {
                pointers: [],
                startOffset: stream.pos,
                parent,
                pointerOffset: 0,
            };
            encodeCtx.pointerOffset =
                stream.pos +
                    this.size(array, encodeCtx, false);
            this.length.encode(stream, array.length);
            ctx = encodeCtx;
        }
        for (const item of array) {
            this.type.encode(stream, item, ctx);
        }
        if (this.length instanceof NumberT) {
            const encodeCtx = ctx;
            let i = 0;
            while (i < encodeCtx.pointers.length) {
                const ptr = encodeCtx.pointers[i++];
                ptr.type.encode(stream, ptr.val, ptr.parent);
            }
        }
    }
}
export { ArrayT as Array };
//# sourceMappingURL=Array.js.map