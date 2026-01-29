import { AcroChoiceFlags } from './flags.js';
import PDFAcroChoice from './PDFAcroChoice.js';
class PDFAcroComboBox extends PDFAcroChoice {
    static fromDict = (dict, ref) => new PDFAcroComboBox(dict, ref);
    static create = (context) => {
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
//# sourceMappingURL=PDFAcroComboBox.js.map