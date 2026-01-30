/**
 * Gets an encoding name from platform, encoding, and language ids.
 * Returned encoding names can be used in iconv-lite to decode text.
 */
export declare function getEncoding(platformID: number, encodingID: number, languageID?: number): string | null | undefined;
export declare function getEncodingMapping(encoding: string): Map<number, number> | undefined;
export declare const ENCODINGS: (string | null)[][];
export declare const MAC_LANGUAGE_ENCODINGS: Record<number, string>;
export declare const LANGUAGES: (string[] | Record<number, string>)[];
//# sourceMappingURL=encodings.d.ts.map