/**
 * Something the library recovered from or ignored, reported instead of
 * thrown. Every warning the library emits goes through the owning
 * document's handler (`LoadOptions.onWarning` / `CreateOptions.onWarning`);
 * the library never writes to the console except through the default
 * handler.
 */
export type PDFWarningCode =
  /** A parsed number above Number.MAX_SAFE_INTEGER, replaced by it (`capNumbers`). */
  | "number-too-large-capped"
  /** A parsed number above Number.MAX_SAFE_INTEGER, kept as is. */
  | "number-too-large"
  /** An object the parser could not read, kept as raw bytes (PDFInvalidObject). */
  | "invalid-object-recovered"
  /** A reconstructing parse met an object numbered 0 and dropped it. */
  | "object-zero-removed"
  /** An AES-256 /Perms entry disagrees with the encryption dictionary. */
  | "encryption-perms-inconsistent"
  /** getForm() removed XFA data. */
  | "xfa-removed"
  /** enableCombing() on a text field with no max length. */
  | "comb-without-max-length";

export interface PDFWarning {
  code: PDFWarningCode;
  message: string;
}

export type PDFWarningHandler = (warning: PDFWarning) => void;

export const consoleWarningHandler: PDFWarningHandler = (warning) => {
  console.warn(warning.message);
};

export const silentWarningHandler: PDFWarningHandler = () => {};
