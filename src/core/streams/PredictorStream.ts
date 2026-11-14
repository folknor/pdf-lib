import { InvalidDecodeParmsError } from "../errors.js";
import DecodeStream from "./DecodeStream.js";
import type { StreamType } from "./Stream.js";

export interface PredictorParams {
  /** 2 (TIFF) or 10-15 (PNG; each row's own tag byte governs). */
  predictor: number;
  colors: number;
  bitsPerComponent: 1 | 2 | 4 | 8 | 16;
  columns: number;
}

/**
 * Reverses a TIFF or PNG predictor (ISO 32000-1 7.4.4.4) over the output of
 * the Flate or LZW stage it belongs to.
 *
 * A final row shorter than the declared geometry is refused when `strict`;
 * otherwise it is reconstructed as far as its bytes go: PNG emits the bytes
 * it has, TIFF emits the whole samples it has and drops a trailing partial
 * 16-bit sample (lossy recovery, never synthesised data). TIFF row padding
 * bits pass through unchanged. The decoded-size cap also bounds the declared
 * row size, checked before any row is allocated.
 */
class PredictorStream extends DecodeStream {
  private readonly source: StreamType;
  private readonly params: PredictorParams;
  private readonly strict: boolean;
  private readonly rowBytes: number;
  private readonly pixelBytes: number;
  private prevRow: Uint8Array | undefined;

  constructor(
    source: StreamType,
    params: PredictorParams,
    strict: boolean,
    maxDecodedSize: number,
  ) {
    super();
    this.maxDecodedSize = maxDecodedSize;
    this.source = source;
    this.params = params;
    this.strict = strict;
    const rowBits = params.colors * params.bitsPerComponent * params.columns;

    if (!Number.isSafeInteger(rowBits)) {
      throw new InvalidDecodeParmsError("predictor row size is too large");
    }

    this.rowBytes = Math.ceil(rowBits / 8);

    if (this.rowBytes > maxDecodedSize) {
      throw new InvalidDecodeParmsError(
        `predictor row of ${this.rowBytes} bytes exceeds the decoded-size limit of ${maxDecodedSize}`,
      );
    }

    this.pixelBytes = Math.max(1, Math.ceil((params.colors * params.bitsPerComponent) / 8));
  }

  protected override readBlock(): void {
    if (this.params.predictor === 2) this.readTiffRow();
    else this.readPngRow();
  }

  private short(): never {
    throw new InvalidDecodeParmsError("the predicted data ends mid-row");
  }

  private readPngRow(): void {
    const { rowBytes, pixelBytes } = this;
    const row = this.source.getBytes(rowBytes + 1);

    if (row.length === 0) {
      this.eof = true;

      return;
    }

    const tag = row[0]!;

    if (tag > 4) {
      throw new InvalidDecodeParmsError(`unknown PNG predictor tag ${tag}`);
    }

    const length = row.length - 1;

    if (length < rowBytes) {
      if (this.strict) this.short();
      this.eof = true;
    }

    if (this.prevRow === undefined) this.prevRow = new Uint8Array(rowBytes);
    const up = this.prevRow;
    const start = this.bufferLength;
    const out = this.ensureBuffer(start + length);

    for (let i = 0; i < length; i++) {
      const raw = row[i + 1]!;
      const left = i >= pixelBytes ? out[start + i - pixelBytes]! : 0;
      const above = up[i]!;
      let value: number;

      if (tag === 0) value = raw;
      else if (tag === 1) value = raw + left;
      else if (tag === 2) value = raw + above;
      else if (tag === 3) value = raw + ((left + above) >> 1);
      else {
        const upLeft = i >= pixelBytes ? up[i - pixelBytes]! : 0;
        const p = left + above - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - above);
        const pc = Math.abs(p - upLeft);
        value = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? above : upLeft);
      }

      out[start + i] = value & 0xff;
    }

    up.set(out.subarray(start, start + length));
    this.bufferLength = start + length;
  }

  private readTiffRow(): void {
    const { rowBytes } = this;
    const { colors, bitsPerComponent: bpc, columns } = this.params;
    const row = this.source.getBytes(rowBytes);

    if (row.length === 0) {
      this.eof = true;

      return;
    }

    let length = row.length;

    if (length < rowBytes) {
      if (this.strict) this.short();
      this.eof = true;

      if (bpc === 16) length -= length % 2;
    }

    const start = this.bufferLength;
    const out = this.ensureBuffer(start + length);
    // Start from the source row so padding bits pass through untouched.
    out.set(row.subarray(0, length), start);
    const samples = Math.min(colors * columns, Math.floor((length * 8) / bpc));

    if (bpc === 8) {
      for (let i = colors; i < samples; i++) {
        out[start + i] = (out[start + i]! + out[start + i - colors]!) & 0xff;
      }
    } else if (bpc === 16) {
      for (let i = colors; i < samples; i++) {
        const at = start + 2 * i;
        const prev = start + 2 * (i - colors);

        const sum =
          (((out[at]! << 8) | out[at + 1]!) + ((out[prev]! << 8) | out[prev + 1]!)) & 0xffff;

        out[at] = sum >> 8;
        out[at + 1] = sum & 0xff;
      }
    } else {
      const mask = (1 << bpc) - 1;

      // Sample sizes divide 8, so no sample straddles a byte. Plain
      // arithmetic: bit offsets can pass 2^31.
      const read = (i: number) => {
        const bit = i * bpc;

        return (out[start + Math.floor(bit / 8)]! >> (8 - bpc - (bit % 8))) & mask;
      };

      for (let i = colors; i < samples; i++) {
        const value = (read(i) + read(i - colors)) & mask;
        const bit = i * bpc;
        const at = start + Math.floor(bit / 8);
        const shift = 8 - bpc - (bit % 8);
        out[at] = (out[at]! & ~(mask << shift)) | (value << shift);
      }
    }

    this.bufferLength = start + length;
  }
}

export default PredictorStream;
