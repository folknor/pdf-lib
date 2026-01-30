/**
 * Restructure - EncodeStream
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */
const textEncoder = new TextEncoder();
const isBigEndian = new Uint8Array(new Uint16Array([0x1234]).buffer)[0] === 0x12;
function stringToUtf16(string, swap) {
    const buf = new Uint16Array(string.length);
    for (let i = 0; i < string.length; i++) {
        let code = string.charCodeAt(i);
        if (swap) {
            code = (code >> 8) | ((code & 0xff) << 8);
        }
        buf[i] = code;
    }
    return new Uint8Array(buf.buffer);
}
function stringToAscii(string) {
    const buf = new Uint8Array(string.length);
    for (let i = 0; i < string.length; i++) {
        // Match node.js behavior - encoding allows 8-bit rather than 7-bit.
        buf[i] = string.charCodeAt(i);
    }
    return buf;
}
export class EncodeStream {
    buffer;
    view;
    pos;
    constructor(buffer) {
        this.buffer = buffer;
        this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
        this.pos = 0;
    }
    writeBuffer(buffer) {
        this.buffer.set(buffer, this.pos);
        this.pos += buffer.length;
    }
    writeString(string, encoding = 'ascii') {
        let buf;
        switch (encoding) {
            case 'utf16le':
            case 'utf16-le':
            case 'ucs2':
                buf = stringToUtf16(string, isBigEndian);
                break;
            case 'utf16be':
            case 'utf16-be':
                buf = stringToUtf16(string, !isBigEndian);
                break;
            case 'utf8':
                buf = textEncoder.encode(string);
                break;
            case 'ascii':
                buf = stringToAscii(string);
                break;
            default:
                throw new Error(`Unsupported encoding: ${encoding}`);
        }
        this.writeBuffer(buf);
    }
    writeUInt8(val) {
        this.view.setUint8(this.pos, val);
        this.pos += 1;
    }
    writeUInt16BE(val) {
        this.view.setUint16(this.pos, val, false);
        this.pos += 2;
    }
    writeUInt16LE(val) {
        this.view.setUint16(this.pos, val, true);
        this.pos += 2;
    }
    writeUInt24BE(val) {
        this.buffer[this.pos++] = (val >>> 16) & 0xff;
        this.buffer[this.pos++] = (val >>> 8) & 0xff;
        this.buffer[this.pos++] = val & 0xff;
    }
    writeUInt24LE(val) {
        this.buffer[this.pos++] = val & 0xff;
        this.buffer[this.pos++] = (val >>> 8) & 0xff;
        this.buffer[this.pos++] = (val >>> 16) & 0xff;
    }
    writeUInt32BE(val) {
        this.view.setUint32(this.pos, val, false);
        this.pos += 4;
    }
    writeUInt32LE(val) {
        this.view.setUint32(this.pos, val, true);
        this.pos += 4;
    }
    writeInt8(val) {
        this.view.setInt8(this.pos, val);
        this.pos += 1;
    }
    writeInt16BE(val) {
        this.view.setInt16(this.pos, val, false);
        this.pos += 2;
    }
    writeInt16LE(val) {
        this.view.setInt16(this.pos, val, true);
        this.pos += 2;
    }
    writeInt24BE(val) {
        if (val >= 0) {
            this.writeUInt24BE(val);
        }
        else {
            this.writeUInt24BE(val + 0xffffff + 1);
        }
    }
    writeInt24LE(val) {
        if (val >= 0) {
            this.writeUInt24LE(val);
        }
        else {
            this.writeUInt24LE(val + 0xffffff + 1);
        }
    }
    writeInt32BE(val) {
        this.view.setInt32(this.pos, val, false);
        this.pos += 4;
    }
    writeInt32LE(val) {
        this.view.setInt32(this.pos, val, true);
        this.pos += 4;
    }
    writeFloatBE(val) {
        this.view.setFloat32(this.pos, val, false);
        this.pos += 4;
    }
    writeFloatLE(val) {
        this.view.setFloat32(this.pos, val, true);
        this.pos += 4;
    }
    writeDoubleBE(val) {
        this.view.setFloat64(this.pos, val, false);
        this.pos += 8;
    }
    writeDoubleLE(val) {
        this.view.setFloat64(this.pos, val, true);
        this.pos += 8;
    }
    fill(val, length) {
        if (length < this.buffer.length) {
            this.buffer.fill(val, this.pos, this.pos + length);
            this.pos += length;
        }
        else {
            const buf = new Uint8Array(length);
            buf.fill(val);
            this.writeBuffer(buf);
        }
    }
}
//# sourceMappingURL=EncodeStream.js.map