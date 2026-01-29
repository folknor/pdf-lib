import type PDFDict from '../objects/PDFDict.js';
import type PDFRef from '../objects/PDFRef.js';
import PDFAcroTerminal from './PDFAcroTerminal.js';
declare class PDFAcroSignature extends PDFAcroTerminal {
    static fromDict: (dict: PDFDict, ref: PDFRef) => PDFAcroSignature;
}
export default PDFAcroSignature;
//# sourceMappingURL=PDFAcroSignature.d.ts.map