import type PDFArray from '../objects/PDFArray.js';
import type PDFHexString from '../objects/PDFHexString.js';
import type PDFName from '../objects/PDFName.js';
import type PDFNumber from '../objects/PDFNumber.js';
import type PDFString from '../objects/PDFString.js';
import type PDFContext from '../PDFContext.js';
import type PDFOperatorNames from './PDFOperatorNames.js';
export type PDFOperatorArg = string | PDFName | PDFArray | PDFNumber | PDFString | PDFHexString;
declare class PDFOperator {
    static of: (name: PDFOperatorNames, args?: PDFOperatorArg[]) => PDFOperator;
    private readonly name;
    private readonly args;
    private constructor();
    clone(context?: PDFContext): PDFOperator;
    toString(): string;
    sizeInBytes(): number;
    copyBytesInto(buffer: Uint8Array, offset: number): number;
}
export default PDFOperator;
//# sourceMappingURL=PDFOperator.d.ts.map