import type PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import type PDFRef from '../objects/PDFRef.js';
import type PDFContext from '../PDFContext.js';
import PDFAcroButton from './PDFAcroButton.js';
declare class PDFAcroRadioButton extends PDFAcroButton {
    static fromDict: (dict: PDFDict, ref: PDFRef) => PDFAcroRadioButton;
    static create: (context: PDFContext) => PDFAcroRadioButton;
    setValue(value: PDFName): void;
    getValue(): PDFName;
    getOnValues(): PDFName[];
}
export default PDFAcroRadioButton;
//# sourceMappingURL=PDFAcroRadioButton.d.ts.map