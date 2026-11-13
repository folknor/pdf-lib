import { waitForTick } from '../../utils/index.js';
import type { CipherTransformFactory } from '../crypto.js';
import PDFCrossRefSection from '../document/PDFCrossRefSection.js';
import PDFHeader from '../document/PDFHeader.js';
import PDFTrailer from '../document/PDFTrailer.js';
import {
  DecodedStreamTooLargeError,
  MissingKeywordError,
  MissingPDFHeaderError,
  PDFInvalidObjectParsingError,
  ReparseError,
  StalledParserError,
} from '../errors.js';
import PDFDict from '../objects/PDFDict.js';
import PDFInvalidObject from '../objects/PDFInvalidObject.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import type PDFObject from '../objects/PDFObject.js';
import PDFRawStream from '../objects/PDFRawStream.js';
import PDFRef from '../objects/PDFRef.js';
import PDFContext from '../PDFContext.js';
import {
  CryptFilterError,
  computeStreamRoles,
  readCryptDeclaration,
  removeCryptFilter,
  type StreamCryptPlan,
  type StreamRoles,
  selectStreamCrypt,
} from '../security/streamCrypt.js';
import CharCodes from '../syntax/CharCodes.js';
import { Keywords } from '../syntax/Keywords.js';
import { IsDigit } from '../syntax/Numeric.js';
import ByteStream from './ByteStream.js';
import PDFObjectParser from './PDFObjectParser.js';
import PDFObjectStreamParser from './PDFObjectStreamParser.js';
import PDFXRefStreamParser from './PDFXRefStreamParser.js';

const noStreamRoles: StreamRoles = {
  documentMetadata: undefined,
  embeddedFiles: new Set(),
};

class PDFParser extends PDFObjectParser {
  static forBytesWithOptions = (
    pdfBytes: Uint8Array,
    objectsPerTick?: number,
    throwOnInvalidObject?: boolean,
    warnOnInvalidObjects?: boolean,
    capNumbers?: boolean,
    cryptoFactory?: CipherTransformFactory,
    forIncrementalUpdate?: boolean,
    maxDecodedStreamSize?: number,
    encryptRef?: PDFRef,
  ) =>
    new PDFParser(
      pdfBytes,
      objectsPerTick,
      throwOnInvalidObject,
      warnOnInvalidObjects,
      capNumbers,
      cryptoFactory,
      forIncrementalUpdate,
      maxDecodedStreamSize,
      encryptRef,
    );

  private readonly objectsPerTick: number;
  private readonly throwOnInvalidObject: boolean;
  private readonly warnOnInvalidObjects: boolean;
  private readonly encryptRef: PDFRef | undefined;
  private alreadyParsed = false;
  private parsedObjects = 0;
  /** Stream bodies still as the file stores them, decrypted after the parse. */
  private readonly pendingDecryption: { ref: PDFRef; stream: PDFRawStream }[] =
    [];
  /**
   * How each decrypted stream was encrypted, by object number; filled by a
   * decrypting parse, for `BaselineEncryption`.
   */
  readonly streamCryptPlans = new Map<number, StreamCryptPlan>();

  constructor(
    pdfBytes: Uint8Array,
    objectsPerTick = Infinity,
    throwOnInvalidObject = false,
    warnOnInvalidObjects = false,
    capNumbers = false,
    cryptoFactory?: CipherTransformFactory,
    forIncrementalUpdate = false,
    maxDecodedStreamSize?: number,
    encryptRef?: PDFRef,
  ) {
    super(
      ByteStream.of(pdfBytes),
      PDFContext.create(),
      capNumbers,
      cryptoFactory,
    );
    this.objectsPerTick = objectsPerTick;
    this.throwOnInvalidObject = throwOnInvalidObject;
    this.warnOnInvalidObjects = warnOnInvalidObjects;
    this.encryptRef = encryptRef;
    this.context.isDecrypted = Boolean(cryptoFactory?.encryptionKey);
    this.context.pdfFileDetails.pdfSize = pdfBytes.length;
    // Set before parsing so object/xref streams decoded during the parse
    // are capped too.
    this.context.maxDecodedStreamSize = maxDecodedStreamSize;
    if (forIncrementalUpdate) {
      this.context.pdfFileDetails.originalBytes = pdfBytes;
    }
  }

