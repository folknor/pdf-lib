import PDFName from '../objects/PDFName.js';
import PDFAcroField from './PDFAcroField.js';
class PDFAcroNonTerminal extends PDFAcroField {
    static fromDict = (dict, ref) => new PDFAcroNonTerminal(dict, ref);
    static create = (context) => {
        const dict = context.obj({});
        const ref = context.register(dict);
        return new PDFAcroNonTerminal(dict, ref);
    };
    addField(field) {
        const { Kids } = this.normalizedEntries();
        Kids?.push(field);
    }
    normalizedEntries() {
        let Kids = this.Kids();
        if (!Kids) {
            Kids = this.dict.context.obj([]);
            this.dict.set(PDFName.of('Kids'), Kids);
        }
        return { Kids };
    }
}
export default PDFAcroNonTerminal;
//# sourceMappingURL=PDFAcroNonTerminal.js.map