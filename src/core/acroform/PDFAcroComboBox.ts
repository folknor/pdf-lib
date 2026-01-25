import type PDFDict from '../objects/PDFDict.js';
import type PDFRef from '../objects/PDFRef.js';
import type PDFContext from '../PDFContext.js';
import { AcroChoiceFlags } from './flags.js';
import PDFAcroChoice from './PDFAcroChoice.js';

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
