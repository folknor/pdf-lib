/**
 * Restructure - Utilities
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
export { PropertyDescriptor } from './types.js';
export function resolveLength(length, stream, parent) {
    let res;
    if (typeof length === 'number') {
        res = length;
    }
    else if (typeof length === 'function') {
        res = length.call(parent, parent);
    }
    else if (parent && typeof length === 'string') {
        res = parent[length];
    }
    else if (stream &&
        length &&
        typeof length.decode === 'function') {
        res = length.decode(stream);
    }
    else {
        res = NaN;
    }
    if (Number.isNaN(res)) {
        throw new Error('Not a fixed size');
    }
    return res;
}
//# sourceMappingURL=utils.js.map