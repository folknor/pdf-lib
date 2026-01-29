import { copyStringIntoBuffer, numberToString } from '../../utils/index.js';
import PDFObject from './PDFObject.js';
class PDFNumber extends PDFObject {
    static of = (value) => new PDFNumber(value);
    numberValue;
    stringValue;
    constructor(value) {
        super();
        this.numberValue = value;
        this.stringValue = numberToString(value);
    }
    asNumber() {
        return this.numberValue;
    }
    /** @deprecated in favor of [[PDFNumber.asNumber]] */
    value() {
        return this.numberValue;
    }
    clone() {
        return PDFNumber.of(this.numberValue);
    }
    toString() {
        return this.stringValue;
    }
    sizeInBytes() {
        return this.stringValue.length;
    }
    copyBytesInto(buffer, offset) {
        copyStringIntoBuffer(this.stringValue, buffer, offset);
        return this.stringValue.length;
    }
}
export default PDFNumber;
//# sourceMappingURL=PDFNumber.js.map