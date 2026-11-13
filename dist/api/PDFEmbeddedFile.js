import { PDFArray, PDFDict, PDFHexString, PDFName, } from '../core/index.js';
import { addNameTreeEntry } from './nameTree.js';
/**
 * Represents a file that has been embedded in a [[PDFDocument]].
 */
export default class PDFEmbeddedFile {
    /**
     * > **NOTE:** You probably don't want to call this method directly. Instead,
     * > consider using the [[PDFDocument.attach]] method, which will create
     * instances of [[PDFEmbeddedFile]] for you.
     *
     * Create an instance of [[PDFEmbeddedFile]] from an existing ref and embedder
     *
     * @param ref The unique reference for this file.
     * @param doc The document to which the file will belong.
     * @param embedder The embedder that will be used to embed the file.
     */
    static of = (ref, doc, embedder) => new PDFEmbeddedFile(ref, doc, embedder);
    /** The unique reference assigned to this embedded file within the document. */
    ref;
    /** The document to which this embedded file belongs. */
    doc;
    alreadyEmbedded = false;
    embedder;
    constructor(ref, doc, embedder) {
        this.ref = ref;
        this.doc = doc;
        this.embedder = embedder;
    }
    /**
     * > **NOTE:** You probably don't need to call this method directly. The
     * > [[PDFDocument.save]] and [[PDFDocument.saveAsBase64]] methods will
     * > automatically ensure all embeddable files get embedded.
     *
     * Embed this embeddable file in its document.
     *
     * @returns Resolves when the embedding is complete.
     */
    async embed() {
        if (!this.alreadyEmbedded) {
            const ref = await this.embedder.embedIntoContext(this.doc.context, this.ref);
            let Names = this.doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
            if (!Names) {
                Names = this.doc.context.obj({});
                this.doc.catalog.set(PDFName.of('Names'), Names);
            }
            let EmbeddedFiles = Names.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict);
            if (!EmbeddedFiles) {
                EmbeddedFiles = this.doc.context.obj({});
                Names.set(PDFName.of('EmbeddedFiles'), EmbeddedFiles);
            }
            // PDF spec requires the Names array to be sorted in byte (lexical)
            // order; readers binary-search it. Flat `/Names` only - `/Kids` (and
            // other incompatible) trees are left alone rather than corrupted.
            addNameTreeEntry(EmbeddedFiles, PDFHexString.fromText(this.embedder.fileName), ref);
            /**
             * The AF-Tag is needed to achieve PDF-A3 compliance for embedded files
             *
             * The following document outlines the uses cases of the associated files (AF) tag.
             * See:
             * https://www.pdfa.org/wp-content/uploads/2018/10/PDF20_AN002-AF.pdf
             */
            if (!this.doc.catalog.has(PDFName.of('AF'))) {
                this.doc.catalog.set(PDFName.of('AF'), this.doc.context.obj([]));
            }
            const AF = this.doc.catalog.lookup(PDFName.of('AF'), PDFArray);
            AF.push(ref);
            this.alreadyEmbedded = true;
        }
    }
    /**
     * Get the embedder used to embed the file.
     * @returns the embedder.
     */
    getEmbedder() {
        return this.embedder;
    }
    /**
     * Returns whether or not this file has already been embedded.
     * @returns true if the file has already been embedded, false otherwise.
     */
    getAlreadyEmbedded() {
        return this.alreadyEmbedded;
    }
    getRef() {
        return this.ref;
    }
}
//# sourceMappingURL=PDFEmbeddedFile.js.map