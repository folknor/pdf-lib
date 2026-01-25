import type PDFDict from '../objects/PDFDict';
import PDFAcroChoice from './PDFAcroChoice';
import type PDFContext from '../PDFContext';
import type PDFRef from '../objects/PDFRef';

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
