import { inflateSync } from "fflate";
import { DecodedStreamTooLargeError } from "../core/errors.js";
import * as r from "../vendors/restructure/index.js";
import TTFFont from "./TTFFont.js";
import WOFFDirectory from "./tables/WOFFDirectory.js";
import { asciiDecoder } from "./utils.js";

export default class WOFFFont extends TTFFont {
  override type: string = "WOFF";

  static override probe(buffer: Uint8Array): boolean {
    return asciiDecoder.decode(buffer.slice(0, 4)) === "wOFF";
  }

  override _decodeDirectory(): void {
    this.directory = WOFFDirectory.decode(this.stream, { _startOffset: 0 });
  }

  // Inflates every table into one buffer (4-byte aligned, as in an SFNT) and
  // points the directory offsets into it. Decoding each table from its own
  // inflated stream is not enough: gvar and sbix resolve their data offsets
  // against the table start and then read `this.stream`, so those offsets
  // must index the stream the font reads.
  //
  // The buffer is sized from the declared (untrusted uint32) table lengths
  // and checked against the cap before anything is allocated. fflate never
  // grows a caller-supplied output buffer, so the declared lengths bound the
  // decoded table space.
  override _decompress(maxDecodedSize: number): void {
    const entries = Object.values(this.directory.tables) as any[];
    let size = 0;

    for (const entry of entries) {
      size += padded(entry.length);
    }

    if (size > maxDecodedSize) {
      throw new DecodedStreamTooLargeError(size, maxDecodedSize);
    }

    const out = new Uint8Array(size);
    let pos = 0;

    for (const entry of entries) {
      this.stream.pos = entry.offset;

      if (entry.compLength < entry.length) {
        this.stream.pos += 2; // skip the zlib header; inflateSync is raw

        const table = inflateSync(this.stream.readBuffer(entry.compLength - 2), {
          out: new Uint8Array(entry.length),
        });

        out.set(table, pos);
      } else {
        out.set(this.stream.readBuffer(entry.length), pos);
      }

      entry.offset = pos;
      pos += padded(entry.length);
    }

    this.stream = new r.DecodeStream(out);
  }
}

// Rounds a uint32 length up to a multiple of 4 without 32-bit wrapping.
const padded = (length: number): number => length + ((4 - (length % 4)) % 4);
