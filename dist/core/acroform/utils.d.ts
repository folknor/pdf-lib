import PDFArray from '../objects/PDFArray.js';
import PDFDict from '../objects/PDFDict.js';
import PDFRef from '../objects/PDFRef.js';
import type PDFAcroField from './PDFAcroField.js';
export declare const createPDFAcroFields: (kidDicts?: PDFArray) => [PDFAcroField, PDFRef][];
export declare const createPDFAcroField: (dict: PDFDict, ref: PDFRef) => PDFAcroField;
//# sourceMappingURL=utils.d.ts.map