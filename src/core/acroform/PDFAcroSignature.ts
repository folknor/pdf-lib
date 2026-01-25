import type PDFDict from '../objects/PDFDict.js';
import type PDFRef from '../objects/PDFRef.js';
import PDFAcroTerminal from './PDFAcroTerminal.js';

class PDFAcroSignature extends PDFAcroTerminal {
  static override fromDict = (dict: PDFDict, ref: PDFRef) =>
    new PDFAcroSignature(dict, ref);
}

export default PDFAcroSignature;
