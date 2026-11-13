import { inflateSync } from 'fflate';
import * as r from '../vendors/restructure/index.js';
import TTFFont from './TTFFont.js';
import WOFFDirectory from './tables/WOFFDirectory.js';
import { asciiDecoder } from './utils.js';

export default class WOFFFont extends TTFFont {
  override type: string = 'WOFF';
  declare _decompressed?: boolean;

  static override probe(buffer: Uint8Array): boolean {
    return asciiDecoder.decode(buffer.slice(0, 4)) === 'wOFF';
  }

  override _decodeDirectory(): void {
    this.directory = WOFFDirectory.decode(this.stream, { _startOffset: 0 });
  }

  // Inflates every table into one buffer (4-byte aligned, as in an SFNT) and
  // points the directory offsets into it. Decoding each table from its own
  // inflated stream is not enough: gvar and sbix resolve their data offsets
  // against the table start and then read `this.stream`, so those offsets
  // must index the stream the font reads.
  override _decompress(): void {
    if (this._decompressed) return;

    const entries = Object.values(this.directory.tables) as any[];
    let size = 0;
    for (const entry of entries) {
      size += (entry.length + 3) & ~3;
    }

    const out = new Uint8Array(size);
    let pos = 0;
    for (const entry of entries) {
      this.stream.pos = entry.offset;
      if (entry.compLength < entry.length) {
        this.stream.pos += 2; // skip the zlib header; inflateSync is raw
        const table = inflateSync(
          this.stream.readBuffer(entry.compLength - 2),
          { out: new Uint8Array(entry.length) },
        );
        out.set(table, pos);
      } else {
        out.set(this.stream.readBuffer(entry.length), pos);
      }
      entry.offset = pos;
      pos += (entry.length + 3) & ~3;
    }

    this.stream = new r.DecodeStream(out);
    this._decompressed = true;
  }
}
