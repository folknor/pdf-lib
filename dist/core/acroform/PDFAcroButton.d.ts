import PDFArray from '../objects/PDFArray.js';
import PDFHexString from '../objects/PDFHexString.js';
import PDFName from '../objects/PDFName.js';
import type PDFObject from '../objects/PDFObject.js';
import type PDFRef from '../objects/PDFRef.js';
import PDFString from '../objects/PDFString.js';
import PDFAcroTerminal from './PDFAcroTerminal.js';
declare class PDFAcroButton extends PDFAcroTerminal {
    Opt(): PDFString | PDFHexString | PDFArray | undefined;
    setOpt(opt: PDFObject[]): void;
    getExportValues(): (PDFString | PDFHexString)[] | undefined;
    removeExportValue(idx: number): void;
    normalizeExportValues(): void;
    /**
     * Reuses existing opt if one exists with the same value (assuming
     * `useExistingIdx` is `true`). Returns index of existing (or new) opt.
     */
    addOpt(opt: PDFHexString | PDFString, useExistingOptIdx: boolean): number;
    addWidgetWithOpt(widget: PDFRef, opt: PDFHexString | PDFString, useExistingOptIdx: boolean): PDFName;
}
export default PDFAcroButton;
//# sourceMappingURL=PDFAcroButton.d.ts.map