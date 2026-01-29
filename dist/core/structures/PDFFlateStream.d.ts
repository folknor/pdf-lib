import { Cache } from '../../utils/index.js';
import type PDFDict from '../objects/PDFDict.js';
import PDFStream from '../objects/PDFStream.js';
declare class PDFFlateStream extends PDFStream {
    protected contentsCache: Cache<Uint8Array>;
    protected readonly encode: boolean;
    constructor(dict: PDFDict, encode: boolean);
    computeContents: () => Uint8Array;
    getContents(): Uint8Array;
    getContentsSize(): number;
    getUnencodedContents(): Uint8Array;
    updateContents(contents: Uint8Array): void;
}
export default PDFFlateStream;
//# sourceMappingURL=PDFFlateStream.d.ts.map