  async parseDocument(): Promise<PDFContext> {
    if (this.alreadyParsed) {
      throw new ReparseError('PDFParser', 'parseDocument');
    }
    this.alreadyParsed = true;

    this.context.header = this.parseHeader();
    if (this.context.pdfFileDetails.originalBytes) {
      this.context.pdfFileDetails.originalHeader = this.context.header;
    }

    let prevOffset;
    while (!this.bytes.done()) {
      await this.parseDocumentSection();
      const offset = this.bytes.offset();
      if (offset === prevOffset) {
        throw new StalledParserError(this.bytes.position());
      }
      prevOffset = offset;
    }

    // Now that every object is known, fix up streams whose indirect /Length
    // pointed forward (#180). Object and xref streams were already consumed
    // during parsing and are not revisited.
    this.resolvePendingStreamLengths();

    this.maybeRecoverRoot();

    if (this.context.lookup(PDFRef.of(0))) {
      console.warn('Removing parsed object: 0 0 R');
      this.context.delete(PDFRef.of(0));
    }

    await this.decryptStreams();

    return this.context;
  }

  /**
   * Decrypts every stream body left raw by the parse, once the document is
   * complete: the crypt filter a stream uses depends on the catalog and on
   * which file specifications reference it (see `selectStreamCrypt`).
   * Streams no longer in the context (superseded revisions, cross-reference
   * streams re-parsed in clear) are skipped.
   */
  private async decryptStreams(): Promise<void> {
    const pending = this.pendingDecryption;
    if (pending.length === 0) return;
    const roles = computeStreamRoles(this.context);
    for (const { ref, stream } of pending) {
      if (this.context.lookup(ref) !== stream) continue;
      this.decryptStream(ref, stream, roles, false);
      if (this.shouldWaitForTick()) await waitForTick();
    }
    pending.length = 0;
  }

  /**
   * Decrypts `stream`'s body in place, removes a /Crypt filter it declared
   * (its body is now clear), and records how it was encrypted.
   */
  private decryptStream(
    ref: PDFRef,
    stream: PDFRawStream,
    roles: StreamRoles,
    strict: boolean,
  ): void {
    const factory = this.cryptoFactory!;
    const declaration = readCryptDeclaration(stream.dict, this.context, strict);
    const name = selectStreamCrypt(
      factory,
      roles,
      ref,
      stream.dict,
      declaration,
    );
    const { objectNumber: num, generationNumber: gen } = ref;
    const decrypt = (raw: Uint8Array) =>
      factory.decryptStream(raw, num, gen, name);
    stream.contents = decrypt(stream.contents);
    this.streamDecryption.set(stream, decrypt);
    if (declaration) removeCryptFilter(stream.dict, declaration);
    this.streamCryptPlans.set(num, {
      method: factory.methodOf(name),
      dependencies: declaration?.dependencies,
    });
  }

  private maybeRecoverRoot(): void {
    const isValidCatalog = (obj?: PDFObject) =>
      obj instanceof PDFDict &&
      obj.lookup(PDFName.of('Type')) === PDFName.of('Catalog');

    const catalog = this.context.lookup(this.context.trailerInfo.Root);

    if (!isValidCatalog(catalog)) {
      const indirectObjects = this.context.enumerateIndirectObjects();
      for (let idx = 0, len = indirectObjects.length; idx < len; idx++) {
        const [ref, object] = indirectObjects[idx]!;
        if (isValidCatalog(object)) {
          this.context.trailerInfo.Root = ref;
        }
      }
    }
  }

  private parseHeader(): PDFHeader {
    while (!this.bytes.done()) {
      if (this.matchKeyword(Keywords.header)) {
        const major = this.parseRawInt();
        this.bytes.assertNext(CharCodes.Period);
        const minor = this.parseRawInt();
        const header = PDFHeader.forVersion(major, minor);
        this.skipBinaryHeaderComment();
        return header;
      }
      this.bytes.next();
    }

    throw new MissingPDFHeaderError(this.bytes.position());
  }

  private parseIndirectObjectHeader(): PDFRef {
    this.skipWhitespaceAndComments();
    const objectNumber = this.parseRawInt();

    this.skipWhitespaceAndComments();
    const generationNumber = this.parseRawInt();

    this.skipWhitespaceAndComments();
    if (!this.matchKeyword(Keywords.obj)) {
      throw new MissingKeywordError(this.bytes.position(), Keywords.obj);
    }

    return PDFRef.of(objectNumber, generationNumber);
  }

  private matchIndirectObjectHeader(): boolean {
    const initialOffset = this.bytes.offset();
    try {
      this.parseIndirectObjectHeader();
      return true;
    } catch {
      this.bytes.moveTo(initialOffset);
      return false;
    }
  }

  private shouldWaitForTick = () => {
    this.parsedObjects += 1;
    return this.parsedObjects % this.objectsPerTick === 0;
  };

