import type PDFDict from '../objects/PDFDict.js';
import PDFHexString from '../objects/PDFHexString.js';
import PDFNumber from '../objects/PDFNumber.js';
import type PDFRef from '../objects/PDFRef.js';
import PDFString from '../objects/PDFString.js';
import type PDFContext from '../PDFContext.js';
import PDFAcroTerminal from './PDFAcroTerminal.js';
declare class PDFAcroText extends PDFAcroTerminal {
    static fromDict: (dict: PDFDict, ref: PDFRef) => PDFAcroText;
    static create: (context: PDFContext) => PDFAcroText;
    MaxLen(): PDFNumber | undefined;
    Q(): PDFNumber | undefined;
    setMaxLength(maxLength: number): void;
    removeMaxLength(): void;
    getMaxLength(): number | undefined;
    setQuadding(quadding: 0 | 1 | 2): void;
    getQuadding(): number | undefined;
    setValue(value: PDFHexString | PDFString): void;
    removeValue(): void;
    getValue(): PDFString | PDFHexString | undefined;
}
export default PDFAcroText;
//# sourceMappingURL=PDFAcroText.d.ts.map