import PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import PDFAnnotation from './PDFAnnotation.js';
import PDFTextMarkupAnnotation from './PDFTextMarkupAnnotation.js';
import { AnnotationTypes } from './AnnotationTypes.js';

export default class AnnotationFactory {
  static fromDict = (dict: PDFDict): PDFAnnotation => {
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

  private static getSubtype(dict: PDFDict): AnnotationTypes | undefined {
    const subtypePdfName = dict.lookup(PDFName.of('Subtype'), PDFName);
    if (subtypePdfName instanceof PDFName) {
      return subtypePdfName.toString() as AnnotationTypes;
    } else {
      return undefined;
    }
  }
}
