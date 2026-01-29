import PDFArray from './objects/PDFArray.js';
import PDFDict from './objects/PDFDict.js';
import PDFName from './objects/PDFName.js';
import PDFRef from './objects/PDFRef.js';
import PDFStream from './objects/PDFStream.js';
import PDFPageLeaf from './structures/PDFPageLeaf.js';
import { analyzePageResources, filterResources, } from './utils/ContentStreamResourceAnalyzer.js';
/**
 * PDFObjectCopier copies PDFObjects from a src context to a dest context.
 * The primary use case for this is to copy pages between PDFs.
 *
 * _Copying_ an object with a PDFObjectCopier is different from _cloning_ an
 * object with its [[PDFObject.clone]] method:
 *
 * ```
 *   const src: PDFContext = ...
 *   const dest: PDFContext = ...
 *   const originalObject: PDFObject = ...
 *   const copiedObject = PDFObjectCopier.for(src, dest).copy(originalObject);
 *   const clonedObject = originalObject.clone();
 * ```
 *
 * Copying an object is equivalent to cloning it and then copying over any other
 * objects that it references. Note that only dictionaries, arrays, and streams
 * (or structures build from them) can contain indirect references to other
 * objects. Copying a PDFObject that is not a dictionary, array, or stream is
 * supported, but is equivalent to cloning it.
 */
class PDFObjectCopier {
    static for = (src, dest, options) => new PDFObjectCopier(src, dest, options);
    src;
    dest;
    traversedObjects = new Map();
    options;
    constructor(src, dest, options) {
        this.src = src;
        this.dest = dest;
        this.options = options || {};
    }
    // prettier-ignore
    copy = (object) => (object instanceof PDFPageLeaf
        ? this.copyPDFPage(object)
        : object instanceof PDFDict
            ? this.copyPDFDict(object)
            : object instanceof PDFArray
                ? this.copyPDFArray(object)
                : object instanceof PDFStream
                    ? this.copyPDFStream(object)
                    : object instanceof PDFRef
                        ? this.copyPDFIndirectObject(object)
                        : object.clone());
    copyPDFPage = (originalPage) => {
        const clonedPage = originalPage.clone();
        // Move any entries that the originalPage is inheriting from its parent
        // tree nodes directly into originalPage so they are preserved during
        // the copy.
        const { InheritableEntries } = PDFPageLeaf;
        for (let idx = 0, len = InheritableEntries.length; idx < len; idx++) {
            const key = PDFName.of(InheritableEntries[idx]);
            const value = clonedPage.getInheritableAttribute(key);
            if (!clonedPage.get(key) && value)
                clonedPage.set(key, value);
        }
        // Optimize resources if requested - analyze content streams to find
        // which resources are actually used and filter out unused ones.
        // This fixes issue #1338 where copying pages from documents with many
        // shared resources causes file size explosion.
        if (this.options.optimizeResources) {
            const usedResources = analyzePageResources(originalPage, this.src);
            if (usedResources) {
                const resources = originalPage.Resources();
                if (resources) {
                    const filteredResources = filterResources(resources, usedResources, this.src);
                    clonedPage.set(PDFName.Resources, filteredResources);
                }
            }
        }
        // Remove the parent reference to prevent the whole donor document's page
        // tree from being copied when we only need a single page.
        clonedPage.delete(PDFName.of('Parent'));
        return this.copyPDFDict(clonedPage);
    };
    copyPDFDict = (originalDict) => {
        if (this.traversedObjects.has(originalDict)) {
            return this.traversedObjects.get(originalDict);
        }
        const clonedDict = originalDict.clone(this.dest);
        this.traversedObjects.set(originalDict, clonedDict);
        const entries = originalDict.entries();
        for (let idx = 0, len = entries.length; idx < len; idx++) {
            const [key, value] = entries[idx];
            clonedDict.set(key, this.copy(value));
        }
        return clonedDict;
    };
    copyPDFArray = (originalArray) => {
        if (this.traversedObjects.has(originalArray)) {
            return this.traversedObjects.get(originalArray);
        }
        const clonedArray = originalArray.clone(this.dest);
        this.traversedObjects.set(originalArray, clonedArray);
        for (let idx = 0, len = originalArray.size(); idx < len; idx++) {
            const value = originalArray.get(idx);
            clonedArray.set(idx, this.copy(value));
        }
        return clonedArray;
    };
    copyPDFStream = (originalStream) => {
        if (this.traversedObjects.has(originalStream)) {
            return this.traversedObjects.get(originalStream);
        }
        const clonedStream = originalStream.clone(this.dest);
        this.traversedObjects.set(originalStream, clonedStream);
        const entries = originalStream.dict.entries();
        for (let idx = 0, len = entries.length; idx < len; idx++) {
            const [key, value] = entries[idx];
            clonedStream.dict.set(key, this.copy(value));
        }
        return clonedStream;
    };
    copyPDFIndirectObject = (ref) => {
        const alreadyMapped = this.traversedObjects.has(ref);
        if (!alreadyMapped) {
            const newRef = this.dest.nextRef();
            this.traversedObjects.set(ref, newRef);
            const dereferencedValue = this.src.lookup(ref);
            if (dereferencedValue) {
                const cloned = this.copy(dereferencedValue);
                this.dest.assign(newRef, cloned);
            }
        }
        return this.traversedObjects.get(ref);
    };
}
export default PDFObjectCopier;
//# sourceMappingURL=PDFObjectCopier.js.map