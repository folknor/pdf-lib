import type PDFRawStream from '../objects/PDFRawStream.js';
import PDFObjectParser from './PDFObjectParser.js';
declare class PDFObjectStreamParser extends PDFObjectParser {
    static forStream: (rawStream: PDFRawStream, shouldWaitForTick?: () => boolean) => PDFObjectStreamParser;
    private alreadyParsed;
    private readonly shouldWaitForTick;
    private readonly firstOffset;
    private readonly objectCount;
    constructor(rawStream: PDFRawStream, shouldWaitForTick?: () => boolean);
    parseIntoContext(): Promise<void>;
    private parseOffsetsAndObjectNumbers;
}
export default PDFObjectStreamParser;
//# sourceMappingURL=PDFObjectStreamParser.d.ts.map