import PDFDict from '../objects/PDFDict.js';
import PDFHexString from '../objects/PDFHexString.js';
import PDFName from '../objects/PDFName.js';
import PDFRef from '../objects/PDFRef.js';
import PDFString from '../objects/PDFString.js';
import type PDFContext from '../PDFContext.js';
import AppearanceCharacteristics from './AppearanceCharacteristics.js';
import BorderStyle from './BorderStyle.js';
import PDFAnnotation from './PDFAnnotation.js';
declare class PDFWidgetAnnotation extends PDFAnnotation {
    static fromDict: (dict: PDFDict) => PDFWidgetAnnotation;
    static create: (context: PDFContext, parent: PDFRef) => PDFWidgetAnnotation;
    MK(): PDFDict | undefined;
    BS(): PDFDict | undefined;
    DA(): PDFString | PDFHexString | undefined;
    P(): PDFRef | undefined;
    setP(page: PDFRef): void;
    setDefaultAppearance(appearance: string): void;
    getDefaultAppearance(): string | undefined;
    getAppearanceCharacteristics(): AppearanceCharacteristics | undefined;
    getOrCreateAppearanceCharacteristics(): AppearanceCharacteristics;
    getBorderStyle(): BorderStyle | undefined;
    getOrCreateBorderStyle(): BorderStyle;
    getOnValue(): PDFName | undefined;
}
export default PDFWidgetAnnotation;
//# sourceMappingURL=PDFWidgetAnnotation.d.ts.map