import { PDFArray, type PDFDict, PDFHexString, type PDFObject, PDFString } from '../core/index.js';
/**
 * True when `node` is a flat leaf name-tree node we can safely rewrite.
 * Returns false for `/Kids` trees (or nodes that mix Kids + Names), and for
 * malformed `/Names` arrays - those PDFs are left untouched.
 */
export declare const isWritableFlatNameTree: (node: PDFDict) => boolean;
/**
 * Sort a flat name-tree `/Names` array in place (PDF lexical / byte order,
 * as required by ISO 32000 7.9.6). Assumes every even slot is a string key.
 */
export declare const sortNameTreeNames: (names: PDFArray) => void;
/**
 * Append `key` / `value` to a flat name-tree node and re-sort `/Names`.
 *
 * @returns `true` if the entry was registered; `false` if the node uses
 * `/Kids` or another incompatible structure (left unchanged).
 */
export declare const addNameTreeEntry: (node: PDFDict, key: PDFString | PDFHexString, value: PDFObject) => boolean;
//# sourceMappingURL=nameTree.d.ts.map