/**
 * Brotli Decompression
 * Wrapper around the brotli npm package for WOFF2 font support
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const brotliDecompress = require('brotli/decompress');
/**
 * Decompress a brotli-compressed buffer
 * @param buffer - The compressed data as Uint8Array
 * @returns The decompressed data as Uint8Array
 */
export function decompress(buffer) {
    return brotliDecompress(buffer);
}
export default decompress;
//# sourceMappingURL=index.js.map