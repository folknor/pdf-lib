import type { DocumentSnapshot } from '../../api/snapshot/index.js';
import PDFTrailer from '../document/PDFTrailer.js';
import type PDFObject from '../objects/PDFObject.js';
import PDFRef from '../objects/PDFRef.js';
import type PDFContext from '../PDFContext.js';
import PDFWriter from './PDFWriter.js';
declare class PDFStreamWriter extends PDFWriter {
    static forContext: (context: PDFContext, objectsPerTick: number, encodeStreams?: boolean, objectsPerStream?: number, compress?: boolean) => PDFStreamWriter;
    static forContextWithSnapshot: (context: PDFContext, objectsPerTick: number, snapshot: DocumentSnapshot, encodeStreams?: boolean, objectsPerStream?: number, compress?: boolean) => PDFStreamWriter;
    private readonly encodeStreams;
    private readonly objectsPerStream;
    private _refToDeleteAfterSave;
    private constructor();
    protected computeBufferSize(incremental: boolean): Promise<{
        size: number;
        header: import("../index.js").PDFHeader;
        indirectObjects: [PDFRef, PDFObject][];
        trailer: PDFTrailer;
    }>;
    serializeToBuffer(): Promise<Uint8Array<ArrayBuffer>>;
}
export default PDFStreamWriter;
//# sourceMappingURL=PDFStreamWriter.d.ts.map