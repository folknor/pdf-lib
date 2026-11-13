import { PDFArray, PDFHexString, PDFName, PDFString, } from '../core/index.js';
const compareBytes = (left, right) => {
    const length = Math.min(left.length, right.length);
    for (let idx = 0; idx < length; idx++) {
        const diff = left[idx] - right[idx];
        if (diff !== 0)
            return diff;
    }
    return left.length - right.length;
};
const isNameTreeKey = (object) => object instanceof PDFString || object instanceof PDFHexString;
/**
 * True when `node` is a flat leaf name-tree node we can safely rewrite.
 * Returns false for `/Kids` trees (or nodes that mix Kids + Names), and for
 * malformed `/Names` arrays - those PDFs are left untouched.
 */
export const isWritableFlatNameTree = (node) => {
    if (node.has(PDFName.of('Kids')))
        return false;
    if (!node.has(PDFName.of('Names')))
        return true;
    const names = node.lookup(PDFName.of('Names'));
    if (!(names instanceof PDFArray) || names.size() % 2 !== 0)
        return false;
    for (let idx = 0, len = names.size(); idx < len; idx += 2) {
        if (!isNameTreeKey(names.get(idx)))
            return false;
    }
    return true;
};
/**
 * Sort a flat name-tree `/Names` array in place (PDF lexical / byte order,
 * as required by ISO 32000 7.9.6). Assumes every even slot is a string key.
 */
export const sortNameTreeNames = (names) => {
    const pairs = [];
    for (let idx = 0, len = names.size(); idx + 1 < len; idx += 2) {
        const key = names.get(idx);
        if (!isNameTreeKey(key))
            return;
        pairs.push({ key, value: names.get(idx + 1) });
    }
    pairs.sort((a, b) => compareBytes(a.key.asBytes(), b.key.asBytes()));
    pairs.forEach(({ key, value }, idx) => {
        names.set(idx * 2, key);
        names.set(idx * 2 + 1, value);
    });
};
const syncLimitsIfPresent = (node, names) => {
    if (!node.has(PDFName.of('Limits')) || names.size() === 0)
        return;
    const limits = node.lookup(PDFName.of('Limits'));
    if (!(limits instanceof PDFArray) || limits.size() < 2)
        return;
    limits.set(0, names.get(0));
    limits.set(1, names.get(names.size() - 2));
};
/**
 * Append `key` / `value` to a flat name-tree node and re-sort `/Names`.
 *
 * @returns `true` if the entry was registered; `false` if the node uses
 * `/Kids` or another incompatible structure (left unchanged).
 */
export const addNameTreeEntry = (node, key, value) => {
    if (!isWritableFlatNameTree(node))
        return false;
    if (!node.has(PDFName.of('Names'))) {
        node.set(PDFName.of('Names'), node.context.obj([]));
    }
    const names = node.lookup(PDFName.of('Names'), PDFArray);
    names.push(key);
    names.push(value);
    sortNameTreeNames(names);
    syncLimitsIfPresent(node, names);
    return true;
};
//# sourceMappingURL=nameTree.js.map