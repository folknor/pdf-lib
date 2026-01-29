import PDFArray from '../objects/PDFArray.js';
import PDFDict from '../objects/PDFDict.js';
import PDFHexString from '../objects/PDFHexString.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import type PDFObject from '../objects/PDFObject.js';
import PDFRef from '../objects/PDFRef.js';
import PDFString from '../objects/PDFString.js';
declare class PDFAcroField {
    readonly dict: PDFDict;
    readonly ref: PDFRef;
    protected constructor(dict: PDFDict, ref: PDFRef);
    T(): PDFString | PDFHexString | undefined;
    Ff(): PDFNumber | undefined;
    V(): PDFObject | undefined;
    Kids(): PDFArray | undefined;
    DA(): PDFString | PDFHexString | undefined;
    setKids(kids: PDFObject[]): void;
    getParent(): PDFAcroField | undefined;
    setParent(parent: PDFRef | undefined): void;
    getFullyQualifiedName(): string | undefined;
    getPartialName(): string | undefined;
    setPartialName(partialName: string | undefined): void;
    setDefaultAppearance(appearance: string): void;
    getDefaultAppearance(): string | undefined;
    /**
     * Get the font name from the default appearance (DA) string.
     * @returns The font name (e.g., "Helv", "F1") or undefined if not found.
     */
    getDefaultAppearanceFontName(): string | undefined;
    /**
     * Get the font size from the default appearance (DA) string.
     * @returns The font size or undefined if not found.
     */
    getDefaultAppearanceFontSize(): number | undefined;
    setFontSize(fontSize: number): void;
    getFlags(): number;
    setFlags(flags: number): void;
    hasFlag(flag: number): boolean;
    setFlag(flag: number): void;
    clearFlag(flag: number): void;
    setFlagTo(flag: number, enable: boolean): void;
    getInheritableAttribute(name: PDFName): PDFObject | undefined;
    ascend(visitor: (node: PDFAcroField) => any): void;
}
export default PDFAcroField;
//# sourceMappingURL=PDFAcroField.d.ts.map