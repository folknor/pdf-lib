import type { CipherTransform } from '../crypto.js';
import type PDFContext from '../PDFContext.js';
import type PDFDict from './PDFDict.js';
import PDFStream from './PDFStream.js';
declare class PDFRawStream extends PDFStream {
    static of: (dict: PDFDict, contents: Uint8Array, transform?: CipherTransform) => PDFRawStream;
    contents: Uint8Array;
    readonly transform: CipherTransform | undefined;
    private constructor();
    asUint8Array(): Uint8Array;
    clone(context?: PDFContext): PDFRawStream;
    getContentsString(): string;
    getContents(): Uint8Array;
    getContentsSize(): number;
    updateContents(contents: Uint8Array): void;
}
export default PDFRawStream;
//# sourceMappingURL=PDFRawStream.d.ts.map