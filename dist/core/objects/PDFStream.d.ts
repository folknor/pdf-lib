import type PDFContext from '../PDFContext.js';
import type PDFDict from './PDFDict.js';
import PDFObject from './PDFObject.js';
declare class PDFStream extends PDFObject {
    readonly dict: PDFDict;
    constructor(dict: PDFDict);
    clone(_context?: PDFContext): PDFStream;
    getContentsString(): string;
    getContents(): Uint8Array;
    getContentsSize(): number;
    updateContents(_contents: Uint8Array): void;
    updateDict(): void;
    sizeInBytes(): number;
    toString(): string;
    copyBytesInto(buffer: Uint8Array, offset: number): number;
}
export default PDFStream;
//# sourceMappingURL=PDFStream.d.ts.map