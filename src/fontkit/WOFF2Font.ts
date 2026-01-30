import brotli from 'brotli/decompress.js';
import * as r from '../vendors/restructure/index.js';
import type Glyph from './glyph/Glyph.js';
import TTFGlyph, { Point } from './glyph/TTFGlyph.js';
import WOFF2Glyph from './glyph/WOFF2Glyph.js';
import TTFFont from './TTFFont.js';
import WOFF2Directory from './tables/WOFF2Directory.js';
import { asciiDecoder } from './utils.js';

interface TransformedGlyph {
  numberOfContours: number;
  points?: Point[];
  components?: any[];
}

/**
 * Subclass of TTFFont that represents a TTF/OTF font compressed by WOFF2
 * See spec here: http://www.w3.org/TR/WOFF2/
 */
export default class WOFF2Font extends TTFFont {
  override type: string = 'WOFF2';
  _dataPos!: number;
  _decompressed?: boolean;
  _transformedGlyphs?: TransformedGlyph[];

  static override probe(buffer: Uint8Array): boolean {
    return asciiDecoder.decode(buffer.slice(0, 4)) === 'wOF2';
  }

  override _decodeDirectory(): void {
    this.directory = WOFF2Directory.decode(this.stream);
    this._dataPos = this.stream.pos;
  }

  _decompress(): void {
    // decompress data and setup table offsets if we haven't already
    if (!this._decompressed) {
      this.stream.pos = this._dataPos;
      const buffer = this.stream.readBuffer(this.directory.totalCompressedSize);

      let decompressedSize = 0;
      for (const tag in this.directory.tables) {
        const entry = this.directory.tables[tag];
        entry.offset = decompressedSize;
        decompressedSize +=
          entry.transformLength != null ? entry.transformLength : entry.length;
      }

      const decompressed = brotli(buffer, decompressedSize);
      if (!decompressed) {
        throw new Error('Error decoding compressed data in WOFF2');
      }

      this.stream = new r.DecodeStream(decompressed);
      this._decompressed = true;
    }
  }

  override _decodeTable(table: any): any {
    this._decompress();
    return super._decodeTable(table);
  }

  // Override this method to get a glyph and return our
  // custom subclass if there is a glyf table.
  override _getBaseGlyph(
    glyph: number,
    characters: number[] = [],
  ): Glyph | null {
    if (!this._glyphs[glyph]) {
      if (this.directory.tables.glyf?.transformed) {
        if (!this._transformedGlyphs) {
          this._transformGlyfTable();
        }
        return (this._glyphs[glyph] = new WOFF2Glyph(glyph, characters, this));
      } else {
        return super._getBaseGlyph(glyph, characters);
      }
    }
    return this._glyphs[glyph] || null;
  }

  _transformGlyfTable(): void {
    this._decompress();
    this.stream.pos = this.directory.tables.glyf.offset;
    const table: any = GlyfTable.decode(this.stream);
    const glyphs: TransformedGlyph[] = [];

    for (let index = 0; index < table['numGlyphs']; index++) {
      const glyph: TransformedGlyph = { numberOfContours: 0 };
      const nContours = table['nContours'].readInt16BE();
      glyph.numberOfContours = nContours;

      if (nContours > 0) {
        // simple glyph
        const nPoints: number[] = [];
        let totalPoints = 0;

        for (let i = 0; i < nContours; i++) {
          const pointCount = read255UInt16(table['nPoints']);
          totalPoints += pointCount;
          nPoints.push(totalPoints);
        }

        glyph.points = decodeTriplet(
          table['flags'],
          table['glyphs'],
          totalPoints,
        );
        for (let i = 0; i < nContours; i++) {
          glyph.points[nPoints[i]! - 1]!.endContour = true;
        }

        read255UInt16(table['glyphs']);
      } else if (nContours < 0) {
        // composite glyph
        const haveInstructions = TTFGlyph.prototype._decodeComposite.call(
          { _font: this },
          glyph as any,
          table['composites'],
        );
        if (haveInstructions) {
          read255UInt16(table['glyphs']);
        }
      }

      glyphs.push(glyph);
    }

    this._transformedGlyphs = glyphs;
  }
}

