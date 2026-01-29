import type PDFObject from './objects/PDFObject.js';
import type PDFContext from './PDFContext.js';
export interface CopyOptions {
    /**
     * When true, analyzes page content streams to determine which resources
     * (fonts, images, etc.) are actually used and only copies those.
     * This can significantly reduce file size when copying pages from documents
     * with many shared resources.
     *
     * Default: false (copies all inherited resources)
     */
    optimizeResources?: boolean;
    /**
     * A function to transform field names when copying pages with form fields.
     * This is useful to avoid field name conflicts when copying pages from
     * multiple source documents into the same destination document.
     *
     * The function receives the original field name and should return the new name.
     * If the function returns the same name, no rename occurs.
     *
     * Example: Add a prefix to avoid conflicts:
     * ```js
     * const copiedPages = await pdfDoc.copyPages(srcDoc, [0], {
     *   renameFields: (name) => `doc1_${name}`
     * });
     * ```
     *
     * Default: undefined (field names are preserved)
     */
    renameFields?: (fieldName: string) => string;
}
/**
 * PDFObjectCopier copies PDFObjects from a src context to a dest context.
 * The primary use case for this is to copy pages between PDFs.
 *
 * _Copying_ an object with a PDFObjectCopier is different from _cloning_ an
 * object with its [[PDFObject.clone]] method:
 *
 * ```
 *   const src: PDFContext = ...
 *   const dest: PDFContext = ...
 *   const originalObject: PDFObject = ...
 *   const copiedObject = PDFObjectCopier.for(src, dest).copy(originalObject);
 *   const clonedObject = originalObject.clone();
 * ```
 *
 * Copying an object is equivalent to cloning it and then copying over any other
 * objects that it references. Note that only dictionaries, arrays, and streams
 * (or structures build from them) can contain indirect references to other
 * objects. Copying a PDFObject that is not a dictionary, array, or stream is
 * supported, but is equivalent to cloning it.
 */
declare class PDFObjectCopier {
    static for: (src: PDFContext, dest: PDFContext, options?: CopyOptions) => PDFObjectCopier;
    private readonly src;
    private readonly dest;
    private readonly traversedObjects;
    private readonly options;
    private constructor();
    copy: <T extends PDFObject>(object: T) => T;
    private copyPDFPage;
    private copyPDFDict;
    private copyPDFArray;
    private copyPDFStream;
    private copyPDFIndirectObject;
}
export default PDFObjectCopier;
//# sourceMappingURL=PDFObjectCopier.d.ts.map