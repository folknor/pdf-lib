import { charFromCode, copyStringIntoBuffer } from '../../utils/index.js';
import CharCodes from '../syntax/CharCodes.js';
class PDFHeader {
    static forVersion = (major, minor) => new PDFHeader(major, minor);
    major;
    minor;
    constructor(major, minor) {
        this.major = String(major);
        this.minor = String(minor);
    }
    getVersionString() {
        return `${this.major}.${this.minor}`;
    }
    toString() {
        const bc = charFromCode(129);
        return `%PDF-${this.major}.${this.minor}\n%${bc}${bc}${bc}${bc}`;
    }
    sizeInBytes() {
        return 12 + this.major.length + this.minor.length;
    }
    copyBytesInto(buffer, offset) {
        const initialOffset = offset;
        buffer[offset++] = CharCodes.Percent;
        buffer[offset++] = CharCodes.P;
        buffer[offset++] = CharCodes.D;
        buffer[offset++] = CharCodes.F;
        buffer[offset++] = CharCodes.Dash;
        offset += copyStringIntoBuffer(this.major, buffer, offset);
        buffer[offset++] = CharCodes.Period;
        offset += copyStringIntoBuffer(this.minor, buffer, offset);
        buffer[offset++] = CharCodes.Newline;
        buffer[offset++] = CharCodes.Percent;
        buffer[offset++] = 129;
        buffer[offset++] = 129;
        buffer[offset++] = 129;
        buffer[offset++] = 129;
        return offset - initialOffset;
    }
}
export default PDFHeader;
//# sourceMappingURL=PDFHeader.js.map