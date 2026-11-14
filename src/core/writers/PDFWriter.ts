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
import { assertPDFAWrite, isCatalogMetadata } from '../metadata/pdfa.js';
import type PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import type PDFObject from '../objects/PDFObject.js';
import PDFRawStream from '../objects/PDFRawStream.js';
import PDFRef from '../objects/PDFRef.js';
import type PDFContext from '../PDFContext.js';
import PDFXRefChainReader from '../parser/PDFXRefChainReader.js';
import type {
  BaselineEncryption,
  ObjectEncryptor,
} from '../security/PDFSecurity.js';
import { withoutCryptFilter } from '../security/streamCrypt.js';
import PDFObjectStream from '../structures/PDFObjectStream.js';
import CharCodes from '../syntax/CharCodes.js';

export interface FreeEntry {
  /** The freed number with the generation its next use would carry. */
  ref: PDFRef;
  nextFreeObjectNumber: number;
}

/**
 * One disposition per object number, shared by both writers. `inUse` is
 * every ref the writer emits in use; a number may appear there once. A
 * deletion is freed only when no generation of its number is still held by
 * the context (live wins), with its generation raised by one and capped at
 * 65535 (ISO 32000-1 7.5.4: such an entry is never reused). The chain runs
 * in ascending order and ends at 0.
 *
 * The chain covers this revision's deletions only: free entries of earlier
 * revisions are not linked in, except where `fillXrefGaps` rebuilds an
 * increment's table over the file's effective xref (fillInheritedGaps).
 */
export const freeEntries = (
  context: PDFContext,
  snapshot: DocumentSnapshot,
  inUse: readonly PDFRef[],
): FreeEntry[] => {
  const written = new Set<number>();
  for (const ref of inUse) {
    if (written.has(ref.objectNumber)) {
      throw new Error(
        `Cannot write object number ${ref.objectNumber} twice: the document holds more than one generation of it.`,
      );
    }
    written.add(ref.objectNumber);
  }
  const deleted = snapshot.deletedRefs();
  if (deleted.length === 0) return [];
  const live = new Set<number>();
  for (const [ref] of context.enumerateIndirectObjects()) {
    live.add(ref.objectNumber);
  }
  const freed = deleted.filter((ref) => !live.has(ref.objectNumber));
  return freed.map((ref, idx) => ({
    ref: PDFRef.of(ref.objectNumber, Math.min(ref.generationNumber + 1, 65535)),
    nextFreeObjectNumber: freed[idx + 1]?.objectNumber ?? 0,
  }));
};

export interface SerializationInfo {
  size: number;
  header: PDFHeader;
  indirectObjects: [PDFRef, PDFObject][];
  xref?: PDFCrossRefSection;
  trailerDict?: PDFTrailerDict;
  trailer: PDFTrailer;
}

/** How one write encrypts its objects and what its trailer declares. */
export interface WriteEncryption {
  encryptor: ObjectEncryptor | undefined;
  Encrypt: PDFObject | undefined;
  ID: PDFObject | undefined;
}

/**
 * The encryption an increment must keep, throwing for a file loaded
 * encrypted without its password, which no write accepts (see below).
 */
export const savableBaseline = (
  context: PDFContext,
): BaselineEncryption | undefined => {
  const baseline = context.baselineEncryption;
  if (baseline === 'keyless') {
    throw new Error(
      'An encrypted file loaded without its password cannot be saved or encrypted; load it with the `password` option.',
    );
  }
  return baseline;
};

/**
 * The encryption a write uses. No write, full or incremental, is made of a
 * file loaded encrypted without its password: there is no key to encrypt
 * anything new with, a changed object cannot be told apart from the
 * ciphertext it was loaded with, and compression, object streams and the
 * file's own encrypted object streams all turn ciphertext into garbage.
 * Such a load is reached only when no key could be recovered, the empty user
 * password included (load tries it when `password` is omitted), so there is
 * no key to re-encrypt with; and re-encrypting loaded ciphertext would
 * double-encrypt strings in edited objects in any case. A full write uses the handler `PDFDocument.encrypt` installed, if any. An
 * increment keeps the encryption of the file it extends, since the
 * revisions before it stay as they are: it refuses a newly installed
 * handler, any change to the file's encryption dictionary, and changes
 * that would make an inherited stream read with another crypt filter.
 */
