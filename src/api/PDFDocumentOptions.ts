import type { EmbeddedFileOptions } from '../core/embedders/FileEmbedder.js';
import type { TypeFeatures } from '../types/fontkit.js';

export enum ParseSpeeds {
  Fastest = Infinity,
  Fast = 1500,
  Medium = 500,
  Slow = 100,
}

export type AttachmentOptions = EmbeddedFileOptions;

export interface SaveOptions {
  /**
   * Write object and cross-reference streams. These need PDF 1.5: when the
   * document declares less, a full save raises the header to 1.5 and an
   * increment raises the catalog /Version to 1.5 (an increment cannot change
   * the original file's header). A malformed catalog /Version throws.
   */
  useObjectStreams?: boolean;
  addDefaultPage?: boolean;
  objectsPerTick?: number;
  updateFieldAppearances?: boolean;
  /** Force a full rewrite instead of incremental save (only applies when loaded with forIncrementalUpdate) */
  rewrite?: boolean;
  /** Compress uncompressed streams using FlateDecode to reduce file size */
  compress?: boolean;
  /**
   * Write the xref table as one contiguous subsection from object 0. A
   * fragmented table can make Adobe Reader invalidate digital signatures on
   * incremental updates. In a full save a number no object uses is listed
   * free. In an incremental save a number the increment does not write is
   * listed as the file already resolves it (in use at its earlier offset,
   * or free), so nothing inherited is deleted; this throws when the file's
   * xref chain cannot be read strictly, or when such a number is an object
   * in an object stream, which a table cannot list. Applies to xref tables
   * only: ignored when `useObjectStreams` writes a cross-reference stream.
   */
  fillXrefGaps?: boolean;
}

export interface IncrementalSaveOptions {
  objectsPerTick?: number;
  /**
   * Write object and cross-reference streams. These need PDF 1.5: when the
   * document declares less, a full save raises the header to 1.5 and an
   * increment raises the catalog /Version to 1.5 (an increment cannot change
   * the original file's header). A malformed catalog /Version throws.
   */
  useObjectStreams?: boolean;
  /** Compress uncompressed streams using FlateDecode to reduce file size */
  compress?: boolean;
  /**
   * Write the xref table as one contiguous subsection from object 0. A
   * fragmented table can make Adobe Reader invalidate digital signatures on
   * incremental updates. In a full save a number no object uses is listed
   * free. In an incremental save a number the increment does not write is
   * listed as the file already resolves it (in use at its earlier offset,
   * or free), so nothing inherited is deleted; this throws when the file's
   * xref chain cannot be read strictly, or when such a number is an object
   * in an object stream, which a table cannot list. Applies to xref tables
   * only: ignored when `useObjectStreams` writes a cross-reference stream.
   */
  fillXrefGaps?: boolean;
}

export interface Base64SaveOptions extends SaveOptions {
  dataUri?: boolean;
}

export interface LoadOptions {
  /**
   * Load an encrypted file that cannot be decrypted instead of throwing
   * [[EncryptedPDFError]]. Its objects stay ciphertext, so such a document
   * is for inspection only: [[PDFDocument.save]],
   * [[PDFDocument.saveIncremental]], [[PDFDocument.commit]] and
   * [[PDFDocument.encrypt]] throw, and so does copying or embedding its
   * pages into another document. Without the key nothing new can be
   * encrypted, and an edited object cannot be told apart from the
   * ciphertext it was loaded with. Load with the right `password` to change
   * the file. A file that is not encrypted, or that is decrypted (see
   * `password`), is unaffected.
   */
  ignoreEncryption?: boolean;
  parseSpeed?: ParseSpeeds | number;
  throwOnInvalidObject?: boolean;
  warnOnInvalidObjects?: boolean;
  updateMetadata?: boolean;
  capNumbers?: boolean;
  /**
   * The user or owner password of an encrypted file. When omitted, the
   * empty user password is tried, as standard readers do, so a file
   * protected only by an owner password ("restricted") loads decrypted and
   * editable; its permission flags are not enforced. A given password that
   * is wrong throws, whatever `ignoreEncryption` says.
   */
  password?: string;
  /** Load document for incremental updates (preserves original bytes for digital signatures) */
  forIncrementalUpdate?: boolean;
  /**
   * Maximum decoded size, in bytes, of any single stream in this document
   * (protects against decompression bombs). Decoding a larger stream throws
   * `DecodedStreamTooLargeError`. Defaults to `DecodeStream.maxDecodedSize`
   * (512 MiB unless changed globally). Use `Infinity` to disable. The same
   * cap applies to PNG images passed to this document's `embedPng`, and to
   * the declared decompressed size of WOFF/WOFF2 fonts passed to `embedFont`
   * (bundled fontkit only; WOFF2's brotli decoding itself is not bounded).
   */
  maxDecodedStreamSize?: number;
  /**
   * Copy each stream's bytes out of the input while parsing (the default).
   * With `false`, stream bodies are views into the input instead, so a large
   * PDF is held in memory once rather than twice. The input is then
   * borrowed from the call to `load` on: it must not be modified, reused or
   * detached (for example by transferring its `ArrayBuffer`) while the
   * document is in use, and its whole backing allocation stays in memory as
   * long as any loaded stream does, also after [[PDFDocument.commit]]. A
   * `Uint8Array` or `ArrayBuffer` input is aliased, not copied; a string
   * input is decoded into a private array. Writing into a stream's
   * `getContents()` or into attachment data from
   * [[PDFDocument.getSavedAttachments]] writes into the input, and with
   * `forIncrementalUpdate` into the original revision that incremental
   * saves emit, which can break its signatures. Streams decrypted on load
   * are fresh arrays either way, except under the /Identity crypt filter.
   */
  copyStreams?: boolean;
}

export interface CreateOptions {
  updateMetadata?: boolean;
}

export interface EmbedFontOptions {
  subset?: boolean;
  customName?: string;
  features?: TypeFeatures;
  /**
   * PostScript name of the face to embed when the font data is a collection
   * (e.g. a `.ttc` file or a DFont). For a variable font it may name a named
   * instance. Ignored for single, non-variable font files.
   */
  postscriptName?: string;
}

export interface SetTitleOptions {
  showInWindowTitleBar: boolean;
}