  private async parseIndirectObject(): Promise<PDFRef> {
    const ref = this.parseIndirectObjectHeader();

    this.skipWhitespaceAndComments();
    // ISO 32000-2 7.6.2: the encryption dictionary and cross-reference
    // streams (dictionary and body) are not encrypted, so they are parsed
    // without the object's key. The decision is made here, for the indirect
    // object as a whole: a nested dict that happens to say /Type /XRef is
    // decrypted like any other value. PDFSecurity.encryptObject exempts the
    // same objects on write.
    const start = this.bytes.position();
    const exempt = ref === this.encryptRef;
    let object = this.parseObject(exempt ? undefined : ref);
    if (
      !exempt &&
      object instanceof PDFRawStream &&
      object.dict.lookup(PDFName.of('Type')) === PDFName.of('XRef')
    ) {
      this.bytes.restorePosition(start);
      object = this.parseObject();
    } else if (
      !exempt &&
      this.cryptoFactory &&
      object instanceof PDFRawStream
    ) {
      // An object stream's members are parsed right below, so its body is
      // decrypted now; it is never document metadata nor an embedded file.
      // Every other body waits for decryptStreams.
      if (object.dict.lookup(PDFName.of('Type')) === PDFName.of('ObjStm')) {
        this.decryptStream(ref, object, noStreamRoles, true);
      } else {
        this.pendingDecryption.push({ ref, stream: object });
      }
    }

    this.skipWhitespaceAndComments();
    // if (!this.matchKeyword(Keywords.endobj)) {
    // throw new MissingKeywordError(this.bytes.position(), Keywords.endobj);
    // }

    // TODO: Log a warning if this fails...
    this.matchKeyword(Keywords.endobj);

    if (
      object instanceof PDFRawStream &&
      object.dict.lookup(PDFName.of('Type')) === PDFName.of('ObjStm')
    ) {
      await PDFObjectStreamParser.forStream(
        object,
        this.shouldWaitForTick,
      ).parseIntoContext();
    } else if (
      object instanceof PDFRawStream &&
      object.dict.lookup(PDFName.of('Type')) === PDFName.of('XRef')
    ) {
      PDFXRefStreamParser.forStream(object).parseIntoContext();
    }
    // Always register the object and the ref, to properly handle object numeration
    this.context.assign(ref, object);

    return ref;
  }

  // TODO: Improve and clean this up
  private tryToParseInvalidIndirectObject() {
    const startPos = this.bytes.position();

    const msg = `Trying to parse invalid object: ${JSON.stringify(startPos)})`;
    if (this.throwOnInvalidObject) throw new Error(msg);
    if (this.warnOnInvalidObjects) console.warn(msg);

    const ref = this.parseIndirectObjectHeader();

    if (this.warnOnInvalidObjects) console.warn(`Invalid object ref: ${ref}`);

    this.skipWhitespaceAndComments();
    const start = this.bytes.offset();

    let failed = true;
    while (!this.bytes.done()) {
      if (this.matchKeyword(Keywords.endobj)) {
        failed = false;
      }
      if (!failed) break;
      this.bytes.next();
    }

    if (failed) {
      throw new PDFInvalidObjectParsingError(
        startPos,
        "no 'endobj' keyword found - file may be truncated",
      );
    }

    const end = this.bytes.offset() - Keywords.endobj.length;

    const object = PDFInvalidObject.of(this.bytes.slice(start, end));
    this.context.assign(ref, object);

    return ref;
  }

  private async parseIndirectObjects(): Promise<void> {
    this.skipWhitespaceAndComments();

    while (!this.bytes.done() && IsDigit[this.bytes.peek()]) {
      const initialOffset = this.bytes.offset();

      try {
        await this.parseIndirectObject();
      } catch (e) {
        // A decompression-bomb guard must abort loading, not be swallowed
        // into an invalid object.
        if (e instanceof DecodedStreamTooLargeError) throw e;
        // Nor may an undecidable crypt filter leave a body undecrypted.
        if (e instanceof CryptFilterError) throw e;
        // TODO: Add tracing/logging mechanism to track when this happens!
        this.bytes.moveTo(initialOffset);
        this.tryToParseInvalidIndirectObject();
      }
      this.skipWhitespaceAndComments();

      // TODO: Can this be done only when needed, to avoid harming performance?
      this.skipJibberish();

      if (this.shouldWaitForTick()) await waitForTick();
    }
  }

  private maybeParseCrossRefSection(): PDFCrossRefSection | void {
    this.skipWhitespaceAndComments();
    if (!this.matchKeyword(Keywords.xref)) return;
    this.skipWhitespaceAndComments();

    let objectNumber = -1;
    const xref = PDFCrossRefSection.createEmpty();

    while (!this.bytes.done() && IsDigit[this.bytes.peek()]) {
      const firstInt = this.parseRawInt();
      this.skipWhitespaceAndComments();

      // Check if second digit is valid integer
      if (!IsDigit[this.bytes.peek()]) {
        return PDFCrossRefSection.createEmpty();
      }

      const secondInt = this.parseRawInt();
      this.skipWhitespaceAndComments();

      const byte = this.bytes.peek();
      if (byte === CharCodes.n || byte === CharCodes.f) {
        const ref = PDFRef.of(objectNumber, secondInt);
        if (this.bytes.next() === CharCodes.n) {
          xref.addEntry(ref, firstInt);
        } else {
          // this.context.delete(ref);
          xref.addDeletedEntry(ref, firstInt);
        }
        objectNumber += 1;
      } else {
        objectNumber = firstInt;
      }
      this.skipWhitespaceAndComments();
    }

    return xref;
  }

