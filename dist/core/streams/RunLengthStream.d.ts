import DecodeStream from './DecodeStream.js';
import type { StreamType } from './Stream.js';
declare class RunLengthStream extends DecodeStream {
    private stream;
    constructor(stream: StreamType, maybeLength?: number);
    protected readBlock(): void;
}
export default RunLengthStream;
//# sourceMappingURL=RunLengthStream.d.ts.map