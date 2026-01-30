import { zlibSync } from 'fflate';
import type { DocumentSnapshot } from '../../api/snapshot/index.js';
import {
  DefaultDocumentSnapshot,
  defaultDocumentSnapshot,
} from '../../api/snapshot/index.js';
import { copyStringIntoBuffer, waitForTick } from '../../utils/index.js';
import PDFCrossRefSection from '../document/PDFCrossRefSection.js';
import type PDFHeader from '../document/PDFHeader.js';
import PDFTrailer from '../document/PDFTrailer.js';
import PDFTrailerDict from '../document/PDFTrailerDict.js';
import type PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import type PDFObject from '../objects/PDFObject.js';
import PDFRawStream from '../objects/PDFRawStream.js';
import PDFRef from '../objects/PDFRef.js';
import PDFStream from '../objects/PDFStream.js';
import type PDFContext from '../PDFContext.js';
import type PDFSecurity from '../security/PDFSecurity.js';
import PDFObjectStream from '../structures/PDFObjectStream.js';
import CharCodes from '../syntax/CharCodes.js';

export interface SerializationInfo {
  size: number;
  header: PDFHeader;
  indirectObjects: [PDFRef, PDFObject][];
  xref?: PDFCrossRefSection;
  trailerDict?: PDFTrailerDict;
  trailer: PDFTrailer;
}

class PDFWriter {
  static forContext = (
    context: PDFContext,
    objectsPerTick: number,
    compress = false,
  ) =>
    new PDFWriter(context, objectsPerTick, defaultDocumentSnapshot, compress);

  static forContextWithSnapshot = (
    context: PDFContext,
    objectsPerTick: number,
    snapshot: DocumentSnapshot,
    compress = false,
  ) => new PDFWriter(context, objectsPerTick, snapshot, compress);

  protected readonly context: PDFContext;

  protected readonly objectsPerTick: number;
  protected readonly snapshot: DocumentSnapshot;
  protected readonly shouldCompress: boolean;

  /** Set to true to fill xref gaps with deleted entries (prevents fragmentation) */
  public fillXrefGaps: boolean = false;

  private parsedObjects = 0;

  /**
   * If PDF has an XRef Stream, then the last object will be probably be skipped on saving.
   * If that's the case, this property will have that object number, and the PDF /Size can
   * be corrected, to be accurate.
   */
  protected _largestSkippedObjectNum: number = 0;

  protected constructor(
    context: PDFContext,
    objectsPerTick: number,
    snapshot: DocumentSnapshot,
    compress: boolean,
  ) {
    this.context = context;
    this.objectsPerTick = objectsPerTick;
    this.snapshot = snapshot;
    this.shouldCompress = compress;
  }

  /**
   * For incremental saves, defers the decision to the snapshot.
   * For full saves, checks that the object is not an XRef stream object.
   * @param incremental If making an incremental save, or a full save of the PDF
   * @param objNum Object number
   * @param object PDFObject used to check if it is an XRef stream, when not 'incremental' saving
   * @returns whether the object should be saved or not
   */
  protected shouldSave(
    incremental: boolean,
    objNum: number,
    object: PDFObject,
  ): boolean {
    let should = true;
    if (incremental) {
      should = this.snapshot.shouldSave(objNum);
    } else {
      should = !(
        object instanceof PDFRawStream &&
        object.dict.lookup(PDFName.of('Type')) === PDFName.of('XRef')
      );
    }
    if (!should && this._largestSkippedObjectNum < objNum) {
      this._largestSkippedObjectNum = objNum;
    }
    return should;
  }

  async serializeToBuffer(): Promise<Uint8Array<ArrayBuffer>> {
    const incremental = !(this.snapshot instanceof DefaultDocumentSnapshot);
    const { size, header, indirectObjects, xref, trailerDict, trailer } =
      await this.computeBufferSize(incremental);

    let offset = 0;
    const buffer = new Uint8Array(size);

    if (!incremental) {
      offset += header.copyBytesInto(buffer, offset);
      buffer[offset++] = CharCodes.Newline;
    }
    buffer[offset++] = CharCodes.Newline;

    for (let idx = 0, len = indirectObjects.length; idx < len; idx++) {
      const [ref, object] = indirectObjects[idx]!;

      if (!this.shouldSave(incremental, ref.objectNumber, object)) {
        continue;
      }

      const objectNumber = String(ref.objectNumber);
      offset += copyStringIntoBuffer(objectNumber, buffer, offset);
      buffer[offset++] = CharCodes.Space;

      const generationNumber = String(ref.generationNumber);
      offset += copyStringIntoBuffer(generationNumber, buffer, offset);
      buffer[offset++] = CharCodes.Space;

      buffer[offset++] = CharCodes.o;
      buffer[offset++] = CharCodes.b;
      buffer[offset++] = CharCodes.j;
      buffer[offset++] = CharCodes.Newline;

      offset += object.copyBytesInto(buffer, offset);

      buffer[offset++] = CharCodes.Newline;
      buffer[offset++] = CharCodes.e;
      buffer[offset++] = CharCodes.n;
      buffer[offset++] = CharCodes.d;
      buffer[offset++] = CharCodes.o;
      buffer[offset++] = CharCodes.b;
      buffer[offset++] = CharCodes.j;
      buffer[offset++] = CharCodes.Newline;
      buffer[offset++] = CharCodes.Newline;

      const n =
        object instanceof PDFObjectStream ? object.getObjectsCount() : 1;
      if (this.shouldWaitForTick(n)) await waitForTick();
    }

    if (xref) {
      offset += xref.copyBytesInto(buffer, offset);
      buffer[offset++] = CharCodes.Newline;
    }

    if (trailerDict) {
      offset += trailerDict.copyBytesInto(buffer, offset);
      buffer[offset++] = CharCodes.Newline;
      buffer[offset++] = CharCodes.Newline;
    }

    offset += trailer.copyBytesInto(buffer, offset);

    return buffer;
  }

