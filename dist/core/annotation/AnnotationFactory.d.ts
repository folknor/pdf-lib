import type PDFDict from '../objects/PDFDict.js';
import PDFAnnotation from './PDFAnnotation.js';
export default class AnnotationFactory {
    static fromDict: (dict: PDFDict) => PDFAnnotation;
    private static getSubtype;
}
//# sourceMappingURL=AnnotationFactory.d.ts.map