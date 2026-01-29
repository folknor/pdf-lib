import PDFWidgetAnnotation from '../annotation/PDFWidgetAnnotation.js';
import PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import type PDFRef from '../objects/PDFRef.js';
import PDFAcroField from './PDFAcroField.js';
declare class PDFAcroTerminal extends PDFAcroField {
    static fromDict: (dict: PDFDict, ref: PDFRef) => PDFAcroTerminal;
    FT(): PDFName;
    getWidgets(): PDFWidgetAnnotation[];
    addWidget(ref: PDFRef): void;
    removeWidget(idx: number): void;
    normalizedEntries(): {
        Kids: import("../index.js").PDFArray;
    };
}
export default PDFAcroTerminal;
//# sourceMappingURL=PDFAcroTerminal.d.ts.map