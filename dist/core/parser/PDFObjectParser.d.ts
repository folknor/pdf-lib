import type { CipherTransformFactory } from '../crypto.js';
import { type Position } from '../errors.js';
import PDFArray from '../objects/PDFArray.js';
import PDFDict from '../objects/PDFDict.js';
import PDFHexString from '../objects/PDFHexString.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import type PDFObject from '../objects/PDFObject.js';
import PDFRef from '../objects/PDFRef.js';
import type PDFStream from '../objects/PDFStream.js';
import PDFString from '../objects/PDFString.js';
import type PDFContext from '../PDFContext.js';
import BaseParser from './BaseParser.js';
import ByteStream from './ByteStream.js';
declare class PDFObjectParser extends BaseParser {
    static forBytes: (bytes: Uint8Array, context: PDFContext, capNumbers?: boolean) => PDFObjectParser;
    static forByteStream: (byteStream: ByteStream, context: PDFContext, capNumbers?: boolean) => PDFObjectParser;
    protected readonly context: PDFContext;
    private readonly cryptoFactory;
    constructor(byteStream: ByteStream, context: PDFContext, capNumbers?: boolean, cryptoFactory?: CipherTransformFactory);
    parseObject(ref?: PDFRef): PDFObject;
    protected parseNumberOrRef(): PDFNumber | PDFRef;
    protected parseHexString(ref?: PDFRef): PDFHexString;
    protected parseString(ref?: PDFRef): PDFString;
    protected parseName(): PDFName;
    protected parseArray(ref?: PDFRef): PDFArray;
    protected parseDict(ref?: PDFRef): PDFDict;
    protected parseDictOrStream(ref?: PDFRef): PDFDict | PDFStream;
    protected findEndOfStreamFallback(startPos: Position): number;
    /**
     * Match a keyword only if it's preceded by a valid delimiter character.
     * This prevents matching keywords that appear within longer words
     * (e.g., "bitstream" should not match "stream").
     */
    private matchPrefixedKeyword;
}
export default PDFObjectParser;
//# sourceMappingURL=PDFObjectParser.d.ts.map