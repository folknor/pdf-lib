import type { PDFPageAddTextMarkupAnnotationOptions } from '../../api/PDFPageOptions.js';
import type PDFDict from '../objects/PDFDict.js';
import PDFNumber from '../objects/PDFNumber.js';
import type PDFContext from '../PDFContext.js';
import type PDFPageLeaf from '../structures/PDFPageLeaf.js';
import PDFAnnotation from './PDFAnnotation.js';
export default class PDFTextMarkupAnnotation extends PDFAnnotation {
    static fromDict: (dict: PDFDict) => PDFTextMarkupAnnotation;
    static create(context: PDFContext, page: PDFPageLeaf, options: PDFPageAddTextMarkupAnnotationOptions): PDFTextMarkupAnnotation;
    QuadPoints(): PDFNumber[] | undefined;
    setQuadPoints(quadPoints: [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number
    ]): void;
    setQuadPoints(leftBottomX: number, leftBottomY: number, rightBottomX: number, rightBottomY: number, leftTopX: number, leftTopY: number, rightTopX: number, rightTopY: number): void;
}
//# sourceMappingURL=PDFTextMarkupAnnotation.d.ts.map