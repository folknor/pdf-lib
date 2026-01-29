import DecodeStream from '../../core/streams/DecodeStream.js';
import type { StreamType } from '../../core/streams/Stream.js';
declare class FlateStream extends DecodeStream {
    private stream;
    private codeSize;
    private codeBuf;
    constructor(stream: StreamType, maybeLength?: number);
    protected readBlock(): void;
    private getBits;
    private getCode;
    private generateHuffmanTable;
}
export default FlateStream;
//# sourceMappingURL=FlateStream.d.ts.map