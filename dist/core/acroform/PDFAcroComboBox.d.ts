import type PDFDict from '../objects/PDFDict.js';
import type PDFRef from '../objects/PDFRef.js';
import type PDFContext from '../PDFContext.js';
import PDFAcroChoice from './PDFAcroChoice.js';
declare class PDFAcroComboBox extends PDFAcroChoice {
    static fromDict: (dict: PDFDict, ref: PDFRef) => PDFAcroComboBox;
    static create: (context: PDFContext) => PDFAcroComboBox;
}
export default PDFAcroComboBox;
//# sourceMappingURL=PDFAcroComboBox.d.ts.map