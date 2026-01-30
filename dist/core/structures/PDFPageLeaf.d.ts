import PDFArray from '../objects/PDFArray.js';
import PDFDict, { type DictMap } from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import type PDFObject from '../objects/PDFObject.js';
import type PDFRef from '../objects/PDFRef.js';
import PDFStream from '../objects/PDFStream.js';
import type PDFContext from '../PDFContext.js';
import type PDFPageTree from './PDFPageTree.js';
declare class PDFPageLeaf extends PDFDict {
    static readonly InheritableEntries: string[];
    static withContextAndParent: (context: PDFContext, parent: PDFRef) => PDFPageLeaf;
    static fromMapWithContext: (map: DictMap, context: PDFContext, autoNormalizeCTM?: boolean) => PDFPageLeaf;
    private normalized;
    private readonly autoNormalizeCTM;
    private constructor();
    clone(context?: PDFContext): PDFPageLeaf;
    Parent(): PDFPageTree | undefined;
    Contents(): PDFStream | PDFArray | undefined;
    Annots(): PDFArray | undefined;
    BleedBox(): PDFArray | undefined;
    TrimBox(): PDFArray | undefined;
    ArtBox(): PDFArray | undefined;
    Resources(): PDFDict | undefined;
    MediaBox(): PDFArray;
    CropBox(): PDFArray | undefined;
    Rotate(): PDFNumber | undefined;
    getInheritableAttribute(name: PDFName): PDFObject | undefined;
    setParent(parentRef: PDFRef): void;
    addContentStream(contentStreamRef: PDFRef): void;
    wrapContentStreams(startStream: PDFRef, endStream: PDFRef): boolean;
    addAnnot(annotRef: PDFRef): void;
    removeAnnot(annotRef: PDFRef): void;
    setFontDictionary(name: PDFName, fontDictRef: PDFRef): void;
    newFontDictionaryKey(tag: string): PDFName;
    /** Find existing key for a font ref, or return undefined */
    findFontKey(fontDictRef: PDFRef): PDFName | undefined;
    newFontDictionary(tag: string, fontDictRef: PDFRef): PDFName;
    /** Get existing key for font ref, or create new entry */
    getOrCreateFontDictionary(tag: string, fontDictRef: PDFRef): PDFName;
    setXObject(name: PDFName, xObjectRef: PDFRef): void;
    newXObjectKey(tag: string): PDFName;
    /** Find existing key for an XObject ref, or return undefined */
    findXObjectKey(xObjectRef: PDFRef): PDFName | undefined;
    newXObject(tag: string, xObjectRef: PDFRef): PDFName;
    /** Get existing key for XObject ref, or create new entry */
    getOrCreateXObject(tag: string, xObjectRef: PDFRef): PDFName;
    setExtGState(name: PDFName, extGStateRef: PDFRef | PDFDict): void;
    newExtGStateKey(tag: string): PDFName;
    /** Find existing key for an ExtGState ref, or return undefined */
    findExtGStateKey(extGStateRef: PDFRef | PDFDict): PDFName | undefined;
    newExtGState(tag: string, extGStateRef: PDFRef | PDFDict): PDFName;
    /** Get existing key for ExtGState ref, or create new entry */
    getOrCreateExtGState(tag: string, extGStateRef: PDFRef | PDFDict): PDFName;
    ascend(visitor: (node: PDFPageTree | PDFPageLeaf) => any): void;
    normalize(): void;
    normalizedEntries(): {
        Annots: PDFArray;
        Resources: PDFDict;
        Contents: PDFArray;
        Font: PDFDict;
        XObject: PDFDict;
        ExtGState: PDFDict;
    };
}
export default PDFPageLeaf;
//# sourceMappingURL=PDFPageLeaf.d.ts.map