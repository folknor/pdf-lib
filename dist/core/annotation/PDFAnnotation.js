import PDFArray from '../objects/PDFArray.js';
import PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import PDFRef from '../objects/PDFRef.js';
import PDFStream from '../objects/PDFStream.js';
import PDFString from '../objects/PDFString.js';
import PDFPageLeaf from '../structures/PDFPageLeaf.js';
class PDFAnnotation {
    dict;
    static fromDict = (dict) => new PDFAnnotation(dict);
    static createBase = (context, page, options) => {
        // Create the minimal base annotation dictionary first
        const dict = context.obj({
            Type: 'Annot',
            // Remove leading '/' from the subtype string (if present)
            Subtype: options.subtype.toString().replace(/\//g, ''),
            Rect: [
                options.rect.x,
                options.rect.y,
                options.rect.x + options.rect.width,
                options.rect.y + options.rect.height,
            ],
        });
        const annotation = new PDFAnnotation(dict);
        if (options.contents !== undefined) {
            annotation.setContents(options.contents);
        }
        if (options.name !== undefined)
            annotation.setIdentifier(options.name);
        annotation.setPage(page, context);
        if (options.flags !== undefined)
            annotation.setFlags(options.flags);
        if (options.color !== undefined)
            annotation.setColor(options.color);
        if (options.border !== undefined)
            annotation.setBorder(options.border);
        if (options.modificationDate !== undefined) {
            annotation.setModificationDate(options.modificationDate);
        }
        return annotation;
    };
    constructor(dict) {
        this.dict = dict;
    }
    // entries common to all annotation dictionaries (See table 164)
    /**
     * annotation subtype
     * @returns The subtype as a PDFName or undefined if none.
     */
    Subtype() {
        return this.dict.lookup(PDFName.of('Subtype'), PDFName);
    }
    /**
     * location of annotation on page
     * @returns The rectangle as a PDFArray or undefined if none.
     */
    Rect() {
        return this.dict.lookup(PDFName.of('Rect'), PDFArray);
    }
    /**
     * text to be displayed for the annotation.
     * @returns The text as a PDFString or undefined if none content)
     */
    Contents() {
        return this.dict.lookup(PDFName.of('Contents'), PDFString);
    }
    /**
     * Indirect reference to the page object with which this annotation is associated.
     * @returns The page object as a PDFRef or undefined if none.
     */
    P() {
        const ref = this.dict.get(PDFName.of('P'));
        return ref instanceof PDFRef ? ref : undefined;
    }
    /**
     * Name of the annotation, typically an identifier.
     * @returns The name as a PDFString or undefined if none.
     */
    NM() {
        return this.dict.lookup(PDFName.of('NM'), PDFString);
    }
    /**
     * Date and time when the annotation was created.
     * @returns The date as a PDFString or undefined if none.
     */
    M() {
        return this.dict.lookup(PDFName.of('M'), PDFString);
    }
    /**
     * A set of flags specifying various characteristics of the annotation.
     * @returns The flags as a PDFNumber or undefined if none.
     */
    F() {
        const numberOrRef = this.dict.lookup(PDFName.of('F'));
        return this.dict.context.lookupMaybe(numberOrRef, PDFNumber);
    }
    /**
     * appearance dictionary
     * @returns The appearance dictionary as a PDFDict or undefined if none.
     */
    AP() {
        return this.dict.lookupMaybe(PDFName.of('AP'), PDFDict);
    }
    /**
     * Annotation's appearance state
     * @returns The appearance state as a PDFName or undefined if none.
     */
    AS() {
        return this.dict.lookupMaybe(PDFName.of('AS'), PDFName);
    }
    /**
     * Array specifying annotation's border characteristics
     * @returns The border characteristics as a PDFArray or undefined if none.
     */
    Border() {
        return this.dict.lookup(PDFName.of('Border'), PDFArray);
    }
    /**
     * The annotation's color
     * @returns The color as a PDFArray or undefined if none.
     */
    C() {
        return this.dict.lookup(PDFName.of('C'), PDFArray);
    }
    /**
     * Integer key of annotation's entry in structural parent tree
     * @returns
     */
    StructParent() {
        return this.dict.lookup(PDFName.of('StructParent'), PDFNumber);
    }
    /**
     * Optional content group or optional content membership dictionary
     * @returns The optional content group as a PDFDict or undefined if none.
     */
    OC() {
        return this.dict.lookup(PDFName.of('OC'), PDFDict);
    }
    /**
     * Get the subtype enum.
     * This gives `undefined` if the subtype not written in the PDF.
     * @returns The subtype as AnnotationTypes or undefined
     */
    getSubtype() {
        const subtypePdfName = this.Subtype();
        if (subtypePdfName instanceof PDFName) {
            return subtypePdfName.toString();
        }
        return;
    }
    getRectangle() {
        const Rect = this.Rect();
        return Rect?.asRectangle() ?? { x: 0, y: 0, width: 0, height: 0 };
    }
    getAppearanceState() {
        const AS = this.dict.lookup(PDFName.of('AS'));
        if (AS instanceof PDFName)
            return AS;
        return;
    }
    ensureAP() {
        let AP = this.AP();
        if (!AP) {
            AP = this.dict.context.obj({});
            this.dict.set(PDFName.of('AP'), AP);
        }
        return AP;
    }
    getNormalAppearance() {
        const AP = this.AP();
        if (!AP)
            return;
        const N = AP.get(PDFName.of('N'));
        if (N instanceof PDFRef || N instanceof PDFDict)
            return N;
        return;
    }
    removeRolloverAppearance() {
        const AP = this.AP();
        AP?.delete(PDFName.of('R'));
    }
    removeDownAppearance() {
        const AP = this.AP();
        AP?.delete(PDFName.of('D'));
    }
    getAppearances() {
        const AP = this.AP();
        if (!AP)
            return;
        const N = AP.lookupMaybe(PDFName.of('N'), PDFDict, PDFStream);
        const R = AP.lookupMaybe(PDFName.of('R'), PDFDict, PDFStream);
        const D = AP.lookupMaybe(PDFName.of('D'), PDFDict, PDFStream);
        // Normal appearance is required, return undefined if missing
        if (!N)
            return;
        return { normal: N, rollover: R, down: D };
    }
    getFlags() {
        return this.F()?.asNumber() ?? 0;
    }
    hasFlag(flag) {
        const flags = this.getFlags();
        return (flags & flag) !== 0;
    }
    getParentPage() {
        const pageRef = this.P();
        if (!pageRef)
            return;
        const page = this.dict.context.lookup(pageRef);
        if (page instanceof PDFPageLeaf) {
            return page;
        }
        return;
    }
    // Setter methods
    setRectangle(rect) {
        const { x, y, width, height } = rect;
        const Rect = this.dict.context.obj([x, y, x + width, y + height]);
        this.dict.set(PDFName.of('Rect'), Rect);
    }
    setAppearanceState(state) {
        this.dict.set(PDFName.of('AS'), state);
    }
    setAppearances(appearances) {
        this.dict.set(PDFName.of('AP'), appearances);
    }
    /** @param appearance A PDFDict or PDFStream (direct or ref) */
    setNormalAppearance(appearance) {
        const AP = this.ensureAP();
        AP.set(PDFName.of('N'), appearance);
    }
    /** @param appearance A PDFDict or PDFStream (direct or ref) */
    setRolloverAppearance(appearance) {
        const AP = this.ensureAP();
        AP.set(PDFName.of('R'), appearance);
    }
    /** @param appearance A PDFDict or PDFStream (direct or ref) */
    setDownAppearance(appearance) {
        const AP = this.ensureAP();
        AP.set(PDFName.of('D'), appearance);
    }
    setFlags(flags) {
        this.dict.set(PDFName.of('F'), PDFNumber.of(flags));
    }
    setFlag(flag) {
        const flags = this.getFlags();
        this.setFlags(flags | flag);
    }
    clearFlag(flag) {
        const flags = this.getFlags();
        this.setFlags(flags & ~flag);
    }
    setFlagTo(flag, enable) {
        if (enable)
            this.setFlag(flag);
        else
            this.clearFlag(flag);
    }
    setContents(contents) {
        this.dict.set(PDFName.of('Contents'), PDFString.of(contents));
    }
    setPage(page, context) {
        // Set the page reference by getting the PDFRef for the PDFPageLeaf
        const pageRef = context.getObjectRef(page);
        if (!pageRef) {
            throw new Error('Could not find PDFRef for the provided PDFPageLeaf. The page must be registered in the PDF context.');
        }
        this.dict.set(PDFName.of('P'), pageRef);
    }
    setIdentifier(name) {
        this.dict.set(PDFName.of('NM'), PDFString.of(name));
    }
    setModificationDate(date) {
        this.dict.set(PDFName.of('M'), PDFString.fromDate(date));
    }
    setBorder(border) {
        this.dict.set(PDFName.of('Border'), this.dict.context.obj(border));
    }
    setColor(color) {
        this.dict.set(PDFName.of('C'), this.dict.context.obj(color));
    }
}
export default PDFAnnotation;
//# sourceMappingURL=PDFAnnotation.js.map