// Special class that accepts a length and returns a sub-stream for that data
class Substream {
  length: string | number;
  _buf: r.Buffer;

  constructor(length: string | number) {
    this.length = length;
    this._buf = new r.Buffer(length);
  }

  decode(stream: r.DecodeStream, parent: any): r.DecodeStream {
    return new r.DecodeStream(this._buf.decode(stream, parent));
  }
}

// This struct represents the entire glyf table
const GlyfTable = new r.Struct({
  version: r.uint32,
  numGlyphs: r.uint16,
  indexFormat: r.uint16,
  nContourStreamSize: r.uint32,
  nPointsStreamSize: r.uint32,
  flagStreamSize: r.uint32,
  glyphStreamSize: r.uint32,
  compositeStreamSize: r.uint32,
  bboxStreamSize: r.uint32,
  instructionStreamSize: r.uint32,
  nContours: new Substream('nContourStreamSize') as any,
  nPoints: new Substream('nPointsStreamSize') as any,
  flags: new Substream('flagStreamSize') as any,
  glyphs: new Substream('glyphStreamSize') as any,
  composites: new Substream('compositeStreamSize') as any,
  bboxes: new Substream('bboxStreamSize') as any,
  instructions: new Substream('instructionStreamSize') as any,
});

const WORD_CODE = 253;
const ONE_MORE_BYTE_CODE2 = 254;
const ONE_MORE_BYTE_CODE1 = 255;
const LOWEST_U_CODE = 253;

function read255UInt16(stream: r.DecodeStream): number {
  const code = stream.readUInt8();

  if (code === WORD_CODE) {
    return stream.readUInt16BE();
  }

  if (code === ONE_MORE_BYTE_CODE1) {
    return stream.readUInt8() + LOWEST_U_CODE;
  }

  if (code === ONE_MORE_BYTE_CODE2) {
    return stream.readUInt8() + LOWEST_U_CODE * 2;
  }

  return code;
}

function withSign(flag: number, baseval: number): number {
  return flag & 1 ? baseval : -baseval;
}

function decodeTriplet(
  flags: r.DecodeStream,
  glyphs: r.DecodeStream,
  nPoints: number,
): Point[] {
  let y;
  let x = (y = 0);
  const res = [];

  for (let i = 0; i < nPoints; i++) {
    let dx = 0,
      dy = 0;
    let flag = flags.readUInt8();
    const onCurve = !(flag >> 7);
    flag &= 0x7f;

    if (flag < 10) {
      dx = 0;
      dy = withSign(flag, ((flag & 14) << 7) + glyphs.readUInt8());
    } else if (flag < 20) {
      dx = withSign(flag, (((flag - 10) & 14) << 7) + glyphs.readUInt8());
      dy = 0;
    } else if (flag < 84) {
      const b0_84 = flag - 20;
      const b1_84 = glyphs.readUInt8();
      dx = withSign(flag, 1 + (b0_84 & 0x30) + (b1_84 >> 4));
      dy = withSign(flag >> 1, 1 + ((b0_84 & 0x0c) << 2) + (b1_84 & 0x0f));
    } else if (flag < 120) {
      const b0_120 = flag - 84;
      dx = withSign(flag, 1 + ((b0_120 / 12) << 8) + glyphs.readUInt8());
      dy = withSign(
        flag >> 1,
        1 + (((b0_120 % 12) >> 2) << 8) + glyphs.readUInt8(),
      );
    } else if (flag < 124) {
      const b1_124 = glyphs.readUInt8();
      const b2 = glyphs.readUInt8();
      dx = withSign(flag, (b1_124 << 4) + (b2 >> 4));
      dy = withSign(flag >> 1, ((b2 & 0x0f) << 8) + glyphs.readUInt8());
    } else {
      dx = withSign(flag, glyphs.readUInt16BE());
      dy = withSign(flag >> 1, glyphs.readUInt16BE());
    }

    x += dx;
    y += dy;
    res.push(new Point(onCurve, false, x, y));
  }

  return res;
}
