import type PDFDict from '../objects/PDFDict';
import PDFAcroChoice from './PDFAcroChoice';
import type PDFContext from '../PDFContext';
import type PDFRef from '../objects/PDFRef';
import { AcroChoiceFlags } from './flags';

class PDFAcroComboBox extends PDFAcroChoice {
  static override fromDict = (dict: PDFDict, ref: PDFRef) =>
    new PDFAcroComboBox(dict, ref);

  static create = (context: PDFContext) => {
    const dict = context.obj({
      FT: 'Ch',
      Ff: AcroChoiceFlags.Combo,
      Kids: [],
    });
    const ref = context.register(dict);
    return new PDFAcroComboBox(dict, ref);
  };
}

export default PDFAcroComboBox;
