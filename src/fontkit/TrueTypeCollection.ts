// @ts-nocheck
import * as r from '../vendors/restructure/index.js';
import TTFFont from './TTFFont.js';
import { asciiDecoder } from './utils.js';

const TTCHeader = new r.VersionedStruct(r.uint32, {
  65536: {
    numFonts: r.uint32,
    offsets: new r.Array(r.uint32, 'numFonts'),
  },
  131072: {
    numFonts: r.uint32,
    offsets: new r.Array(r.uint32, 'numFonts'),
    dsigTag: r.uint32,
    dsigLength: r.uint32,
    dsigOffset: r.uint32,
  },
});

export default class TrueTypeCollection {
  type: string = 'TTC';
  stream: r.DecodeStream;
  header: any;

  static probe(buffer: Uint8Array): boolean {
    return asciiDecoder.decode(buffer.slice(0, 4)) === 'ttcf';
  }

  constructor(stream: r.DecodeStream) {
    this.stream = stream;
    if (stream.readString(4) !== 'ttcf') {
      throw new Error('Not a TrueType collection');
    }

    this.header = TTCHeader.decode(stream);
  }

  getFont(name: string | Uint8Array): TTFFont | null {
    for (const offset of this.header.offsets) {
      const stream = new r.DecodeStream(this.stream.buffer);
      stream.pos = offset;
      const font = new TTFFont(stream);
      if (
        font.postscriptName === name ||
        (font.postscriptName instanceof Uint8Array &&
          name instanceof Uint8Array &&
          font.postscriptName.every((v, i) => name[i] === v))
      ) {
        return font;
      }
    }

    return null;
  }

  get fonts() {
    const fonts = [];
    for (const offset of this.header.offsets) {
      const stream = new r.DecodeStream(this.stream.buffer);
      stream.pos = offset;
      fonts.push(new TTFFont(stream));
    }

    return fonts;
  }
}
