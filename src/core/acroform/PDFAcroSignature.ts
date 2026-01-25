import type PDFDict from '../objects/PDFDict';
import type PDFRef from '../objects/PDFRef';
import PDFAcroTerminal from './PDFAcroTerminal';

class PDFAcroSignature extends PDFAcroTerminal {
  static override fromDict = (dict: PDFDict, ref: PDFRef) =>
    new PDFAcroSignature(dict, ref);
}

export default PDFAcroSignature;
