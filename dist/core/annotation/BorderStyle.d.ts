import PDFArray from '../objects/PDFArray.js';
import type PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
/**
 * Border style types as defined in the PDF specification.
 * - S: Solid border (default)
 * - D: Dashed border
 * - B: Beveled (3D raised) border
 * - I: Inset (3D depressed) border
 * - U: Underline border
 */
export declare enum BorderStyleType {
    Solid = "S",
    Dashed = "D",
    Beveled = "B",
    Inset = "I",
    Underline = "U"
}
declare class BorderStyle {
    readonly dict: PDFDict;
    static fromDict: (dict: PDFDict) => BorderStyle;
    protected constructor(dict: PDFDict);
    W(): PDFNumber | undefined;
    S(): PDFName | undefined;
    D(): PDFArray | undefined;
    getWidth(): number | undefined;
    setWidth(width: number): void;
    /**
     * Get the border style type.
     * @returns The border style type, defaults to Solid if not specified.
     */
    getStyle(): BorderStyleType;
    /**
     * Set the border style type.
     * @param style The border style to set.
     */
    setStyle(style: BorderStyleType): void;
    /**
     * Get the dash pattern for dashed borders.
     * @returns An array of [dashLength, gapLength] or undefined if not set.
     *          Default is [3] per PDF spec.
     */
    getDashPattern(): number[] | undefined;
    /**
     * Set the dash pattern for dashed borders.
     * @param pattern An array of dash lengths, e.g., [3, 2] for 3-unit dash, 2-unit gap.
     */
    setDashPattern(pattern: number[]): void;
}
export default BorderStyle;
//# sourceMappingURL=BorderStyle.d.ts.map