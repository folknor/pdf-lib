import type PDFDict from '../objects/PDFDict.js';
import type PDFRef from '../objects/PDFRef.js';
import type PDFContext from '../PDFContext.js';
import PDFAcroButton from './PDFAcroButton.js';
declare class PDFAcroPushButton extends PDFAcroButton {
    static fromDict: (dict: PDFDict, ref: PDFRef) => PDFAcroPushButton;
    static create: (context: PDFContext) => PDFAcroPushButton;
}
export default PDFAcroPushButton;
//# sourceMappingURL=PDFAcroPushButton.d.ts.map