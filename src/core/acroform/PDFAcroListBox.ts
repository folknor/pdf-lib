import type PDFDict from '../objects/PDFDict.js';
import type PDFRef from '../objects/PDFRef.js';
import type PDFContext from '../PDFContext.js';
import PDFAcroChoice from './PDFAcroChoice.js';

class PDFAcroListBox extends PDFAcroChoice {
  static override fromDict = (dict: PDFDict, ref: PDFRef) =>
    new PDFAcroListBox(dict, ref);

  static create = (context: PDFContext) => {
    const dict = context.obj({
      FT: 'Ch',
      Kids: [],
    });
    const ref = context.register(dict);
    return new PDFAcroListBox(dict, ref);
  };
}

export default PDFAcroListBox;
