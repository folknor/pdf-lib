import type FileEmbedder from '../core/embedders/FileEmbedder.js';
import {
  PDFArray,
  type PDFDict,
  PDFHexString,
  PDFName,
  PDFRef,
} from '../core/index.js';
import { assertPDFAAttachment } from '../core/metadata/pdfa.js';
import { collectUnreferenced } from './detach.js';
import type Embeddable from './Embeddable.js';
import {
  checkCatalogAF,
  checkCatalogNameUnused,
  insertIntoCatalogNameTree,
} from './nameTree.js';
import type PDFDocument from './PDFDocument.js';

const EmbeddedFiles = PDFName.of('EmbeddedFiles');
const AF = PDFName.of('AF');

/**
 * Throw unless an attachment named `name` can be added to `catalog`: its
 * attachments name tree (absent, flat or /Kids) must be strictly well
 * formed and hold no entry of that name, and its /AF absent or an array.
 * Called by [[PDFDocument.attach]] and again when the file is embedded,
 * before anything changes.
 */
export const checkAttachable = (catalog: PDFDict, name: string): void => {
  checkCatalogNameUnused(catalog, EmbeddedFiles, name);
  checkCatalogAF(catalog);
};

/**
 * Represents a file that has been embedded in a [[PDFDocument]].
 */
export default class PDFEmbeddedFile implements Embeddable {
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
  static of = (ref: PDFRef, doc: PDFDocument, embedder: FileEmbedder) =>
    new PDFEmbeddedFile(ref, doc, embedder);

  /** The unique reference assigned to this embedded file within the document. */
  readonly ref: PDFRef;

  /** The document to which this embedded file belongs. */
  readonly doc: PDFDocument;

  private alreadyEmbedded = false;
  private readonly embedder: FileEmbedder;

  private constructor(ref: PDFRef, doc: PDFDocument, embedder: FileEmbedder) {
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
  async embed(): Promise<void> {
    if (this.alreadyEmbedded) return;
    const { catalog, context } = this.doc;
    const { fileName, options } = this.embedder;
    checkAttachable(catalog, fileName);
    assertPDFAAttachment(context, fileName, options);
    const ref = await this.embedder.embedIntoContext(context, this.ref);

    // The catalog, and its PDF/A declaration, may have changed during the
    // await; check again, and on refusal take back the objects just made so
    // nothing is left behind. The embedder's options cannot change.
    try {
      checkAttachable(catalog, fileName);
      assertPDFAAttachment(context, fileName, options);
    } catch (error) {
      collectUnreferenced(context, [ref]);
      throw error;
    }

    // The name tree and /AF are rebuilt copy-on-write and published
    // together, with no await in between.
    const displaced = insertIntoCatalogNameTree(
      context,
      catalog,
      EmbeddedFiles,
      PDFHexString.fromText(fileName),
      ref,
    );

    /**
     * The AF-Tag is needed to achieve PDF-A3 compliance for embedded files
     *
     * The following document outlines the uses cases of the associated files (AF) tag.
     * See:
     * https://www.pdfa.org/wp-content/uploads/2018/10/PDF20_AN002-AF.pdf
     */
    const rawAF = catalog.get(AF);

    if (rawAF instanceof PDFRef) displaced.push(rawAF);
    const oldAF = catalog.lookupMaybe(AF, PDFArray);
    const newAF = context.obj(oldAF ? oldAF.asArray() : []) as PDFArray;
    newAF.push(ref);
    catalog.set(AF, newAF);

    collectUnreferenced(context, displaced);
    this.alreadyEmbedded = true;
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
