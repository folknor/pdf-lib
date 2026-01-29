import type PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import type PDFRef from '../objects/PDFRef.js';
import type PDFContext from '../PDFContext.js';
import PDFAcroButton from './PDFAcroButton.js';
declare class PDFAcroCheckBox extends PDFAcroButton {
    static fromDict: (dict: PDFDict, ref: PDFRef) => PDFAcroCheckBox;
    static create: (context: PDFContext) => PDFAcroCheckBox;
    setValue(value: PDFName): void;
    getValue(): PDFName;
    getOnValue(): PDFName | undefined;
}
export default PDFAcroCheckBox;
//# sourceMappingURL=PDFAcroCheckBox.d.ts.map