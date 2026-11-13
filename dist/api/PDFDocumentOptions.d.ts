import type { EmbeddedFileOptions } from '../core/embedders/FileEmbedder.js';
import type { TypeFeatures } from '../types/fontkit.js';
export declare enum ParseSpeeds {
    Fastest = Infinity,
    Fast = 1500,
    Medium = 500,
    Slow = 100
}
export type AttachmentOptions = EmbeddedFileOptions;
export interface SaveOptions {
    useObjectStreams?: boolean;
    addDefaultPage?: boolean;
    objectsPerTick?: number;
    updateFieldAppearances?: boolean;
    /** Force a full rewrite instead of incremental save (only applies when loaded with forIncrementalUpdate) */
    rewrite?: boolean;
    /** Compress uncompressed streams using FlateDecode to reduce file size */
    compress?: boolean;
    /**
     * Fill gaps in xref table with deleted entries instead of creating multiple
     * subsections. This prevents xref fragmentation which can cause Adobe Reader
     * to invalidate digital signatures on incremental updates.
     */
    fillXrefGaps?: boolean;
}
export interface IncrementalSaveOptions {
    objectsPerTick?: number;
    useObjectStreams?: boolean;
    /** Compress uncompressed streams using FlateDecode to reduce file size */
    compress?: boolean;
    /**
     * Fill gaps in xref table with deleted entries instead of creating multiple
     * subsections. This prevents xref fragmentation which can cause Adobe Reader
     * to invalidate digital signatures on incremental updates.
     */
    fillXrefGaps?: boolean;
}
export interface Base64SaveOptions extends SaveOptions {
    dataUri?: boolean;
}
export interface LoadOptions {
    ignoreEncryption?: boolean;
    parseSpeed?: ParseSpeeds | number;
    throwOnInvalidObject?: boolean;
    warnOnInvalidObjects?: boolean;
    updateMetadata?: boolean;
    capNumbers?: boolean;
    password?: string;
    /** Load document for incremental updates (preserves original bytes for digital signatures) */
    forIncrementalUpdate?: boolean;
    /**
     * Maximum decoded size, in bytes, of any single stream in this document
     * (protects against decompression bombs). Decoding a larger stream throws
     * `DecodedStreamTooLargeError`. Defaults to `DecodeStream.maxDecodedSize`
     * (512 MiB unless changed globally). Use `Infinity` to disable.
     */
    maxDecodedStreamSize?: number;
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
//# sourceMappingURL=PDFDocumentOptions.d.ts.map