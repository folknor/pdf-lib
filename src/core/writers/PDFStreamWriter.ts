import { defaultDocumentSnapshot } from '../../api/snapshot/index.js';
import type { DocumentSnapshot } from '../../api/snapshot/index.js';
import { last, waitForTick } from '../../utils/index.js';
import PDFTrailer from '../document/PDFTrailer.js';
import PDFDict from '../objects/PDFDict.js';
import PDFInvalidObject from '../objects/PDFInvalidObject.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import type PDFObject from '../objects/PDFObject.js';
import PDFRef from '../objects/PDFRef.js';
import PDFStream from '../objects/PDFStream.js';
import type PDFContext from '../PDFContext.js';
import PDFCatalog from '../structures/PDFCatalog.js';
import PDFCrossRefStream from '../structures/PDFCrossRefStream.js';
import PDFObjectStream from '../structures/PDFObjectStream.js';
import PDFPageLeaf from '../structures/PDFPageLeaf.js';
import PDFPageTree from '../structures/PDFPageTree.js';
import PDFWriter from './PDFWriter.js';

class PDFStreamWriter extends PDFWriter {
  static override forContext = (
    context: PDFContext,
    objectsPerTick: number,
    encodeStreams = true,
    objectsPerStream = 50,
  ) =>
    new PDFStreamWriter(
      context,
      objectsPerTick,
      defaultDocumentSnapshot,
      encodeStreams,
      objectsPerStream,
    );

  static override forContextWithSnapshot = (
    context: PDFContext,
    objectsPerTick: number,
    snapshot: DocumentSnapshot,
    encodeStreams = true,
    objectsPerStream = 50,
  ) =>
    new PDFStreamWriter(
      context,
      objectsPerTick,
      snapshot,
      encodeStreams,
      objectsPerStream,
    );

  private readonly encodeStreams: boolean;
  private readonly objectsPerStream: number;

  // The process of saving uses references numbers, and creates new indirect objects
  // that need to be deleted after saving
  private _refToDeleteAfterSave = 0;

  private constructor(
    context: PDFContext,
    objectsPerTick: number,
    snapshot: DocumentSnapshot,
    encodeStreams: boolean,
    objectsPerStream: number,
  ) {
    super(context, objectsPerTick, snapshot);

    this.encodeStreams = encodeStreams;
    this.objectsPerStream = objectsPerStream;
  }

  protected override async computeBufferSize(incremental: boolean) {
    this._refToDeleteAfterSave = 0;
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

    const security = this.context.security;

    const indirectObjects = this.context.enumerateIndirectObjects();
    for (let idx = 0, len = indirectObjects.length; idx < len; idx++) {
      const indirectObject = indirectObjects[idx]!;
      const [ref, object] = indirectObject;
      if (!this.snapshot.shouldSave(ref.objectNumber)) {
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
        (object instanceof PDFDict &&
          (object as PDFDict).lookup(PDFName.of('Type')) === PDFName.of('Sig'));

      if (shouldNotCompress) {
        uncompressedObjects.push(indirectObject);
        if (security) this.encrypt(ref, object, security);
        xrefStream.addUncompressedEntry(ref, size);
        size += this.computeIndirectObjectSize(indirectObject);
        if (this.shouldWaitForTick(1)) await waitForTick();
      } else {
        let chunk = last(compressedObjects);
        let objectStreamRef = last(objectStreamRefs);
        if (!chunk || chunk.length % this.objectsPerStream === 0) {
          chunk = [];
          compressedObjects.push(chunk);
          objectStreamRef = this.context.nextRef();
          this._refToDeleteAfterSave += 1;
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
      this.context.assign(ref, objectStream);

      if (security) this.encrypt(ref, objectStream, security);

      xrefStream.addUncompressedEntry(ref, size);
      size += this.computeIndirectObjectSize([ref, objectStream]);

      uncompressedObjects.push([ref, objectStream]);

      if (this.shouldWaitForTick(chunk.length)) await waitForTick();
    }

    const xrefStreamRef = this.context.nextRef();
    this._refToDeleteAfterSave += 1;
    xrefStream.dict.set(
      PDFName.of('Size'),
      PDFNumber.of(this.context.largestObjectNumber + 1),
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

  override async serializeToBuffer(): Promise<Uint8Array> {
    const buffer = await super.serializeToBuffer();
    // Delete xref stream created for saving
    this.context.delete(PDFRef.of(this.context.largestObjectNumber - 1));
    // Fix largestObjectNumbering
    this.context.largestObjectNumber -= this._refToDeleteAfterSave;
    return buffer;
  }
}

export default PDFStreamWriter;
