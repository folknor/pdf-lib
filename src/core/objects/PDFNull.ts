import CharCodes from '../syntax/CharCodes.js';
import PDFObject from './PDFObject.js';

class PDFNull extends PDFObject {
  asNull(): null {
    return null;
  }

  override clone(): PDFNull {
    return this;
  }

  override toString(): string {
    return 'null';
  }

  override sizeInBytes(): number {
    return 4;
  }

  override copyBytesInto(buffer: Uint8Array, offset: number): number {
    buffer[offset++] = CharCodes.n;
    buffer[offset++] = CharCodes.u;
    buffer[offset++] = CharCodes.l;
    buffer[offset++] = CharCodes.l;
    return 4;
  }
}

export default new PDFNull();
