/**
 * Type declarations for the brotli npm package
 */

declare module 'brotli/decompress' {
  /**
   * Decompress a brotli-compressed buffer
   * @param buffer - The compressed data
   * @param size - Expected output size
   * @returns The decompressed data as Uint8Array
   */
  function decompress(buffer: Uint8Array, size?: number): Uint8Array | null;
  export default decompress;
}

declare module 'brotli/decompress.js' {
  export { default } from 'brotli/decompress';
}
