/**
 * Restructure - DecodeStream
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */

// Node back-compat encoding mapping
const ENCODING_MAPPING: Record<string, string> = {
  utf16le: 'utf-16le',
  ucs2: 'utf-16le',
  utf16be: 'utf-16be',
};

export const TYPES: Record<string, number> = {
  UInt8: 1,
  UInt16: 2,
  UInt24: 3,
  UInt32: 4,
  Int8: 1,
  Int16: 2,
  Int24: 3,
  Int32: 4,
  Float: 4,
  Double: 8,
};

export class DecodeStream {
  buffer: Uint8Array;
  view: DataView;
  pos: number;
  length: number;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    this.pos = 0;
    this.length = this.buffer.length;
  }

  readString(length: number, encoding = 'ascii'): string | Uint8Array {
    encoding = ENCODING_MAPPING[encoding] || encoding;
    const buf = this.readBuffer(length);
    try {
      const decoder = new TextDecoder(encoding);
      return decoder.decode(buf);
    } catch {
      return buf;
    }
  }

  readBuffer(length: number): Uint8Array {
    return this.buffer.slice(this.pos, (this.pos += length));
  }

  readUInt8(): number {
    const ret = this.view.getUint8(this.pos);
    this.pos += 1;
    return ret;
  }

  readUInt16BE(): number {
    const ret = this.view.getUint16(this.pos, false);
    this.pos += 2;
    return ret;
  }

  readUInt16LE(): number {
    const ret = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return ret;
  }

  readUInt24BE(): number {
    return (this.readUInt16BE() << 8) + this.readUInt8();
  }

  readUInt24LE(): number {
    return this.readUInt16LE() + (this.readUInt8() << 16);
  }

  readUInt32BE(): number {
    const ret = this.view.getUint32(this.pos, false);
    this.pos += 4;
    return ret;
  }

  readUInt32LE(): number {
    const ret = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return ret;
  }

  readInt8(): number {
    const ret = this.view.getInt8(this.pos);
    this.pos += 1;
    return ret;
  }

  readInt16BE(): number {
    const ret = this.view.getInt16(this.pos, false);
    this.pos += 2;
    return ret;
  }

  readInt16LE(): number {
    const ret = this.view.getInt16(this.pos, true);
    this.pos += 2;
    return ret;
  }

  readInt24BE(): number {
    return (this.readInt16BE() << 8) + this.readUInt8();
  }

  readInt24LE(): number {
    return this.readUInt16LE() + (this.readInt8() << 16);
  }

  readInt32BE(): number {
    const ret = this.view.getInt32(this.pos, false);
    this.pos += 4;
    return ret;
  }

  readInt32LE(): number {
    const ret = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return ret;
  }

  readFloatBE(): number {
    const ret = this.view.getFloat32(this.pos, false);
    this.pos += 4;
    return ret;
  }

  readFloatLE(): number {
    const ret = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return ret;
  }

  readDoubleBE(): number {
    const ret = this.view.getFloat64(this.pos, false);
    this.pos += 8;
    return ret;
  }

  readDoubleLE(): number {
    const ret = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return ret;
  }
}
