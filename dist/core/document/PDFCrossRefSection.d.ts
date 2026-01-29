import PDFRef from '../objects/PDFRef.js';
export interface Entry {
    ref: PDFRef;
    offset: number;
    deleted: boolean;
}
/**
 * Entries should be added using the [[addEntry]] and [[addDeletedEntry]]
 * methods.
 */
declare class PDFCrossRefSection {
    static create: () => PDFCrossRefSection;
    static createEmpty: () => PDFCrossRefSection;
    private subsections;
    private chunkIdx;
    private chunkLength;
    private constructor();
    addEntry(ref: PDFRef, offset: number): void;
    addDeletedEntry(ref: PDFRef, nextFreeObjectNumber: number): void;
    /**
     * Fills gaps between subsections with deleted ('f') entries, creating a
     * single contiguous xref section. This prevents xref fragmentation which
     * can cause Adobe Reader to invalidate digital signatures.
     *
     * For example, if there are entries for objects 0-5 and 10-15, this method
     * adds deleted entries for objects 6-9, resulting in a single section 0-15.
     */
    fillGaps(): void;
    toString(): string;
    sizeInBytes(): number;
    copyBytesInto(buffer: Uint8Array, offset: number): number;
    private copySubsectionsIntoBuffer;
    private copyEntriesIntoBuffer;
    private append;
}
export default PDFCrossRefSection;
//# sourceMappingURL=PDFCrossRefSection.d.ts.map