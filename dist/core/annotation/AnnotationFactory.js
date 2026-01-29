import PDFName from '../objects/PDFName.js';
import { AnnotationTypes } from './AnnotationTypes.js';
import PDFAnnotation from './PDFAnnotation.js';
import PDFTextMarkupAnnotation from './PDFTextMarkupAnnotation.js';
export default class AnnotationFactory {
    static fromDict = (dict) => {
        switch (this.getSubtype(dict)) {
            case AnnotationTypes.Highlight:
            case AnnotationTypes.Underline:
            case AnnotationTypes.Squiggly:
            case AnnotationTypes.StrikeOut:
                return PDFTextMarkupAnnotation.fromDict(dict);
            default:
                return PDFAnnotation.fromDict(dict);
        }
    };
    static getSubtype(dict) {
        const subtypePdfName = dict.lookup(PDFName.of('Subtype'), PDFName);
        if (subtypePdfName instanceof PDFName) {
            return subtypePdfName.toString();
        }
        else {
            return undefined;
        }
    }
}
//# sourceMappingURL=AnnotationFactory.js.map