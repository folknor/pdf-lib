import type PDFDict from '../objects/PDFDict.js';
import type PDFRef from '../objects/PDFRef.js';
import type PDFContext from '../PDFContext.js';
import PDFAcroChoice from './PDFAcroChoice.js';
declare class PDFAcroListBox extends PDFAcroChoice {
    static fromDict: (dict: PDFDict, ref: PDFRef) => PDFAcroListBox;
    static create: (context: PDFContext) => PDFAcroListBox;
}
export default PDFAcroListBox;
//# sourceMappingURL=PDFAcroListBox.d.ts.map