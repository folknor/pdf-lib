import type PDFDict from '../objects/PDFDict.js';
import PDFAnnotation from './PDFAnnotation.js';
declare function fromDict(dict: PDFDict): PDFAnnotation;
declare const AnnotationFactory: {
    fromDict: typeof fromDict;
};
export default AnnotationFactory;
//# sourceMappingURL=AnnotationFactory.d.ts.map