import { AcroButtonFlags } from './flags.js';
import PDFAcroButton from './PDFAcroButton.js';
class PDFAcroPushButton extends PDFAcroButton {
    static fromDict = (dict, ref) => new PDFAcroPushButton(dict, ref);
    static create = (context) => {
        const dict = context.obj({
            FT: 'Btn',
            Ff: AcroButtonFlags.PushButton,
            Kids: [],
        });
        const ref = context.register(dict);
        return new PDFAcroPushButton(dict, ref);
    };
}
export default PDFAcroPushButton;
//# sourceMappingURL=PDFAcroPushButton.js.map