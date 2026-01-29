import { PDFAcroForm } from '../acroform/index.js';
import ViewerPreferences from '../interactive/ViewerPreferences.js';
import PDFArray from '../objects/PDFArray.js';
import PDFDict, { type DictMap } from '../objects/PDFDict.js';
import type PDFRef from '../objects/PDFRef.js';
import type PDFContext from '../PDFContext.js';
import type PDFPageTree from './PDFPageTree.js';
declare class PDFCatalog extends PDFDict {
    static withContextAndPages: (context: PDFContext, pages: PDFPageTree | PDFRef) => PDFCatalog;
    static fromMapWithContext: (map: DictMap, context: PDFContext) => PDFCatalog;
    Pages(): PDFPageTree;
    AcroForm(): PDFDict | undefined;
    Names(): PDFDict | undefined;
    AttachedFiles(): PDFArray | undefined;
    getAcroForm(): PDFAcroForm | undefined;
    getOrCreateAcroForm(): PDFAcroForm;
    ViewerPreferences(): PDFDict | undefined;
    getViewerPreferences(): ViewerPreferences | undefined;
    getOrCreateViewerPreferences(): ViewerPreferences;
    /**
     * Inserts the given ref as a leaf node of this catalog's page tree at the
     * specified index (zero-based). Also increments the `Count` of each node in
     * the page tree hierarchy to accomodate the new page.
     *
     * Returns the ref of the PDFPageTree node into which `leafRef` was inserted.
     */
    insertLeafNode(leafRef: PDFRef, index: number): PDFRef;
    removeLeafNode(index: number): void;
}
export default PDFCatalog;
//# sourceMappingURL=PDFCatalog.d.ts.map