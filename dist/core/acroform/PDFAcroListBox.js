import PDFAcroChoice from './PDFAcroChoice.js';
class PDFAcroListBox extends PDFAcroChoice {
    static fromDict = (dict, ref) => new PDFAcroListBox(dict, ref);
    static create = (context) => {
        const dict = context.obj({
            FT: 'Ch',
            Kids: [],
        });
        const ref = context.register(dict);
        return new PDFAcroListBox(dict, ref);
    };
}
export default PDFAcroListBox;
//# sourceMappingURL=PDFAcroListBox.js.map