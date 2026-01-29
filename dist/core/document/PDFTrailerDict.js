import CharCodes from '../syntax/CharCodes.js';
class PDFTrailerDict {
    static of = (dict) => new PDFTrailerDict(dict);
    dict;
    constructor(dict) {
        this.dict = dict;
    }
    toString() {
        return `trailer\n${this.dict.toString()}`;
    }
    sizeInBytes() {
        return 8 + this.dict.sizeInBytes();
    }
    copyBytesInto(buffer, offset) {
        const initialOffset = offset;
        buffer[offset++] = CharCodes.t;
        buffer[offset++] = CharCodes.r;
        buffer[offset++] = CharCodes.a;
        buffer[offset++] = CharCodes.i;
        buffer[offset++] = CharCodes.l;
        buffer[offset++] = CharCodes.e;
        buffer[offset++] = CharCodes.r;
        buffer[offset++] = CharCodes.Newline;
        offset += this.dict.copyBytesInto(buffer, offset);
        return offset - initialOffset;
    }
}
export default PDFTrailerDict;
//# sourceMappingURL=PDFTrailerDict.js.map