import PDFName from '../objects/PDFName.js';
import { AnnotationTypes } from './AnnotationTypes.js';
import PDFAnnotation from './PDFAnnotation.js';
import PDFTextMarkupAnnotation from './PDFTextMarkupAnnotation.js';
function getSubtype(dict) {
    const subtypePdfName = dict.lookup(PDFName.of('Subtype'), PDFName);
    if (subtypePdfName instanceof PDFName) {
        return subtypePdfName.toString();
    }
    else {
        return undefined;
    }
}
function fromDict(dict) {
    switch (getSubtype(dict)) {
        case AnnotationTypes.Highlight:
        case AnnotationTypes.Underline:
        case AnnotationTypes.Squiggly:
        case AnnotationTypes.StrikeOut:
            return PDFTextMarkupAnnotation.fromDict(dict);
        default:
            return PDFAnnotation.fromDict(dict);
    }
}
const AnnotationFactory = {
    fromDict,
};
export default AnnotationFactory;
//# sourceMappingURL=AnnotationFactory.js.map