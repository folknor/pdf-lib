import PDFArray from '../objects/PDFArray.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import PDFAnnotation from './PDFAnnotation.js';
export default class PDFTextMarkupAnnotation extends PDFAnnotation {
    static fromDict = (dict) => new PDFTextMarkupAnnotation(dict);
    static create(context, page, options) {
        // Create the base annotation using PDFAnnotation.createBase()
        const baseAnnotation = PDFAnnotation.createBase(context, page, options);
        // Create a new PDFTextMarkupAnnotation with the same dictionary
        const textmarkupAnnotation = new PDFTextMarkupAnnotation(baseAnnotation.dict);
        const quadPointsArray = context.obj([
            options.quadPoints.leftbottomX,
            options.quadPoints.leftbottomY,
            options.quadPoints.rightbottomX,
            options.quadPoints.rightbottomY,
            // NOTE: these order are horizontally inverted with the Spec because of Adobe implementation
            // https://stackoverflow.com/questions/9855814/pdf-spec-vs-acrobat-creation-quadpoints
            options.quadPoints.lefttopX,
            options.quadPoints.lefttopY,
            options.quadPoints.righttopX,
            options.quadPoints.righttopY,
        ].map((point) => PDFNumber.of(point)));
        textmarkupAnnotation.dict.set(PDFName.of('QuadPoints'), quadPointsArray);
        return textmarkupAnnotation;
    }
    QuadPoints() {
        const quadPoints = this.dict.lookup(PDFName.of('QuadPoints'));
        if (quadPoints instanceof PDFArray) {
            const numbers = [];
            for (let idx = 0, len = quadPoints.size(); idx < len; idx++) {
                const num = quadPoints.lookup(idx);
                if (num instanceof PDFNumber) {
                    numbers.push(num);
                }
                else {
                    return undefined;
                }
            }
            return numbers;
        }
        return undefined;
    }
    setQuadPoints(quadOrLeftBottomX, leftBottomY, rightBottomX, rightBottomY, leftTopX, leftTopY, rightTopX, rightTopY) {
        let values;
        if (Array.isArray(quadOrLeftBottomX)) {
            values = quadOrLeftBottomX.slice(0);
        }
        else {
            const coords = [
                quadOrLeftBottomX,
                leftBottomY,
                rightBottomX,
                rightBottomY,
                leftTopX,
                leftTopY,
                rightTopX,
                rightTopY,
            ];
            if (coords.length !== 8 || coords.some((n) => typeof n !== 'number')) {
                throw new Error('setQuadPoints requires either a tuple of 8 numbers or 8 individual number arguments');
            }
            values = coords;
        }
        const quadPointsArray = this.dict.context.obj(values.map((v) => PDFNumber.of(v)));
        this.dict.set(PDFName.of('QuadPoints'), quadPointsArray);
    }
}
//# sourceMappingURL=PDFTextMarkupAnnotation.js.map