import type PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import { AnnotationTypes } from './AnnotationTypes.js';
import PDFAnnotation from './PDFAnnotation.js';
import PDFLinkAnnotation from './PDFLinkAnnotation.js';
import PDFTextMarkupAnnotation from './PDFTextMarkupAnnotation.js';

function getSubtype(dict: PDFDict): AnnotationTypes | undefined {
  const subtypePdfName = dict.lookup(PDFName.of('Subtype'), PDFName);
  if (subtypePdfName instanceof PDFName) {
    return subtypePdfName.toString() as AnnotationTypes;
  } else {
    return;
  }
}

function fromDict(dict: PDFDict): PDFAnnotation {
  switch (getSubtype(dict)) {
    case AnnotationTypes.Link:
      return PDFLinkAnnotation.fromDict(dict);
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
