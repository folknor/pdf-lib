import PDFDict from '../objects/PDFDict.js';
import PDFHexString from '../objects/PDFHexString.js';
import PDFName from '../objects/PDFName.js';
import PDFRef from '../objects/PDFRef.js';
import PDFString from '../objects/PDFString.js';
import AppearanceCharacteristics from './AppearanceCharacteristics.js';
import BorderStyle from './BorderStyle.js';
import PDFAnnotation from './PDFAnnotation.js';
class PDFWidgetAnnotation extends PDFAnnotation {
    static fromDict = (dict) => new PDFWidgetAnnotation(dict);
    static create = (context, parent) => {
        const dict = context.obj({
            Type: 'Annot',
            Subtype: 'Widget',
            Rect: [0, 0, 0, 0],
            Parent: parent,
        });
        return new PDFWidgetAnnotation(dict);
    };
    MK() {
        const MK = this.dict.lookup(PDFName.of('MK'));
        if (MK instanceof PDFDict)
            return MK;
        return;
    }
    BS() {
        const BS = this.dict.lookup(PDFName.of('BS'));
        if (BS instanceof PDFDict)
            return BS;
        return;
    }
    DA() {
        const da = this.dict.lookup(PDFName.of('DA'));
        if (da instanceof PDFString || da instanceof PDFHexString)
            return da;
        return;
    }
    P() {
        const P = this.dict.get(PDFName.of('P'));
        if (P instanceof PDFRef)
            return P;
        return;
    }
    setP(page) {
        this.dict.set(PDFName.of('P'), page);
    }
    setDefaultAppearance(appearance) {
        this.dict.set(PDFName.of('DA'), PDFString.of(appearance));
    }
    getDefaultAppearance() {
        const DA = this.DA();
        if (DA instanceof PDFHexString) {
            return DA.decodeText();
        }
        return DA?.asString();
    }
    getAppearanceCharacteristics() {
        const MK = this.MK();
        if (MK)
            return AppearanceCharacteristics.fromDict(MK);
        return;
    }
    getOrCreateAppearanceCharacteristics() {
        const MK = this.MK();
        if (MK)
            return AppearanceCharacteristics.fromDict(MK);
        const ac = AppearanceCharacteristics.fromDict(this.dict.context.obj({}));
        this.dict.set(PDFName.of('MK'), ac.dict);
        return ac;
    }
    getBorderStyle() {
        const BS = this.BS();
        if (BS)
            return BorderStyle.fromDict(BS);
        return;
    }
    getOrCreateBorderStyle() {
        const BS = this.BS();
        if (BS)
            return BorderStyle.fromDict(BS);
        const bs = BorderStyle.fromDict(this.dict.context.obj({}));
        this.dict.set(PDFName.of('BS'), bs.dict);
        return bs;
    }
    getOnValue() {
        const normal = this.getAppearances()?.normal;
        if (normal instanceof PDFDict) {
            const keys = normal.keys();
            for (let idx = 0, len = keys.length; idx < len; idx++) {
                const key = keys[idx];
                if (key !== PDFName.of('Off'))
                    return key;
            }
        }
        return;
    }
}
export default PDFWidgetAnnotation;
//# sourceMappingURL=PDFWidgetAnnotation.js.map