  protected computeIndirectObjectSize([ref, object]: [
    PDFRef,
    PDFObject,
  ]): number {
    const refSize = ref.sizeInBytes() + 3; // 'R' -> 'obj\n'
    const objectSize = object.sizeInBytes() + 9; // '\nendobj\n\n'
    return refSize + objectSize;
  }

  protected createTrailerDict(prevStartXRef?: number): PDFDict {
    /**
     * If last object (XRef Stream) is not in the output, then size is one less.
     * An XRef Stream object should always be the largest object number in PDF
     */
    const size =
      this.context.largestObjectNumber +
      (this._largestSkippedObjectNum === this.context.largestObjectNumber
        ? 0
        : 1);
    return this.context.obj({
      Size: size,
      Root: this.context.trailerInfo.Root,
      Encrypt: this.context.trailerInfo.Encrypt,
      Info: this.context.trailerInfo.Info,
      ID: this.context.trailerInfo.ID,
      Prev: prevStartXRef ? PDFNumber.of(prevStartXRef) : undefined,
    });
  }

  protected async computeBufferSize(
    incremental: boolean,
  ): Promise<SerializationInfo> {
    this._largestSkippedObjectNum = 0;
    // Use the header from the parsed PDF context to preserve the original version
    const header = this.context.header;

    let size = this.snapshot.pdfSize;
    if (!incremental) {
      size += header.sizeInBytes() + 1;
    }
    size += 1;

    const xref = PDFCrossRefSection.create();

    const security = this.context.security;

    const indirectObjects = this.context.enumerateIndirectObjects();

    for (let idx = 0, len = indirectObjects.length; idx < len; idx++) {
      const indirectObject = indirectObjects[idx]!;
      const [ref, object] = indirectObject;
      if (!this.shouldSave(incremental, ref.objectNumber, object)) continue;
      if (this.shouldCompress) this.compress(object);
      if (security) this.encrypt(ref, object, security);
      xref.addEntry(ref, size);
      size += this.computeIndirectObjectSize(indirectObject);
      if (this.shouldWaitForTick(1)) await waitForTick();
    }
    // Deleted objects
    for (let idx = 0; idx < this.snapshot.deletedCount; idx++) {
      const dref = this.snapshot.deletedRef(idx);
      if (!dref) break;
      const nextdref = this.snapshot.deletedRef(idx + 1);
      // Add 1 to generation number for deleted ref
      xref.addDeletedEntry(
        PDFRef.of(dref.objectNumber, dref.generationNumber + 1),
        nextdref ? nextdref.objectNumber : 0,
      );
    }

    // Fill gaps in xref to prevent fragmentation (important for digital signatures)
    if (this.fillXrefGaps) {
      xref.fillGaps();
    }

    const xrefOffset = size;
    size += xref.sizeInBytes() + 1; // '\n'

    const trailerDict = PDFTrailerDict.of(
      this.createTrailerDict(this.snapshot.prevStartXRef),
    );
    size += trailerDict.sizeInBytes() + 2; // '\n\n'

    const trailer = PDFTrailer.forLastCrossRefSectionOffset(xrefOffset);
    size += trailer.sizeInBytes();
    size -= this.snapshot.pdfSize;

    return { size, header, indirectObjects, xref, trailerDict, trailer };
  }

  protected compress(object: PDFObject): void {
    if (!(object instanceof PDFRawStream)) return;

    // Skip if already has a Filter (already compressed)
    const filter = object.dict.get(PDFName.of('Filter'));
    if (filter) return;

    const contents = object.getContents();

    // Skip small streams where compression overhead exceeds benefit
    if (contents.length < 50) return;

    const compressed = zlibSync(contents);

    // Only apply if compression actually reduces size
    if (compressed.length >= contents.length) return;

    object.updateContents(compressed as Uint8Array<ArrayBuffer>);
    object.dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
  }

  protected encrypt(ref: PDFRef, object: PDFObject, security: PDFSecurity) {
    if (object instanceof PDFStream) {
      const encryptFn = security.getEncryptFn(
        ref.objectNumber,
        ref.generationNumber,
      );
      const unencryptedContents = object.getContents();
      const encryptedContents = encryptFn(unencryptedContents);
      object.updateContents(encryptedContents);
    }
  }

  protected shouldWaitForTick = (n: number) => {
    this.parsedObjects += n;
    return this.parsedObjects % this.objectsPerTick === 0;
  };
}

export default PDFWriter;
