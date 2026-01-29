import PDFObject from './PDFObject.js';
class PDFInvalidObject extends PDFObject {
    static of = (data) => new PDFInvalidObject(data);
    data;
    constructor(data) {
        super();
        this.data = data;
    }
    clone() {
        return PDFInvalidObject.of(this.data.slice());
    }
    toString() {
        return `PDFInvalidObject(${this.data.length} bytes)`;
    }
    sizeInBytes() {
        return this.data.length;
    }
    copyBytesInto(buffer, offset) {
        const length = this.data.length;
        for (let idx = 0; idx < length; idx++) {
            buffer[offset++] = this.data[idx];
        }
        return length;
    }
}
export default PDFInvalidObject;
//# sourceMappingURL=PDFInvalidObject.js.map