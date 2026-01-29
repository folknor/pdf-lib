import type PDFDict from '../objects/PDFDict.js';
import type PDFRef from '../objects/PDFRef.js';
import type PDFContext from '../PDFContext.js';
import PDFAcroField from './PDFAcroField.js';
declare class PDFAcroNonTerminal extends PDFAcroField {
    static fromDict: (dict: PDFDict, ref: PDFRef) => PDFAcroNonTerminal;
    static create: (context: PDFContext) => PDFAcroNonTerminal;
    addField(field: PDFRef): void;
    normalizedEntries(): {
        Kids: import("../index.js").PDFArray;
    };
}
export default PDFAcroNonTerminal;
//# sourceMappingURL=PDFAcroNonTerminal.d.ts.map