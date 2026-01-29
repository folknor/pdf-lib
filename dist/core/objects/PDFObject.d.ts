import type PDFContext from '../PDFContext.js';
declare class PDFObject {
    /**
     * Notifies the context that this object has been modified.
     * Used for incremental save support - tracks which objects need to be
     * written when saving incrementally.
     *
     * IMPORTANT: Mutable PDFObject subclasses (PDFArray, PDFDict, PDFRawStream)
     * must call this method in any method that modifies their contents.
     * Immutable objects (PDFName, PDFNumber, PDFBool, PDFString, etc.) do not
     * need to implement this as they cannot be modified after creation.
     */
    registerChange(): void;
    clone(_context?: PDFContext): PDFObject;
    toString(): string;
    sizeInBytes(): number;
    copyBytesInto(_buffer: Uint8Array, _offset: number): number;
}
export default PDFObject;
//# sourceMappingURL=PDFObject.d.ts.map