import type { DocumentSnapshot } from '../../api/snapshot/index.js';
import PDFCrossRefSection from '../document/PDFCrossRefSection.js';
import type PDFHeader from '../document/PDFHeader.js';
import PDFTrailer from '../document/PDFTrailer.js';
import PDFTrailerDict from '../document/PDFTrailerDict.js';
import type PDFDict from '../objects/PDFDict.js';
import type PDFObject from '../objects/PDFObject.js';
import PDFRef from '../objects/PDFRef.js';
import type PDFContext from '../PDFContext.js';
import type PDFSecurity from '../security/PDFSecurity.js';
export interface SerializationInfo {
    size: number;
    header: PDFHeader;
    indirectObjects: [PDFRef, PDFObject][];
    xref?: PDFCrossRefSection;
    trailerDict?: PDFTrailerDict;
    trailer: PDFTrailer;
}
declare class PDFWriter {
    static forContext: (context: PDFContext, objectsPerTick: number, compress?: boolean) => PDFWriter;
    static forContextWithSnapshot: (context: PDFContext, objectsPerTick: number, snapshot: DocumentSnapshot, compress?: boolean) => PDFWriter;
    protected readonly context: PDFContext;
    protected readonly objectsPerTick: number;
    protected readonly snapshot: DocumentSnapshot;
    protected readonly shouldCompress: boolean;
    /** Set to true to fill xref gaps with deleted entries (prevents fragmentation) */
    fillXrefGaps: boolean;
    private parsedObjects;
    /**
     * If PDF has an XRef Stream, then the last object will be probably be skipped on saving.
     * If that's the case, this property will have that object number, and the PDF /Size can
     * be corrected, to be accurate.
     */
    protected _largestSkippedObjectNum: number;
    protected constructor(context: PDFContext, objectsPerTick: number, snapshot: DocumentSnapshot, compress: boolean);
    /**
     * For incremental saves, defers the decision to the snapshot.
     * For full saves, checks that the object is not an XRef stream object.
     * @param incremental If making an incremental save, or a full save of the PDF
     * @param objNum Object number
     * @param object PDFObject used to check if it is an XRef stream, when not 'incremental' saving
     * @returns whether the object should be saved or not
     */
    protected shouldSave(incremental: boolean, objNum: number, object: PDFObject): boolean;
    serializeToBuffer(): Promise<Uint8Array<ArrayBuffer>>;
    protected computeIndirectObjectSize([ref, object]: [
        PDFRef,
        PDFObject
    ]): number;
    protected createTrailerDict(prevStartXRef?: number): PDFDict;
    protected computeBufferSize(incremental: boolean): Promise<SerializationInfo>;
    protected compress(object: PDFObject): void;
    protected encrypt(ref: PDFRef, object: PDFObject, security: PDFSecurity): void;
    protected shouldWaitForTick: (n: number) => boolean;
}
export default PDFWriter;
//# sourceMappingURL=PDFWriter.d.ts.map