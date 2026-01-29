import DecodeStream from './DecodeStream.js';
import type { StreamType } from './Stream.js';
type DecryptFnType = (arg1: Uint8Array | Uint8ClampedArray, arg2: boolean) => Uint8Array;
declare class DecryptStream extends DecodeStream {
    private stream;
    private initialized;
    private nextChunk;
    private decrypt;
    constructor(stream: StreamType, decrypt: DecryptFnType, maybeLength?: number);
    readBlock(): void;
}
export default DecryptStream;
//# sourceMappingURL=DecryptStream.d.ts.map