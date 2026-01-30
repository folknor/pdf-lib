/**
 * Restructure - Pointer type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
import { Base } from './Base.js';
import { PropertyDescriptor } from './utils.js';
export class Pointer extends Base {
    offsetType;
    type;
    options;
    relativeToGetter;
    constructor(offsetType, type, options = {}) {
        super();
        this.offsetType = offsetType;
        this.type = type === 'void' ? null : type;
        const opts = {
            type: options.type ?? 'local',
            allowNull: options.allowNull ?? true,
            nullValue: options.nullValue ?? 0,
            lazy: options.lazy ?? false,
        };
        if (options.relativeTo) {
            opts.relativeTo = options.relativeTo;
            this.relativeToGetter = options.relativeTo;
        }
        this.options = opts;
    }
    // Note: Returns PropertyDescriptor or number for special cases (lazy, void pointer)
    // These are handled appropriately by fontkit's callers
    decode(stream, ctx) {
        const offset = this.offsetType.decode(stream);
        if (offset === this.options.nullValue && this.options.allowNull) {
            return null;
        }
        const context = ctx;
        let relative;
        switch (this.options.type) {
            case 'local':
                relative = context._startOffset;
                break;
            case 'immediate':
                relative = stream.pos - this.offsetType.size();
                break;
            case 'parent':
                relative = context.parent._startOffset;
                break;
            default: {
                let c = context;
                while (c?.parent) {
                    c = c.parent;
                }
                relative = c?._startOffset || 0;
            }
        }
        if (this.relativeToGetter) {
            relative += this.relativeToGetter(context);
        }
        const ptr = offset + relative;
        if (this.type != null) {
            let val = null;
            const decodeValue = () => {
                if (val != null) {
                    return val;
                }
                const { pos } = stream;
                stream.pos = ptr;
                val = this.type.decode(stream, context);
                stream.pos = pos;
                return val;
            };
            if (this.options.lazy) {
                // For lazy pointers, return PropertyDescriptor cast as T
                // The caller (fontkit Struct) handles this specially via Object.defineProperty
                return new PropertyDescriptor({ get: decodeValue });
            }
            return decodeValue();
        }
        else {
            // For void pointers, return the raw offset as unknown as T
            return ptr;
        }
    }
    size(val, ctx) {
        const encodeCtx = ctx;
        const parent = encodeCtx;
        let sizeCtx = encodeCtx;
        switch (this.options.type) {
            case 'local':
            case 'immediate':
                break;
            case 'parent':
                sizeCtx = encodeCtx?.parent;
                break;
            default:
                while (sizeCtx?.parent) {
                    sizeCtx = sizeCtx.parent;
                }
        }
        let type = this.type;
        let value = val;
        if (type == null) {
            if (!(val instanceof VoidPointer)) {
                throw new Error('Must be a VoidPointer');
            }
            type = val.type;
            value = val.value;
        }
        if (value && sizeCtx) {
            const size = type.size(value, parent);
            sizeCtx.pointerSize = (sizeCtx.pointerSize ?? 0) + size;
        }
        return this.offsetType.size();
    }
    encode(stream, val, ctx) {
        const parent = ctx;
        if (val == null) {
            this.offsetType.encode(stream, this.options.nullValue);
            return;
        }
        let relative;
        let encodeCtx = ctx;
        switch (this.options.type) {
            case 'local':
                relative = ctx.startOffset;
                break;
            case 'immediate':
                relative = stream.pos + this.offsetType.size();
                break;
            case 'parent':
                encodeCtx = ctx.parent;
                relative = encodeCtx.startOffset;
                break;
            default:
                relative = 0;
                while (encodeCtx?.parent) {
                    encodeCtx = encodeCtx.parent;
                }
        }
        if (this.relativeToGetter) {
            relative += this.relativeToGetter(parent.val);
        }
        this.offsetType.encode(stream, encodeCtx.pointerOffset - relative);
        let type = this.type;
        let value = val;
        if (type == null) {
            if (!(val instanceof VoidPointer)) {
                throw new Error('Must be a VoidPointer');
            }
            type = val.type;
            value = val.value;
        }
        encodeCtx.pointers.push({
            type: type,
            val: value,
            parent,
        });
        encodeCtx.pointerOffset += type.size(value, parent);
    }
}
// A pointer whose type is determined at decode time
export class VoidPointer {
    type;
    value;
    constructor(type, value) {
        this.type = type;
        this.value = value;
    }
}
//# sourceMappingURL=Pointer.js.map