export const writeEncryption = (
  context: PDFContext,
  snapshot: DocumentSnapshot,
  incremental: boolean,
): WriteEncryption => {
  const { trailerInfo } = context;
  const baseline = savableBaseline(context);
  if (!incremental) {
    return {
      encryptor:
        context.security ??
        (trailerInfo.Encrypt
          ? undefined
          : {
              encryptIndirectObject: (_ref, object) =>
                withoutCryptFilter(object),
            }),
      Encrypt: trailerInfo.Encrypt,
      ID: trailerInfo.ID,
    };
  }
  if (context.security) {
    throw new Error(
      'An incremental update cannot change the encryption of a file; save it with a full rewrite after encrypt().',
    );
  }
  if (!baseline) {
    return {
      encryptor: undefined,
      Encrypt: trailerInfo.Encrypt,
      ID: trailerInfo.ID,
    };
  }
  baseline.assertUntouchedBy(context, snapshot);
  return { encryptor: baseline, Encrypt: baseline.encryptRef, ID: baseline.id };
};

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

  /**
   * Write the xref table as one contiguous subsection (see
   * fillInheritedGaps for increments). Cross-reference streams ignore it.
   */
  public fillXrefGaps: boolean = false;

  /**
   * The absolute file offset of the xref section the last serialization
   * emitted: the startxref of the revision it wrote (see
   * PDFDocument.commit()).
   */
  xrefOffset = 0;

  private parsedObjects = 0;

  /**
   * The highest object number the last serialization emitted, including
   * numbers the writer allocated for itself (object streams, the xref
   * stream) that never enter the context. An increment that becomes the
   * base of the next one must reserve these numbers: see
   * PDFDocument.commit().
   */
  highestObjectNumber = 0;

  /**
   * If PDF has an XRef Stream, then the last object will be probably be skipped on saving.
   * If that's the case, this property will have that object number, and the PDF /Size can
   * be corrected, to be accurate.
   */
  protected _largestSkippedObjectNum: number = 0;

  /** Set by computeBufferSize for the write in progress. */
  protected encryption: WriteEncryption = {
    encryptor: undefined,
    Encrypt: undefined,
    ID: undefined,
  };

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

    // computeBufferSize chose the body and gave each object its xref offset;
    // writing anything other than exactly that list misplaces every later
    // offset.
    for (let idx = 0, len = indirectObjects.length; idx < len; idx++) {
      const [ref, object] = indirectObjects[idx]!;

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

  protected createTrailerDict(
    prevStartXRef?: number,
    incremental = false,
  ): PDFDict {
    /**
     * In a full save, if the last object (an XRef Stream) is not in the
     * output, the size is one less. In an increment a skipped object is
     * unchanged, still in use through earlier sections, and /Size must keep
     * covering it.
     */
    const size =
      this.context.largestObjectNumber +
      (!incremental &&
      this._largestSkippedObjectNum === this.context.largestObjectNumber
        ? 0
        : 1);
    return this.context.obj({
      Size: size,
      Root: this.context.trailerInfo.Root,
      Encrypt: this.encryption.Encrypt,
      Info: this.context.trailerInfo.Info,
      ID: this.encryption.ID,
      Prev: prevStartXRef ? PDFNumber.of(prevStartXRef) : undefined,
    });
  }

  protected async computeBufferSize(
    incremental: boolean,
  ): Promise<SerializationInfo> {
    this._largestSkippedObjectNum = 0;
    this.encryption = writeEncryption(this.context, this.snapshot, incremental);
    assertPDFAWrite(this.context, {
      encrypted: this.encryption.Encrypt !== undefined,
      objectStreams: false,
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

    const xref = PDFCrossRefSection.create();

    const indirectObjects: [PDFRef, PDFObject][] = [];

    for (const [ref, object] of this.context.enumerateIndirectObjects()) {
      if (!this.shouldSave(incremental, ref.objectNumber, object)) continue;
      // See shouldSkipCopiedObjectStream. Incremental snapshots already
      // exclude these containers.
      if (!incremental && this.shouldSkipCopiedObjectStream(object)) continue;
      if (this.shouldCompress) this.compress(object);
      const written: [PDFRef, PDFObject] = [
        ref,
        security ? security.encryptIndirectObject(ref, object) : object,
      ];
      indirectObjects.push(written);
      xref.addEntry(ref, size);
      size += this.computeIndirectObjectSize(written);
      if (this.shouldWaitForTick(1)) await waitForTick();
    }
    const free = freeEntries(
      this.context,
      this.snapshot,
      indirectObjects.map(([ref]) => ref),
    );
    for (const { ref, nextFreeObjectNumber } of free) {
      xref.addDeletedEntry(ref, nextFreeObjectNumber);
    }

    if (this.fillXrefGaps) {
      if (incremental) this.fillInheritedGaps(xref);
      else xref.fillGaps();
    }

    this.highestObjectNumber = this.context.largestObjectNumber;

    const xrefOffset = size;
    this.xrefOffset = xrefOffset;
    size += xref.sizeInBytes() + 1; // '\n'

    const trailerDict = PDFTrailerDict.of(
      this.createTrailerDict(this.snapshot.prevStartXRef, incremental),
    );
    size += trailerDict.sizeInBytes() + 2; // '\n\n'

    const trailer = PDFTrailer.forLastCrossRefSectionOffset(xrefOffset);
    size += trailer.sizeInBytes();
    size -= this.snapshot.pdfSize;

    return { size, header, indirectObjects, xref, trailerDict, trailer };
  }

  /**
   * Fills an increment's table without changing how any number it does not
   * write resolves. A number missing from the table is an unchanged object
   * of an earlier revision, not a free one: it is listed with the entry the
   * file's effective xref already gives it (in use at its old offset and
   * generation, or free with its generation, 65535 included), so filling
   * neither deletes inherited objects nor touches what the encryption guard
   * protects. The range extends to the highest effective free number so the
   * rebuilt chain links every free entry. A number listed nowhere is free.
   *
   * Throws when the file's xref chain cannot be read strictly
   * (PDFXRefChainReader) or when a gap is an object in an object stream or
   * has an entry of an undefined type: a table can express neither.
   */
  private fillInheritedGaps(xref: PDFCrossRefSection): void {
    const { originalBytes } = this.context.pdfFileDetails;
    const { prevStartXRef } = this.snapshot;
    if (!originalBytes || prevStartXRef === undefined) {
      throw new Error(
        'fillXrefGaps in an incremental save needs the bytes and startxref of the file it extends',
      );
    }
    const inherited = PDFXRefChainReader.read(
      originalBytes,
      prevStartXRef,
      this.context.maxDecodedStreamSize,
    );
    if (inherited.size - 1 > this.context.largestObjectNumber) {
      throw new Error(
        `fillXrefGaps: the file's /Size ${inherited.size} exceeds the numbers this document reserves`,
      );
    }
    xref.fillGaps((objectNumber) => {
      if (objectNumber === 0) return PDFCrossRefSection.freeGap(0);
      const entry = inherited.entries.get(objectNumber);
      if (!entry) return PDFCrossRefSection.freeGap(objectNumber);
      if (entry.kind === 'compressed') {
        throw new Error(
          `fillXrefGaps cannot fill this increment's xref table: object ${objectNumber} is inherited from an object stream, which a table cannot list. Save without fillXrefGaps, or with useObjectStreams.`,
        );
      }
      if (entry.kind === 'null') {
        // Listing it free would make the number reusable; in use, resolvable.
        throw new Error(
          `fillXrefGaps cannot fill this increment's xref table: object ${objectNumber} has an xref-stream entry of an undefined type (a null reference), which a table cannot list. Save without fillXrefGaps.`,
        );
      }
      return {
        ref: PDFRef.of(objectNumber, entry.generation),
        offset: entry.kind === 'inUse' ? entry.offset : 0,
        deleted: entry.kind === 'free',
      };
    }, inherited.highestFree);
  }

  protected compress(object: PDFObject): void {
    if (!(object instanceof PDFRawStream)) return;
    // The document's XMP stays unfiltered: PDF/A-1 requires it (ISO 19005-1
    // 6.7.2), and XMP is meant to be readable by tools that do not parse PDF.
    if (isCatalogMetadata(this.context, object)) return;

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
    // /DecodeParms on an unfiltered stream meant nothing; under the new
    // filter it would apply a predictor these bytes never had.
    object.dict.delete(PDFName.of('DecodeParms'));
  }

  /**
   * Object streams (/Type /ObjStm) copied from the source PDF must not be
   * re-serialised on full saves: their contents were already extracted and
   * registered individually at parse time. Writing the stale container would
   * let its old copies overwrite the current objects on the next load.
   * Object streams created while saving are PDFObjectStream, not
   * PDFRawStream, so they are unaffected.
   */
  protected shouldSkipCopiedObjectStream(object: PDFObject): boolean {
    return (
      object instanceof PDFRawStream &&
      object.dict.lookup(PDFName.of('Type')) === PDFName.of('ObjStm')
    );
  }

  protected shouldWaitForTick = (n: number) => {
    this.parsedObjects += n;
    return this.parsedObjects % this.objectsPerTick === 0;
  };
}

export default PDFWriter;
