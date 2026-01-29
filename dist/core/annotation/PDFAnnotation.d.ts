import type { PDFPageAddAnnotationOptions } from '../../api/PDFPageOptions.js';
import PDFArray from '../objects/PDFArray.js';
import PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import PDFRef from '../objects/PDFRef.js';
import PDFStream from '../objects/PDFStream.js';
import PDFString from '../objects/PDFString.js';
import type PDFContext from '../PDFContext.js';
import PDFPageLeaf from '../structures/PDFPageLeaf.js';
import type { AnnotationTypes } from './AnnotationTypes.js';
declare class PDFAnnotation {
    readonly dict: PDFDict;
    static fromDict: (dict: PDFDict) => PDFAnnotation;
    protected static createBase: (context: PDFContext, page: PDFPageLeaf, options: PDFPageAddAnnotationOptions) => PDFAnnotation;
    protected constructor(dict: PDFDict);
    /**
     * annotation subtype
     * @returns The subtype as a PDFName or undefined if none.
     */
    Subtype(): PDFName | undefined;
    /**
     * location of annotation on page
     * @returns The rectangle as a PDFArray or undefined if none.
     */
    Rect(): PDFArray | undefined;
    /**
     * text to be displayed for the annotation.
     * @returns The text as a PDFString or undefined if none content)
     */
    Contents(): PDFString | undefined;
    /**
     * Indirect reference to the page object with which this annotation is associated.
     * @returns The page object as a PDFRef or undefined if none.
     */
    P(): PDFRef | undefined;
    /**
     * Name of the annotation, typically an identifier.
     * @returns The name as a PDFString or undefined if none.
     */
    NM(): PDFString | undefined;
    /**
     * Date and time when the annotation was created.
     * @returns The date as a PDFString or undefined if none.
     */
    M(): PDFString | undefined;
    /**
     * A set of flags specifying various characteristics of the annotation.
     * @returns The flags as a PDFNumber or undefined if none.
     */
    F(): PDFNumber | undefined;
    /**
     * appearance dictionary
     * @returns The appearance dictionary as a PDFDict or undefined if none.
     */
    AP(): PDFDict | undefined;
    /**
     * Annotation's appearance state
     * @returns The appearance state as a PDFName or undefined if none.
     */
    AS(): PDFName | undefined;
    /**
     * Array specifying annotation's border characteristics
     * @returns The border characteristics as a PDFArray or undefined if none.
     */
    Border(): PDFArray | undefined;
    /**
     * The annotation's color
     * @returns The color as a PDFArray or undefined if none.
     */
    C(): PDFArray | undefined;
    /**
     * Integer key of annotation's entry in structural parent tree
     * @returns
     */
    StructParent(): PDFNumber | undefined;
    /**
     * Optional content group or optional content membership dictionary
     * @returns The optional content group as a PDFDict or undefined if none.
     */
    OC(): PDFDict | undefined;
    /**
     * Get the subtype enum.
     * This gives `undefined` if the subtype not written in the PDF.
     * @returns The subtype as AnnotationTypes or undefined
     */
    getSubtype(): AnnotationTypes | undefined;
    getRectangle(): {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    getAppearanceState(): PDFName | undefined;
    ensureAP(): PDFDict;
    getNormalAppearance(): PDFRef | PDFDict | undefined;
    removeRolloverAppearance(): void;
    removeDownAppearance(): void;
    getAppearances(): {
        normal: PDFStream | PDFDict;
        rollover: PDFStream | PDFDict | undefined;
        down: PDFStream | PDFDict | undefined;
    } | undefined;
    getFlags(): number;
    hasFlag(flag: number): boolean;
    getParentPage(): PDFPageLeaf | undefined;
    setRectangle(rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    }): void;
    setAppearanceState(state: PDFName): void;
    setAppearances(appearances: PDFDict): void;
    /** @param appearance A PDFDict or PDFStream (direct or ref) */
    setNormalAppearance(appearance: PDFRef | PDFDict): void;
    /** @param appearance A PDFDict or PDFStream (direct or ref) */
    setRolloverAppearance(appearance: PDFRef | PDFDict): void;
    /** @param appearance A PDFDict or PDFStream (direct or ref) */
    setDownAppearance(appearance: PDFRef | PDFDict): void;
    setFlags(flags: number): void;
    setFlag(flag: number): void;
    clearFlag(flag: number): void;
    setFlagTo(flag: number, enable: boolean): void;
    setContents(contents: string): void;
    setPage(page: PDFPageLeaf, context: PDFContext): void;
    setIdentifier(name: string): void;
    setModificationDate(date: Date): void;
    setBorder(border: number[]): void;
    setColor(color: number[]): void;
}
export default PDFAnnotation;
//# sourceMappingURL=PDFAnnotation.d.ts.map