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
import PDFArray from '../objects/PDFArray.js';
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
import { IsDelimiter } from '../syntax/Delimiters.js';
import { Keywords } from '../syntax/Keywords.js';
import { IsDigit } from '../syntax/Numeric.js';
import { IsWhitespace } from '../syntax/Whitespace.js';
import ByteStream from './ByteStream.js';
import PDFObjectParser from './PDFObjectParser.js';
import PDFObjectStreamParser, {
  ObjectStreamMemberError,
} from './PDFObjectStreamParser.js';
import PDFXRefChainReader, {
  XRefChainError,
  type XRefDisposition,
} from './PDFXRefChainReader.js';
import PDFXRefStreamParser from './PDFXRefStreamParser.js';

/**
 * The file's effective xref cannot locate an object it names (or cannot be
 * read at all): loading falls back to reconstructing the document by a scan.
 */
class XRefLoadError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'XRefLoadError';
  }
}

/** Failures that end the load instead of starting a reconstruction. */
const isFatal = (e: unknown) =>
  e instanceof DecodedStreamTooLargeError || e instanceof CryptFilterError;

const ObjStmName = PDFName.of('ObjStm');
const XRefName = PDFName.of('XRef');
const TypeName = PDFName.of('Type');

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
  private readonly pdfBytes: Uint8Array;
  private readonly forIncrementalUpdate: boolean;
  /** Load by scanning every body (the fallback), never through the xref. */
  private readonly reconstruct: boolean;
  /** Effective xref entries while loading through the xref. */
  private effective: Map<number, XRefDisposition> | undefined;
  /** An encrypted file parsed without its key: members are not read. */
  private keyless = false;
  private readonly loaded = new Set<number>();
  private readonly loading = new Set<number>();
  private readonly preparedContainers = new Map<
    number,
    PDFObjectStreamParser
  >();
  private readonly preparingContainers = new Set<number>();
  /** Loaded object streams, each decrypted once (by `decryptContainer`). */
  private readonly containers = new Map<PDFRawStream, PDFRef>();
  private readonly decryptedContainers = new Set<PDFRawStream>();
  /** The last object a reconstructing scan assigned under each number. */
  private readonly lastAssigned = new Map<number, PDFRef>();
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
    reconstruct = false,
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
    this.pdfBytes = pdfBytes;
    this.forIncrementalUpdate = forIncrementalUpdate;
    this.reconstruct = reconstruct;
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

    if (!this.reconstruct) {
      const startXRef = this.locateStartXRef();
      try {
        if (startXRef === undefined) {
          throw new XRefLoadError('no startxref');
        }
        await this.loadByXRef(startXRef);
        return this.context;
      } catch (e) {
        if (!(e instanceof XRefLoadError)) throw e;
      }
      // A fresh parser: nothing this attempt queued or decrypted carries over.
      const fallback = new PDFParser(
        this.pdfBytes,
        this.objectsPerTick,
        this.throwOnInvalidObject,
        this.warnOnInvalidObjects,
        this.capNumbers,
        this.cryptoFactory,
        this.forIncrementalUpdate,
        this.context.maxDecodedStreamSize,
        this.encryptRef,
        true,
      );
      const context = await fallback.parseDocument();
      this.streamCryptPlans.clear();
      for (const [num, plan] of fallback.streamCryptPlans) {
        this.streamCryptPlans.set(num, plan);
      }
      return context;
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

    this.keepLastAssigned();

    // Now that every object is known, fix up streams whose indirect /Length
    // pointed forward (#180). Object and xref streams were already consumed
    // during parsing and are not revisited.
    this.resolvePendingStreamLengths();

    this.maybeRecoverRoot();

    await this.decryptStreams();

    return this.context;
  }

  /**
   * The offset after the last `startxref` keyword of the file. Only that
   * one names the newest revision: if it is unusable the document is
   * reconstructed, never loaded from an older revision.
   */
  private locateStartXRef(): number | undefined {
    const bytes = this.pdfBytes;
    const keyword = Keywords.startxref;
    const isBoundary = (byte: number | undefined) =>
      byte === undefined || IsWhitespace[byte] || IsDelimiter[byte];
    for (let at = bytes.length - keyword.length; at >= 0; at--) {
      let match = true;
      for (let k = 0; k < keyword.length; k++) {
        if (bytes[at + k] !== keyword[k]) {
          match = false;
          break;
        }
      }
      if (!match) continue;
      // A whole token only: not the tail of a longer word.
      if (at > 0 && !isBoundary(bytes[at - 1])) continue;
      let idx = at + keyword.length;
      if (!IsWhitespace[bytes[idx]!]) return undefined;
      while (idx < bytes.length && IsWhitespace[bytes[idx]!]) idx++;
      let digits = '';
      while (idx < bytes.length && IsDigit[bytes[idx]!]) {
        digits += String.fromCharCode(bytes[idx++]!);
      }
      const value = Number(digits);
      if (digits === '' || !isBoundary(bytes[idx])) return undefined;
      return Number.isSafeInteger(value) ? value : undefined;
    }
    return undefined;
  }

  /**
   * Loads the document as a conforming reader resolves it: through the
   * file's effective cross-reference data (PDFXRefChainReader), newest
   * revision first. Each number holds the one object its effective entry
   * names - the body of that generation at that offset, or that member of
   * that object stream - and nothing for a free entry, a null entry, or a
   * number no entry lists. A body an earlier revision freed or replaced is
   * never seen, whatever its generation.
   *
   * Throws XRefLoadError when the chain cannot be read or does not lead to
   * what it names (no `N G obj` header of that number and generation at the
   * offset, a compressed entry whose container is not an in-use object
   * stream, a member that is not where the stream's table puts it); the
   * caller then reconstructs the document from a scan. A body that is found
   * but does not parse becomes a PDFInvalidObject, as in a scan.
   */
  private async loadByXRef(startXRef: number): Promise<void> {
    const { context } = this;
    let xref;
    try {
      xref = PDFXRefChainReader.read(
        this.pdfBytes,
        startXRef,
        context.maxDecodedStreamSize,
        context,
      );
    } catch (e) {
      if (e instanceof XRefChainError) throw new XRefLoadError(e.message);
      throw e;
    }
    this.effective = xref.entries;
    context.trailerInfo = {
      Size: PDFNumber.of(xref.size),
      Root: xref.trailer.Root,
      Encrypt: xref.trailer.Encrypt,
      Info: xref.trailer.Info,
      ID: xref.trailer.ID,
    };
    context.pdfFileDetails.prevStartXRef = startXRef;
    if (xref.hasStreamSection) context.pdfFileDetails.useObjectStreams = true;

    // Without the key of an encrypted file, object streams cannot be read:
    // their members are left out (the parse that finds the key loads them).
    const keyless =
      context.trailerInfo.Encrypt !== undefined && !this.cryptoFactory;
    this.keyless = keyless;

    const numbers = [...xref.entries.keys()].sort((a, b) => a - b);
    for (const num of numbers) {
      this.load(num);
      if (this.shouldWaitForTick()) await waitForTick();
    }
    for (const [stream, ref] of this.containers) {
      this.decryptContainer(ref, stream);
    }

    if (this.forIncrementalUpdate) {
      context.largestObjectNumber = Math.max(
        context.largestObjectNumber,
        xref.size - 1,
      );
    }

    this.resolvePendingStreamLengths();

    // A Root that is an unloaded member is not damaged, only not read yet.
    const root = context.trailerInfo.Root;
    const rootSkipped =
      keyless &&
      root instanceof PDFRef &&
      xref.entries.get(root.objectNumber)?.kind === 'compressed';
    if (!rootSkipped) this.maybeRecoverRoot();

    await this.decryptStreams();
  }

  /**
   * Loads number `num` as its effective entry says, once. Called again for
   * a number already being loaded (an object whose stream /Length names
   * itself), it returns and leaves the number unresolved for that caller.
   */
  private load(num: number): void {
    if (this.loaded.has(num) || this.loading.has(num)) return;
    const entry = this.effective?.get(num);
    // However it is reached (a stream /Length included), a member stays
    // unread without the key.
    if (this.keyless && entry?.kind === 'compressed') return;
    this.loading.add(num);
    try {
      if (entry?.kind === 'inUse') {
        this.loadBody(num, entry.offset, entry.generation);
      } else if (entry?.kind === 'compressed') {
        this.loadMember(num, entry.container, entry.index);
      }
    } finally {
      this.loading.delete(num);
      this.loaded.add(num);
    }
  }

  private loadBody(num: number, offset: number, generation: number): void {
    if (!Number.isSafeInteger(offset) || offset >= this.pdfBytes.length) {
      throw new XRefLoadError(
        `object ${num}: offset ${offset} is not in the file`,
      );
    }
    const saved = this.bytes.position();
    try {
      this.bytes.moveTo(offset);
      let ref: PDFRef;
      try {
        ref = this.parseIndirectObjectHeader();
      } catch {
        throw new XRefLoadError(`object ${num}: no object header at ${offset}`);
      }
      if (ref.objectNumber !== num || ref.generationNumber !== generation) {
        throw new XRefLoadError(
          `object ${num} ${generation}: the header at ${offset} is ${ref}`,
        );
      }
      let object: PDFObject;
      try {
        object = this.parseBody(ref);
      } catch (e) {
        if (isFatal(e) || e instanceof XRefLoadError) throw e;
        this.bytes.moveTo(offset);
        this.tryToParseInvalidIndirectObject();
        return;
      }
      this.context.assign(ref, object);
    } finally {
      this.bytes.restorePosition(saved);
    }
  }

  /**
   * Parses the body after an `N G obj` header found through the xref. It is
   * first parsed in clear, which is how it stays when it is the /Encrypt
   * dictionary or a cross-reference stream (ISO 32000-2 7.6.2); any other
   * body of an encrypted file is parsed again with its object's key.
   */
  private parseBody(ref: PDFRef): PDFObject {
    this.skipWhitespaceAndComments();
    const start = this.bytes.position();
    let object = this.parseObject();
    const isXRef =
      object instanceof PDFRawStream &&
      object.dict.lookup(TypeName) === XRefName;
    const clear = ref === this.encryptRef || isXRef || !this.cryptoFactory;
    if (!clear) {
      this.bytes.restorePosition(start);
      object = this.parseObject(ref);
    }
    if (object instanceof PDFRawStream && !isXRef) {
      if (object.dict.lookup(TypeName) === ObjStmName) {
        this.containers.set(object, ref);
      } else if (!clear) {
        this.pendingDecryption.push({ ref, stream: object });
      }
    }
    this.skipWhitespaceAndComments();
    this.matchKeyword(Keywords.endobj);
    return object;
  }

  private loadMember(num: number, container: number, index: number): void {
    const parser = this.prepareContainer(container);
    let object: PDFObject;
    try {
      object = parser.readMember(index, num);
    } catch (e) {
      if (e instanceof ObjectStreamMemberError) {
        throw new XRefLoadError(e.message);
      }
      throw e;
    }
    this.context.assign(PDFRef.of(num, 0), object);
  }

  /**
   * Readies object stream `num` for its members to be read: loads what
   * decoding it depends on (the objects its /Length, /Filter, /DecodeParms,
   * /N and /First name, and those their arrays and parameter dictionaries
   * name - not every reference in its dictionary), decrypts it, and reads
   * its offset table. Decoding a container that needs one of its own
   * members is a cycle no reader can resolve.
   */
  private prepareContainer(num: number): PDFObjectStreamParser {
    const prepared = this.preparedContainers.get(num);
    if (prepared) return prepared;
    if (this.preparingContainers.has(num)) {
      throw new XRefLoadError(
        `object stream ${num} depends on its own members`,
      );
    }
    this.preparingContainers.add(num);
    try {
      this.load(num);
      const entry = this.effective?.get(num);
      const ref =
        entry?.kind === 'inUse' ? PDFRef.of(num, entry.generation) : undefined;
      const stream = ref && this.context.lookup(ref);
      if (
        !ref ||
        !(stream instanceof PDFRawStream) ||
        stream.dict.lookup(TypeName) !== ObjStmName
      ) {
        throw new XRefLoadError(`object ${num} is not an in-use object stream`);
      }
      this.loadDecodeDependencies(stream.dict);
      try {
        this.decryptContainer(ref, stream);
        const parser = PDFObjectStreamParser.forStream(stream);
        this.preparedContainers.set(num, parser);
        return parser;
      } catch (e) {
        if (isFatal(e)) throw e;
        throw new XRefLoadError(
          `object stream ${num}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    } finally {
      this.preparingContainers.delete(num);
    }
  }

  /**
   * Loads every object that decoding a stream with `dict` reads: /Length,
   * /N, /First, each /Filter, and, only where its filter reads it, each
   * /DecodeParms dictionary and value: /Name for /Crypt, /Predictor (and,
   * when it predicts, /Colors /BitsPerComponent /Columns) for Flate and LZW,
   * /EarlyChange for LZW (see decode.ts and streamCrypt.ts). Nothing else is
   * followed: a reference decoding ignores could name one of the stream's
   * own members, which is no cycle.
   */
  private loadDecodeDependencies(dict: PDFDict): void {
    const need = (value: PDFObject | undefined) => {
      if (!(value instanceof PDFRef)) return value;
      this.load(value.objectNumber);
      return this.context.lookup(value);
    };
    const each = (value: PDFObject | undefined) =>
      value instanceof PDFArray ? value.asArray().map(need) : [value];
    for (const key of ['Length', 'N', 'First']) need(dict.get(PDFName.of(key)));
    const filter = need(dict.get(PDFName.of('Filter')));
    if (filter === undefined) return; // /DecodeParms is then ignored
    const filters = each(filter);
    const parms = each(need(dict.get(PDFName.of('DecodeParms'))));
    filters.forEach((name, idx) => {
      const params = parms[idx];
      if (!(params instanceof PDFDict)) return;
      const param = (key: string) => need(params.get(PDFName.of(key)));
      if (name === PDFName.of('Crypt')) param('Name');
      const lzw = name === PDFName.of('LZWDecode');
      if (!lzw && name !== PDFName.of('FlateDecode')) return;
      if (lzw) param('EarlyChange');
      const predictor = param('Predictor');
      if (predictor instanceof PDFNumber && predictor.asNumber() > 1) {
        for (const key of ['Colors', 'BitsPerComponent', 'Columns']) {
          param(key);
        }
      }
    });
  }

  /** Decrypts an object stream's body once, before its members are read. */
  private decryptContainer(ref: PDFRef, stream: PDFRawStream): void {
    if (!this.cryptoFactory || this.decryptedContainers.has(stream)) return;
    this.decryptedContainers.add(stream);
    this.decryptStream(ref, stream, noStreamRoles, true);
  }

  protected override lookupStreamLength(ref: PDFRef): PDFObject | undefined {
    if (this.effective) this.load(ref.objectNumber);
    return this.context.lookup(ref);
  }

  /**
   * Reconstruction keeps one object per number: the one the scan met last,
   * whatever its generation (a later revision's body supersedes an earlier
   * one, as for the same generation). Object 0 is never an object.
   */
  private keepLastAssigned(): void {
    for (const [ref] of this.context.enumerateIndirectObjects()) {
      if (ref.objectNumber === 0) {
        console.warn(`Removing parsed object: ${ref}`);
        this.context.delete(ref);
      } else if (this.lastAssigned.get(ref.objectNumber) !== ref) {
        this.context.delete(ref);
      }
    }
    // Only object streams are decrypted during the scan; a plan recorded
    // for one that did not survive describes no object of the document.
    for (const num of [...this.streamCryptPlans.keys()]) {
      const last = this.lastAssigned.get(num);
      const survivor = last && this.context.lookup(last);
      if (
        !(survivor instanceof PDFRawStream) ||
        !this.decryptedContainers.has(survivor)
      ) {
        this.streamCryptPlans.delete(num);
      }
    }
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
        this.decryptedContainers.add(object);
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
      // Each member counts as met when assigned, even if a later member of
      // the same stream fails to parse.
      await PDFObjectStreamParser.forStream(
        object,
        this.shouldWaitForTick,
      ).parseIntoContext((member) => {
        this.lastAssigned.set(member.objectNumber, member);
      });
    } else if (
      object instanceof PDFRawStream &&
      object.dict.lookup(PDFName.of('Type')) === PDFName.of('XRef')
    ) {
      PDFXRefStreamParser.forStream(object).parseIntoContext();
    }
    // Every scanned body is registered; keepLastAssigned keeps one per number.
    this.context.assign(ref, object);
    this.lastAssigned.set(ref.objectNumber, ref);

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
    this.lastAssigned.set(ref.objectNumber, ref);

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
