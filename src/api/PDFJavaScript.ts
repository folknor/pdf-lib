import type JavaScriptEmbedder from "../core/embedders/JavaScriptEmbedder.js";
import { PDFHexString, PDFName, type PDFRef } from "../core/index.js";
import { collectUnreferenced } from "./detach.js";
import type Embeddable from "./Embeddable.js";
import { checkCatalogNameUnused, insertIntoCatalogNameTree } from "./nameTree.js";
import type PDFDocument from "./PDFDocument.js";

/**
 * Represents JavaScript that has been embedded in a [[PDFDocument]].
 */
export default class PDFJavaScript implements Embeddable {
  /**
   * > **NOTE:** You probably don't want to call this method directly. Instead,
   * > consider using the [[PDFDocument.addJavaScript]] method, which will
   * create instances of [[PDFJavaScript]] for you.
   *
   * Create an instance of [[PDFJavaScript]] from an existing ref and script
   *
   * @param ref The unique reference for this script.
   * @param doc The document to which the script will belong.
   * @param embedder The embedder that will be used to embed the script.
   */
  static of = (ref: PDFRef, doc: PDFDocument, embedder: JavaScriptEmbedder) =>
    new PDFJavaScript(ref, doc, embedder);

  /** The unique reference assigned to this embedded script within the document. */
  readonly ref: PDFRef;

  /** The document to which this embedded script belongs. */
  readonly doc: PDFDocument;

  private alreadyEmbedded = false;
  private readonly embedder: JavaScriptEmbedder;

  private constructor(ref: PDFRef, doc: PDFDocument, embedder: JavaScriptEmbedder) {
    this.ref = ref;
    this.doc = doc;
    this.embedder = embedder;
  }

  /**
   * > **NOTE:** You probably don't need to call this method directly. The
   * > [[PDFDocument.save]] and [[PDFDocument.saveAsBase64]] methods will
   * > automatically ensure all JavaScripts get embedded.
   *
   * Embed this JavaScript in its document.
   *
   * @returns Resolves when the embedding is complete.
   */
  async embed(): Promise<void> {
    if (!this.alreadyEmbedded) {
      const { catalog, context } = this.doc;
      const JavaScript = PDFName.of("JavaScript");

      // Flat or /Kids; a tree this library cannot edit safely, or one
      // already holding a script of this name, throws before anything is
      // made, and again after the await (taking back the action just made),
      // so a refusal leaves nothing behind.
      const { scriptName } = this.embedder;
      checkCatalogNameUnused(catalog, JavaScript, scriptName);
      const ref = await this.embedder.embedIntoContext(context, this.ref);

      try {
        checkCatalogNameUnused(catalog, JavaScript, scriptName);
      } catch (error) {
        collectUnreferenced(context, [ref]);
        throw error;
      }

      collectUnreferenced(
        context,
        insertIntoCatalogNameTree(
          context,
          catalog,
          JavaScript,
          PDFHexString.fromText(scriptName),
          ref,
        ),
      );

      this.alreadyEmbedded = true;
    }
  }

  /** The embedder used to embed the script. */
  getEmbedder() {
    return this.embedder;
  }

  /** Whether this script has already been embedded. */
  getAlreadyEmbedded() {
    return this.alreadyEmbedded;
  }
}
