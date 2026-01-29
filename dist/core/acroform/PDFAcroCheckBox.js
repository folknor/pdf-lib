import { InvalidAcroFieldValueError } from '../errors.js';
import PDFName from '../objects/PDFName.js';
import PDFAcroButton from './PDFAcroButton.js';
class PDFAcroCheckBox extends PDFAcroButton {
    static fromDict = (dict, ref) => new PDFAcroCheckBox(dict, ref);
    static create = (context) => {
        const dict = context.obj({
            FT: 'Btn',
            Kids: [],
        });
        const ref = context.register(dict);
        return new PDFAcroCheckBox(dict, ref);
    };
    setValue(value) {
        const onValue = this.getOnValue() ?? PDFName.of('Yes');
        if (value !== onValue && value !== PDFName.of('Off')) {
            throw new InvalidAcroFieldValueError();
        }
        this.dict.set(PDFName.of('V'), value);
        const widgets = this.getWidgets();
        for (let idx = 0, len = widgets.length; idx < len; idx++) {
            const widget = widgets[idx];
            const state = widget.getOnValue() === value ? value : PDFName.of('Off');
            widget.setAppearanceState(state);
        }
    }
    getValue() {
        const v = this.V();
        if (v instanceof PDFName)
            return v;
        return PDFName.of('Off');
    }
    getOnValue() {
        const [widget] = this.getWidgets();
        return widget?.getOnValue();
    }
}
export default PDFAcroCheckBox;
//# sourceMappingURL=PDFAcroCheckBox.js.map