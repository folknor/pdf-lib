import type { DocumentSnapshot } from '../api/snapshot/DocumentSnapshot.js';
import { SimpleRNG } from '../utils/rng.js';
import PDFHeader from './document/PDFHeader.js';
import PDFArray from './objects/PDFArray.js';
import PDFBool from './objects/PDFBool.js';
import PDFDict from './objects/PDFDict.js';
import PDFHexString from './objects/PDFHexString.js';
import PDFName from './objects/PDFName.js';
import PDFNull from './objects/PDFNull.js';
import PDFNumber from './objects/PDFNumber.js';
import PDFObject from './objects/PDFObject.js';
import PDFRawStream from './objects/PDFRawStream.js';
import PDFRef from './objects/PDFRef.js';
import PDFStream from './objects/PDFStream.js';
import PDFString from './objects/PDFString.js';
import PDFOperator from './operators/PDFOperator.js';
import type PDFSecurity from './security/PDFSecurity.js';
import PDFContentStream from './structures/PDFContentStream.js';
type LookupKey = PDFRef | PDFObject | undefined;
interface LiteralObject {
    [name: string]: Literal | PDFObject;
}
interface LiteralArray {
    [index: number]: Literal | PDFObject;
}
type Literal = LiteralObject | LiteralArray | string | number | boolean | null | undefined;
interface LiteralConfig {
    deep?: boolean;
    literalRef?: boolean;
    literalStreamDict?: boolean;
    literalString?: boolean;
}
declare class PDFContext {
    isDecrypted: boolean;
    static create: () => PDFContext;
    largestObjectNumber: number;
    header: PDFHeader;
    trailerInfo: {
        Size?: PDFNumber | undefined;
        Root?: PDFObject | undefined;
        Encrypt?: PDFObject | undefined;
        Info?: PDFObject | undefined;
        ID?: PDFObject | undefined;
    };
    rng: SimpleRNG;
    pdfFileDetails: {
        pdfSize: number;
        prevStartXRef: number;
        useObjectStreams: boolean;
        originalBytes?: Uint8Array;
    };
    snapshot?: DocumentSnapshot;
    security?: PDFSecurity;
    private readonly indirectObjects;
    /**
     * Tracks whether new objects have been created (via nextRef/register).
     * When true, enumerateIndirectObjects() will sort by object number.
     * When false, preserves insertion order from parser (fixes #951).
     */
    private needsReordering;
    private pushGraphicsStateContentStreamRef?;
    private popGraphicsStateContentStreamRef?;
    private constructor();
    assign(ref: PDFRef, object: PDFObject): void;
    nextRef(): PDFRef;
    register(object: PDFObject): PDFRef;
    delete(ref: PDFRef): boolean;
    lookupMaybe(ref: LookupKey, type: typeof PDFArray): PDFArray | undefined;
    lookupMaybe(ref: LookupKey, type: typeof PDFBool): PDFBool | undefined;
    lookupMaybe(ref: LookupKey, type: typeof PDFDict): PDFDict | undefined;
    lookupMaybe(ref: LookupKey, type: typeof PDFHexString): PDFHexString | undefined;
    lookupMaybe(ref: LookupKey, type: typeof PDFName): PDFName | undefined;
    lookupMaybe(ref: LookupKey, type: typeof PDFNull): typeof PDFNull | undefined;
    lookupMaybe(ref: LookupKey, type: typeof PDFNumber): PDFNumber | undefined;
    lookupMaybe(ref: LookupKey, type: typeof PDFStream): PDFStream | undefined;
    lookupMaybe(ref: LookupKey, type: typeof PDFRef): PDFRef | undefined;
    lookupMaybe(ref: LookupKey, type: typeof PDFString): PDFString | undefined;
    lookupMaybe(ref: LookupKey, type1: typeof PDFString, type2: typeof PDFHexString): PDFString | PDFHexString | undefined;
    lookup(ref: LookupKey): PDFObject | undefined;
    lookup(ref: LookupKey, type: typeof PDFArray): PDFArray;
    lookup(ref: LookupKey, type: typeof PDFBool): PDFBool;
    lookup(ref: LookupKey, type: typeof PDFDict): PDFDict;
    lookup(ref: LookupKey, type: typeof PDFHexString): PDFHexString;
    lookup(ref: LookupKey, type: typeof PDFName): PDFName;
    lookup(ref: LookupKey, type: typeof PDFNull): typeof PDFNull;
    lookup(ref: LookupKey, type: typeof PDFNumber): PDFNumber;
    lookup(ref: LookupKey, type: typeof PDFStream): PDFStream;
    lookup(ref: LookupKey, type: typeof PDFRef): PDFRef;
    lookup(ref: LookupKey, type: typeof PDFString): PDFString;
    lookup(ref: LookupKey, type1: typeof PDFString, type2: typeof PDFHexString): PDFString | PDFHexString;
    getRef(pdfObject: PDFObject | PDFRef): PDFRef | undefined;
    getObjectRef(pdfObject: PDFObject): PDFRef | undefined;
    enumerateIndirectObjects(): [PDFRef, PDFObject][];
    obj(literal: null | undefined): typeof PDFNull;
    obj(literal: string): PDFName;
    obj(literal: number): PDFNumber;
    obj(literal: boolean): PDFBool;
    obj(literal: LiteralObject): PDFDict;
    obj(literal: LiteralArray): PDFArray;
    getLiteral(obj: PDFArray, cfg?: LiteralConfig): LiteralArray;
    getLiteral(obj: PDFBool, cfg?: LiteralConfig): boolean;
    getLiteral(obj: PDFDict, cfg?: LiteralConfig): LiteralObject;
    getLiteral(obj: PDFHexString, cfg?: LiteralConfig): PDFHexString | string;
    getLiteral(obj: PDFName, cfg?: LiteralConfig): string;
    getLiteral(obj: typeof PDFNull, cfg?: LiteralConfig): null;
    getLiteral(obj: PDFNumber, cfg?: LiteralConfig): number;
    getLiteral(obj: PDFRef, cfg?: LiteralConfig): PDFRef | number;
    getLiteral(obj: PDFStream, cfg?: LiteralConfig): PDFStream | LiteralObject;
    getLiteral(obj: PDFString, cfg?: LiteralConfig): PDFString | string;
    getLiteral(obj: PDFObject, cfg?: LiteralConfig): PDFObject;
    stream(contents: string | Uint8Array, dict?: LiteralObject): PDFRawStream;
    flateStream(contents: string | Uint8Array, dict?: LiteralObject): PDFRawStream;
    contentStream(operators: PDFOperator[], dict?: LiteralObject): PDFContentStream;
    formXObject(operators: PDFOperator[], dict?: LiteralObject): PDFContentStream;
    getPushGraphicsStateContentStream(): PDFRef;
    getPopGraphicsStateContentStream(): PDFRef;
    addRandomSuffix(prefix: string, suffixLength?: number): string;
    /**
     * Marks an object as changed for incremental save tracking.
     * Called by mutable PDFObjects (PDFArray, PDFDict, PDFRawStream) when modified.
     *
     * If the object is a direct indirect object, marks it directly.
     * If nested inside another object, finds and marks the containing indirect object.
     */
    registerObjectChange(obj: PDFObject): void;
    /**
     * Finds the indirect object that contains the target object.
     * Used when a nested object is modified to mark its container for save.
     *
     * Performance: O(n * d) where n = number of indirect objects, d = nesting depth.
     * Only called during modifications, not reads, so typically acceptable.
     * For documents with many objects and frequent nested modifications,
     * consider caching parent references if this becomes a bottleneck.
     */
    private findContainingIndirectObject;
    private objectContains;
}
export default PDFContext;
//# sourceMappingURL=PDFContext.d.ts.map