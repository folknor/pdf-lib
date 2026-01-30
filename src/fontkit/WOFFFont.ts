import { inflateSync } from 'fflate';
import * as r from '../vendors/restructure/index.js';
import TTFFont from './TTFFont.js';
import WOFFDirectory from './tables/WOFFDirectory.js';
import { asciiDecoder } from './utils.js';

export default class WOFFFont extends TTFFont {
  override type: string = 'WOFF';

  static override probe(buffer: Uint8Array): boolean {
    return asciiDecoder.decode(buffer.slice(0, 4)) === 'wOFF';
  }

  override _decodeDirectory(): void {
    this.directory = WOFFDirectory.decode(this.stream, { _startOffset: 0 });
  }

  override _getTableStream(tag: string): r.DecodeStream | null {
    const table = this.directory.tables[tag];
    if (table) {
      this.stream.pos = table.offset;

      if (table.compLength < table.length) {
        this.stream.pos += 2; // skip deflate header
        const buf = inflateSync(this.stream.readBuffer(table.compLength - 2), {
          out: new Uint8Array(table.length),
        });
        return new r.DecodeStream(buf);
      } else {
        return this.stream;
      }
    }

    return null;
  }
}
