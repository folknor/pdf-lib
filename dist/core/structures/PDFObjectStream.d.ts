import type PDFObject from '../objects/PDFObject.js';
import type PDFRef from '../objects/PDFRef.js';
import type PDFContext from '../PDFContext.js';
import PDFFlateStream from './PDFFlateStream.js';
export type IndirectObject = [PDFRef, PDFObject];
declare class PDFObjectStream extends PDFFlateStream {
    static withContextAndObjects: (context: PDFContext, objects: IndirectObject[], encode?: boolean) => PDFObjectStream;
    private readonly objects;
    private readonly offsets;
    private readonly offsetsString;
    private constructor();
    getObjectsCount(): number;
    clone(context?: PDFContext): PDFObjectStream;
    getContentsString(): string;
    getUnencodedContents(): Uint8Array;
    getUnencodedContentsSize(): number;
    private computeOffsetsString;
    private computeObjectOffsets;
}
export default PDFObjectStream;
//# sourceMappingURL=PDFObjectStream.d.ts.map