  private maybeParseTrailerDict(): void {
    this.skipWhitespaceAndComments();
    if (!this.matchKeyword(Keywords.trailer)) return;
    this.skipWhitespaceAndComments();

    const dict = this.parseDict();

    const { context } = this;
    context.trailerInfo = {
      Size:
        dict.lookupMaybe(PDFName.of('Size'), PDFNumber) ||
        context.trailerInfo.Size,
      Root: dict.get(PDFName.of('Root')) || context.trailerInfo.Root,
      Encrypt: dict.get(PDFName.of('Encrypt')) || context.trailerInfo.Encrypt,
      Info: dict.get(PDFName.of('Info')) || context.trailerInfo.Info,
      ID: dict.get(PDFName.of('ID')) || context.trailerInfo.ID,
    };
    // If open for incremental update, then deleted objects need to be preserved,
    // and largestObjectNumber has to be at least Size-1. Use Math.max so a
    // later section with a smaller Size (e.g. linearized PDFs) cannot lower it.
    if (context.trailerInfo.Size && context.pdfFileDetails.originalBytes) {
      context.largestObjectNumber = Math.max(
        context.largestObjectNumber,
        context.trailerInfo.Size.asNumber() - 1,
      );
    }
  }

  private maybeParseTrailer(): PDFTrailer | void {
    this.skipWhitespaceAndComments();
    if (!this.matchKeyword(Keywords.startxref)) return;
    this.skipWhitespaceAndComments();

    const offset = this.parseRawInt();
    this.context.pdfFileDetails.prevStartXRef = offset;

    this.skipWhitespace();
    this.matchKeyword(Keywords.eof);
    this.skipWhitespaceAndComments();
    this.matchKeyword(Keywords.eof);
    this.skipWhitespaceAndComments();

    return PDFTrailer.forLastCrossRefSectionOffset(offset);
  }

  private async parseDocumentSection(): Promise<void> {
    await this.parseIndirectObjects();
    this.maybeParseCrossRefSection();
    this.maybeParseTrailerDict();
    this.maybeParseTrailer();

    // TODO: Can this be done only when needed, to avoid harming performance?
    this.skipJibberish();
  }

  /**
   * This operation is not necessary for valid PDF files. But some invalid PDFs
   * contain jibberish in between indirect objects. This method is designed to
   * skip past that jibberish, should it exist, until it reaches the next
   * indirect object header, an xref table section, or the file trailer.
   */
  private skipJibberish(): void {
    this.skipWhitespaceAndComments();
    while (!this.bytes.done()) {
      const initialOffset = this.bytes.offset();
      const byte = this.bytes.peek();
      const isAlphaNumeric = byte >= CharCodes.Space && byte <= CharCodes.Tilde;
      if (isAlphaNumeric) {
        if (
          this.matchKeyword(Keywords.xref) ||
          this.matchKeyword(Keywords.trailer) ||
          this.matchKeyword(Keywords.startxref) ||
          this.matchIndirectObjectHeader()
        ) {
          this.bytes.moveTo(initialOffset);
          break;
        }
      }
      this.bytes.next();
    }
  }

  /**
   * Skips the binary comment following a PDF header. The specification
   * defines this binary comment (section 7.5.2 File Header) as a sequence of 4
   * or more bytes that are 128 or greater, and which are preceded by a "%".
   *
   * This would imply that to strip out this binary comment, we could check for
   * a sequence of bytes starting with "%", and remove all subsequent bytes that
   * are 128 or greater. This works for many documents that properly comply with
   * the spec. But in the wild, there are PDFs that omit the leading "%", and
   * include bytes that are less than 128 (e.g. 0 or 1). So in order to parse
   * these headers correctly, we just throw out all bytes leading up to the
   * first indirect object header.
   */
  private skipBinaryHeaderComment(): void {
    this.skipWhitespaceAndComments();
    try {
      const initialOffset = this.bytes.offset();
      this.parseIndirectObjectHeader();
      this.bytes.moveTo(initialOffset);
    } catch {
      this.bytes.next();
      this.skipWhitespaceAndComments();
    }
  }
}

export default PDFParser;
