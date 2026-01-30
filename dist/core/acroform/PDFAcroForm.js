import PDFArray from '../objects/PDFArray.js';
import PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import PDFRef from '../objects/PDFRef.js';
import PDFAcroNonTerminal from './PDFAcroNonTerminal.js';
import { createPDFAcroField, createPDFAcroFields } from './utils.js';
class PDFAcroForm {
    dict;
    static fromDict = (dict) => new PDFAcroForm(dict);
    static create = (context) => {
        const dict = context.obj({ Fields: [] });
        return new PDFAcroForm(dict);
    };
    constructor(dict) {
        this.dict = dict;
    }
    Fields() {
        const fields = this.dict.lookup(PDFName.of('Fields'));
        if (fields instanceof PDFArray)
            return fields;
        return;
    }
    getFields() {
        const { Fields } = this.normalizedEntries();
        const fields = [];
        for (let idx = 0, len = Fields.size(); idx < len; idx++) {
            const ref = Fields.get(idx);
            const dict = Fields.lookup(idx);
            if (ref instanceof PDFRef && dict instanceof PDFDict) {
                fields.push([createPDFAcroField(dict, ref), ref]);
            }
        }
        return fields;
    }
    getAllFields() {
        const allFields = [];
        const pushFields = (fields) => {
            if (!fields)
                return;
            for (let idx = 0, len = fields.length; idx < len; idx++) {
                const field = fields[idx];
                allFields.push(field);
                const [fieldModel] = field;
                if (fieldModel instanceof PDFAcroNonTerminal) {
                    pushFields(createPDFAcroFields(fieldModel.Kids()));
                }
            }
        };
        pushFields(this.getFields());
        return allFields;
    }
    addField(field) {
        const { Fields } = this.normalizedEntries();
        Fields?.push(field);
    }
    removeField(field) {
        const parent = field.getParent();
        const fields = parent === undefined ? this.normalizedEntries().Fields : parent.Kids();
        const index = fields?.indexOf(field.ref);
        if (fields === undefined || index === undefined) {
            throw new Error(`Tried to remove inexistent field ${field.getFullyQualifiedName()}`);
        }
        fields.remove(index);
        if (parent !== undefined && fields.size() === 0) {
            this.removeField(parent);
        }
    }
    normalizedEntries() {
        let Fields = this.Fields();
        if (!Fields) {
            Fields = this.dict.context.obj([]);
            this.dict.set(PDFName.of('Fields'), Fields);
        }
        return { Fields };
    }
}
export default PDFAcroForm;
//# sourceMappingURL=PDFAcroForm.js.map