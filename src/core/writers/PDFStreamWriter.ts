import type { DocumentSnapshot } from '../../api/snapshot/index.js';
import { defaultDocumentSnapshot } from '../../api/snapshot/index.js';
import { last, waitForTick } from '../../utils/index.js';
import PDFTrailer from '../document/PDFTrailer.js';
import { assertPDFAWrite } from '../metadata/pdfa.js';
import PDFDict from '../objects/PDFDict.js';
import PDFInvalidObject from '../objects/PDFInvalidObject.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import type PDFObject from '../objects/PDFObject.js';
import PDFRef from '../objects/PDFRef.js';
import PDFStream from '../objects/PDFStream.js';
import type PDFContext from '../PDFContext.js';
import { isSignatureDict } from '../security/PDFSecurity.js';
import PDFCatalog from '../structures/PDFCatalog.js';
import PDFCrossRefStream from '../structures/PDFCrossRefStream.js';
import PDFObjectStream from '../structures/PDFObjectStream.js';
import PDFPageLeaf from '../structures/PDFPageLeaf.js';
import PDFPageTree from '../structures/PDFPageTree.js';
import PDFWriter, { writeEncryption } from './PDFWriter.js';

class PDFStreamWriter extends PDFWriter {
  static override forContext = (
    context: PDFContext,
    objectsPerTick: number,
    encodeStreams = true,
    objectsPerStream = 50,
    compress = false,
  ) =>
    new PDFStreamWriter(
      context,
      objectsPerTick,
      defaultDocumentSnapshot,
      encodeStreams,
      objectsPerStream,
      compress,
    );

  static override forContextWithSnapshot = (
    context: PDFContext,
    objectsPerTick: number,
    snapshot: DocumentSnapshot,
    encodeStreams = true,
    objectsPerStream = 50,
    compress = false,
  ) =>
    new PDFStreamWriter(
      context,
      objectsPerTick,
      snapshot,
      encodeStreams,
      objectsPerStream,
      compress,
    );

  private readonly encodeStreams: boolean;
  private readonly objectsPerStream: number;

  private constructor(
    context: PDFContext,
    objectsPerTick: number,
    snapshot: DocumentSnapshot,
    encodeStreams: boolean,
    objectsPerStream: number,
    compress: boolean,
  ) {
    super(context, objectsPerTick, snapshot, compress);

    this.encodeStreams = encodeStreams;
    this.objectsPerStream = objectsPerStream;
  }

  /**
   * The object streams and the xref stream get numbers above the context's
   * largestObjectNumber, allocated here and never registered: a save leaves
   * the document's objects, numbering and snapshot as they were, so later
   * edits see the document they would have seen without it. Only commit()
   * reserves the numbers (via highestObjectNumber), because only there do
   * the written bytes become the base of the next revision.
   */
  protected override async computeBufferSize(incremental: boolean) {
    this._largestSkippedObjectNum = 0;
    let nextObjectNumber = this.context.largestObjectNumber;
    const allocateRef = () => PDFRef.of(++nextObjectNumber);
    this.encryption = writeEncryption(this.context, this.snapshot, incremental);
    assertPDFAWrite(this.context, {
      encrypted: this.encryption.Encrypt !== undefined,
      objectStreams: true,
      incremental,
    });
    const security = this.encryption.encryptor;
    // Use the header from the parsed PDF context to preserve the original version
    const header = this.context.header;

    let size = this.snapshot.pdfSize;
    if (!incremental) {
      size += header.sizeInBytes() + 1;
    }
    size += 1;

    const xrefStream = PDFCrossRefStream.create(
      this.createTrailerDict(),
      this.encodeStreams,
    );

    const uncompressedObjects: [PDFRef, PDFObject][] = [];
    const compressedObjects: [PDFRef, PDFObject][][] = [];
    const objectStreamRefs: PDFRef[] = [];

    const indirectObjects = this.context.enumerateIndirectObjects();
    for (let idx = 0, len = indirectObjects.length; idx < len; idx++) {
      const indirectObject = indirectObjects[idx]!;
      const [ref, object] = indirectObject;
      // The body is chosen here and only here; serializeToBuffer writes
      // exactly this list at the offsets recorded below.
      if (!this.shouldSave(incremental, ref.objectNumber, object)) {
        continue;
      }
      if (!incremental && this.shouldSkipCopiedObjectStream(object)) {
        continue;
      }

      const shouldNotCompress =
        ref === this.context.trailerInfo.Encrypt ||
        object instanceof PDFStream ||
        object instanceof PDFInvalidObject ||
        object instanceof PDFCatalog ||
        object instanceof PDFPageTree ||
        object instanceof PDFPageLeaf ||
        ref.generationNumber !== 0 ||
        // Signature and document timestamp dicts must stay top-level objects
        // so their /Contents byte ranges can be located and filled in.
        (object instanceof PDFDict && isSignatureDict(object));

      if (shouldNotCompress) {
        if (this.shouldCompress) this.compress(object);
        const written: [PDFRef, PDFObject] = [
          ref,
          security ? security.encryptIndirectObject(ref, object) : object,
        ];
        uncompressedObjects.push(written);
        xrefStream.addUncompressedEntry(ref, size);
        size += this.computeIndirectObjectSize(written);
        if (this.shouldWaitForTick(1)) await waitForTick();
      } else {
        let chunk = last(compressedObjects);
        let objectStreamRef = last(objectStreamRefs);
        if (!chunk || chunk.length % this.objectsPerStream === 0) {
          chunk = [];
          compressedObjects.push(chunk);
          objectStreamRef = allocateRef();
          objectStreamRefs.push(objectStreamRef);
        }
        xrefStream.addCompressedEntry(ref, objectStreamRef!, chunk.length);
        chunk.push(indirectObject);
      }
    }

    for (let idx = 0, len = compressedObjects.length; idx < len; idx++) {
      const chunk = compressedObjects[idx]!;
      const ref = objectStreamRefs[idx]!;

      const objectStream = PDFObjectStream.withContextAndObjects(
        this.context,
        chunk,
        this.encodeStreams,
      );

      // Members are written in clear inside the container; encrypting the
      // container covers them.
      const written: [PDFRef, PDFObject] = [
        ref,
        security
          ? security.encryptIndirectObject(ref, objectStream)
          : objectStream,
      ];

      xrefStream.addUncompressedEntry(ref, size);
      size += this.computeIndirectObjectSize(written);

      uncompressedObjects.push(written);

      if (this.shouldWaitForTick(chunk.length)) await waitForTick();
    }

    const xrefStreamRef = allocateRef();
    this.highestObjectNumber = xrefStreamRef.objectNumber;
    xrefStream.dict.set(
      PDFName.of('Size'),
      PDFNumber.of(xrefStreamRef.objectNumber + 1),
    );
    if (this.snapshot.prevStartXRef) {
      xrefStream.dict.set(
        PDFName.of('Prev'),
        PDFNumber.of(this.snapshot.prevStartXRef),
      );
    }
    xrefStream.addUncompressedEntry(xrefStreamRef, size);
    const xrefOffset = size;
    size += this.computeIndirectObjectSize([xrefStreamRef, xrefStream]);

    uncompressedObjects.push([xrefStreamRef, xrefStream]);

    const trailer = PDFTrailer.forLastCrossRefSectionOffset(xrefOffset);
    size += trailer.sizeInBytes();
    size -= this.snapshot.pdfSize;

    return { size, header, indirectObjects: uncompressedObjects, trailer };
  }
}

export default PDFStreamWriter;
