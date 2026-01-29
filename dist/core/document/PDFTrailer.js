import { copyStringIntoBuffer } from '../../utils/index.js';
import CharCodes from '../syntax/CharCodes.js';
class PDFTrailer {
    static forLastCrossRefSectionOffset = (offset) => new PDFTrailer(offset);
    lastXRefOffset;
    constructor(lastXRefOffset) {
        this.lastXRefOffset = String(lastXRefOffset);
    }
    toString() {
        return `startxref\n${this.lastXRefOffset}\n%%EOF`;
    }
    sizeInBytes() {
        return 16 + this.lastXRefOffset.length;
    }
    copyBytesInto(buffer, offset) {
        const initialOffset = offset;
        buffer[offset++] = CharCodes.s;
        buffer[offset++] = CharCodes.t;
        buffer[offset++] = CharCodes.a;
        buffer[offset++] = CharCodes.r;
        buffer[offset++] = CharCodes.t;
        buffer[offset++] = CharCodes.x;
        buffer[offset++] = CharCodes.r;
        buffer[offset++] = CharCodes.e;
        buffer[offset++] = CharCodes.f;
        buffer[offset++] = CharCodes.Newline;
        offset += copyStringIntoBuffer(this.lastXRefOffset, buffer, offset);
        buffer[offset++] = CharCodes.Newline;
        buffer[offset++] = CharCodes.Percent;
        buffer[offset++] = CharCodes.Percent;
        buffer[offset++] = CharCodes.E;
        buffer[offset++] = CharCodes.O;
        buffer[offset++] = CharCodes.F;
        return offset - initialOffset;
    }
}
export default PDFTrailer;
//# sourceMappingURL=PDFTrailer.js.map