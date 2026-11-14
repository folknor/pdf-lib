/**
 * UPNG.js - PNG decoder
 * Originally from https://github.com/photopea/UPNG.js
 * Absorbed and converted to TypeScript for pdf-lib
 *
 * Only includes decoding of the static image (decode + toRGBA8), and every
 * buffer it allocates is sized from the IHDR header and checked against a
 * caller-supplied cap before allocation, so a decompression bomb cannot
 * exhaust memory. pdf-lib's changes from upstream:
 * - APNG frames are never decompressed: decode reports the frame count from
 *   acTL and the caller rejects animated images. A single-frame APNG decodes
 *   as its IDAT default image.
 * - Only IHDR, PLTE, tRNS, IDAT, CgBI, acTL and IEND are read. Ancillary
 *   chunks (iCCP, tEXt/zTXt/iTXt, pHYs, gAMA, ...) had no consumer, and the
 *   compressed ones were an unbounded inflate.
 * - IDAT data inflates into a buffer of exactly the filtered image size.
 *   Like libpng, excess output is ignored and short output leaves zero rows.
 */

import { inflateSync } from "fflate";
import { DecodedStreamTooLargeError } from "../core/errors.js";

// Types
export interface PNGImage {
  width: number;
  height: number;
  depth: number;
  ctype: number;
  interlace: number;
  data: Uint8Array;
  tabs: PNGTabs;
  /** Frame count declared by an APNG acTL chunk, 1 for a static PNG. */
  numFrames: number;
}

interface PNGTabs {
  PLTE?: number[];
  tRNS?: number | number[];
  CgBI?: boolean;
}

// Binary utilities
const _bin = {
  readUshort: (buff: Uint8Array, p: number): number => (buff[p]! << 8) | buff[p + 1]!,
  readUint: (buff: Uint8Array, p: number): number =>
    buff[p]! * (256 * 256 * 256) + ((buff[p + 1]! << 16) | (buff[p + 2]! << 8) | buff[p + 3]!),
  readASCII: (buff: Uint8Array, p: number, l: number): string => {
    let s = "";

    for (let i = 0; i < l; i++) s += String.fromCharCode(buff[p + i]!);

    return s;
  },
  readBytes: (buff: Uint8Array, p: number, l: number): number[] => {
    const arr: number[] = [];

    for (let i = 0; i < l; i++) arr.push(buff[p + i]!);

    return arr;
  },
};

/**
 * Convert the decoded static image to RGBA8.
 */
export function toRGBA8(out: PNGImage): ArrayBuffer {
  return decodeImage(out.data, out.width, out.height, out).buffer as ArrayBuffer;
}

function decodeImage(data: Uint8Array, w: number, h: number, out: PNGImage): Uint8Array {
  const area = w * h;
  const bpp = _getBPP(out);
  const bpl = Math.ceil((w * bpp) / 8);

  const bf = new Uint8Array(area * 4);
  const bf32 = new Uint32Array(bf.buffer);
  const ctype = out.ctype;
  const depth = out.depth;
  const rs = _bin.readUshort;

  if (ctype === 6) {
    // RGB + alpha
    const qarea = area << 2;

    if (depth === 8)
      for (let i = 0; i < qarea; i += 4) {
        bf[i] = data[i]!;
        bf[i + 1] = data[i + 1]!;
        bf[i + 2] = data[i + 2]!;
        bf[i + 3] = data[i + 3]!;
      }

    if (depth === 16) for (let i = 0; i < qarea; i++) bf[i] = data[i << 1]!;
  } else if (ctype === 2) {
    // RGB
    const ts = out.tabs.tRNS as number[] | undefined;

    if (ts == null) {
      if (depth === 8)
        for (let i = 0; i < area; i++) {
          const ti = i * 3;
          bf32[i] = (255 << 24) | (data[ti + 2]! << 16) | (data[ti + 1]! << 8) | data[ti]!;
        }

      if (depth === 16)
        for (let i = 0; i < area; i++) {
          const ti = i * 6;
          bf32[i] = (255 << 24) | (data[ti + 4]! << 16) | (data[ti + 2]! << 8) | data[ti]!;
        }
    } else {
      const tr = ts[0]!;
      const tg = ts[1]!;
      const tb = ts[2]!;

      if (depth === 8)
        for (let i = 0; i < area; i++) {
          const qi = i << 2;
          const ti = i * 3;
          bf32[i] = (255 << 24) | (data[ti + 2]! << 16) | (data[ti + 1]! << 8) | data[ti]!;

          if (data[ti] === tr && data[ti + 1] === tg && data[ti + 2] === tb) bf[qi + 3] = 0;
        }

      if (depth === 16)
        for (let i = 0; i < area; i++) {
          const qi = i << 2;
          const ti = i * 6;
          bf32[i] = (255 << 24) | (data[ti + 4]! << 16) | (data[ti + 2]! << 8) | data[ti]!;

          if (rs(data, ti) === tr && rs(data, ti + 2) === tg && rs(data, ti + 4) === tb)
            bf[qi + 3] = 0;
        }
    }
  } else if (ctype === 3) {
    // palette
    const p = out.tabs.PLTE as number[];
    const ap = out.tabs.tRNS as number[] | undefined;
    const tl = ap ? ap.length : 0;

    if (depth === 1)
      for (let y = 0; y < h; y++) {
        const s0 = y * bpl;
        const t0 = y * w;

        for (let i = 0; i < w; i++) {
          const qi = (t0 + i) << 2;
          const j = (data[s0 + (i >> 3)]! >> (7 - ((i & 7) << 0))) & 1;
          const cj = 3 * j;
          bf[qi] = p[cj]!;
          bf[qi + 1] = p[cj + 1]!;
          bf[qi + 2] = p[cj + 2]!;
          bf[qi + 3] = j < tl ? ap![j]! : 255;
        }
      }

    if (depth === 2)
      for (let y = 0; y < h; y++) {
        const s0 = y * bpl;
        const t0 = y * w;

        for (let i = 0; i < w; i++) {
          const qi = (t0 + i) << 2;
          const j = (data[s0 + (i >> 2)]! >> (6 - ((i & 3) << 1))) & 3;
          const cj = 3 * j;
          bf[qi] = p[cj]!;
          bf[qi + 1] = p[cj + 1]!;
          bf[qi + 2] = p[cj + 2]!;
          bf[qi + 3] = j < tl ? ap![j]! : 255;
        }
      }

    if (depth === 4)
      for (let y = 0; y < h; y++) {
        const s0 = y * bpl;
        const t0 = y * w;

        for (let i = 0; i < w; i++) {
          const qi = (t0 + i) << 2;
          const j = (data[s0 + (i >> 1)]! >> (4 - ((i & 1) << 2))) & 15;
          const cj = 3 * j;
          bf[qi] = p[cj]!;
          bf[qi + 1] = p[cj + 1]!;
          bf[qi + 2] = p[cj + 2]!;
          bf[qi + 3] = j < tl ? ap![j]! : 255;
        }
      }

    if (depth === 8)
      for (let i = 0; i < area; i++) {
        const qi = i << 2;
        const j = data[i]!;
        const cj = 3 * j;
        bf[qi] = p[cj]!;
        bf[qi + 1] = p[cj + 1]!;
        bf[qi + 2] = p[cj + 2]!;
        bf[qi + 3] = j < tl ? ap![j]! : 255;
      }
  } else if (ctype === 4) {
    // gray + alpha
    if (depth === 8)
      for (let i = 0; i < area; i++) {
        const qi = i << 2;
        const di = i << 1;
        const gr = data[di]!;
        bf[qi] = gr;
        bf[qi + 1] = gr;
        bf[qi + 2] = gr;
        bf[qi + 3] = data[di + 1]!;
      }

    if (depth === 16)
      for (let i = 0; i < area; i++) {
        const qi = i << 2;
        const di = i << 2;
        const gr = data[di]!;
        bf[qi] = gr;
        bf[qi + 1] = gr;
        bf[qi + 2] = gr;
        bf[qi + 3] = data[di + 2]!;
      }
  } else if (ctype === 0) {
    // gray
    const tr = out.tabs.tRNS != null ? (out.tabs.tRNS as number) : -1;

    for (let y = 0; y < h; y++) {
      const off = y * bpl;
      const to = y * w;

      if (depth === 1)
        for (let x = 0; x < w; x++) {
          const gr = 255 * ((data[off + (x >>> 3)]! >>> (7 - (x & 7))) & 1);
          const al = gr === tr * 255 ? 0 : 255;
          bf32[to + x] = (al << 24) | (gr << 16) | (gr << 8) | gr;
        }
      else if (depth === 2)
        for (let x = 0; x < w; x++) {
          const gr = 85 * ((data[off + (x >>> 2)]! >>> (6 - ((x & 3) << 1))) & 3);

          const al = gr === tr * 85 ? 0 : 255;
          bf32[to + x] = (al << 24) | (gr << 16) | (gr << 8) | gr;
        }
      else if (depth === 4)
        for (let x = 0; x < w; x++) {
          const gr = 17 * ((data[off + (x >>> 1)]! >>> (4 - ((x & 1) << 2))) & 15);

          const al = gr === tr * 17 ? 0 : 255;
          bf32[to + x] = (al << 24) | (gr << 16) | (gr << 8) | gr;
        }
      else if (depth === 8)
        for (let x = 0; x < w; x++) {
          const gr = data[off + x]!;
          const al = gr === tr ? 0 : 255;
          bf32[to + x] = (al << 24) | (gr << 16) | (gr << 8) | gr;
        }
      else if (depth === 16)
        for (let x = 0; x < w; x++) {
          const gr = data[off + (x << 1)]!;
          const al = rs(data, off + (x << 1)) === tr ? 0 : 255;
          bf32[to + x] = (al << 24) | (gr << 16) | (gr << 8) | gr;
        }
    }
  }

  return bf;
}

/** Valid bit depths per colour type (PNG spec table 11.1). */
const VALID_DEPTHS: Record<number, number[]> = {
  0: [1, 2, 4, 8, 16],
  2: [8, 16],
  3: [1, 2, 4, 8],
  4: [8, 16],
  6: [8, 16],
};

/** Adam7 pass origins and steps. */
const starting_row = [0, 0, 4, 0, 2, 0, 1];
const starting_col = [0, 4, 0, 2, 0, 1, 0];
const row_increment = [8, 8, 8, 4, 4, 2, 2];
const col_increment = [8, 8, 4, 4, 2, 2, 1];

const passExtent = (size: number, start: number, step: number) =>
  size > start ? Math.ceil((size - start) / step) : 0;

/** Exact byte length of the inflated (still filtered) IDAT stream. */
function _filteredSize(out: PNGImage): number {
  const bpp = _getBPP(out);
  const w = out.width;
  const h = out.height;

  if (out.interlace === 0) return h * (1 + Math.ceil((w * bpp) / 8));
  let size = 0;

  for (let pass = 0; pass < 7; pass++) {
    const sw = passExtent(w, starting_col[pass]!, col_increment[pass]!);
    const sh = passExtent(h, starting_row[pass]!, row_increment[pass]!);

    if (sw !== 0 && sh !== 0) size += sh * (1 + Math.ceil((sw * bpp) / 8));
  }

  return size;
}

/**
 * Decode PNG data. `maxDecodedSize` caps every buffer whose size the header
 * dictates (the inflated IDAT stream and the RGBA8 image); exceeding it throws
 * DecodedStreamTooLargeError before anything is inflated or allocated.
 */
export function decode(buff: ArrayBuffer, maxDecodedSize: number = Infinity): PNGImage {
  const data = new Uint8Array(buff);
  let offset = 8;
  const bin = _bin;
  const rUs = bin.readUshort;
  const rUi = bin.readUint;

  const out: PNGImage = {
    width: 0,
    height: 0,
    depth: 0,
    ctype: 0,
    interlace: 0,
    data: new Uint8Array(0),
    tabs: {},
    numFrames: 1,
  };

  let sawIHDR = false;
  const idat: Uint8Array[] = [];

  const mgck = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  for (let i = 0; i < 8; i++)
    if (data[i] !== mgck[i]) throw new Error("The input is not a PNG file!");

  while (offset < data.length) {
    if (offset + 8 > data.length) throw new Error("Truncated PNG chunk");
    const len = bin.readUint(data, offset);
    offset += 4;
    const type = bin.readASCII(data, offset, 4);
    offset += 4;

    if (offset + len > data.length) throw new Error("Truncated PNG chunk");

    if (type === "IHDR") {
      if (len !== 13) throw new Error("Invalid PNG IHDR chunk");
      _IHDR(data, offset, out);
      sawIHDR = true;
    } else if (type === "CgBI") {
      out.tabs.CgBI = true;
    } else if (type === "IDAT") {
      idat.push(data.subarray(offset, offset + len));
    } else if (type === "acTL") {
      if (len !== 8) throw new Error("Invalid PNG acTL chunk");
      out.numFrames = rUi(data, offset);
    } else if (type === "PLTE") {
      if (len % 3 !== 0 || len > 768) throw new Error("Invalid PNG PLTE chunk");
      out.tabs.PLTE = bin.readBytes(data, offset, len);
    } else if (type === "tRNS") {
      if (out.ctype === 3 && len <= 256) out.tabs.tRNS = bin.readBytes(data, offset, len);
      else if (out.ctype === 0 && len === 2) out.tabs.tRNS = rUs(data, offset);
      else if (out.ctype === 2 && len === 6)
        out.tabs.tRNS = [rUs(data, offset), rUs(data, offset + 2), rUs(data, offset + 4)];
    } else if (type === "IEND") {
      break;
    }

    offset += len;
    offset += 4; // CRC
  }

  if (!sawIHDR) throw new Error("PNG has no IHDR chunk");

  // An animated PNG is rejected by the caller; do not inflate anything.
  if (out.numFrames > 1) return out;

  const filtered = _filteredSize(out);
  const rgba = out.width * out.height * 4;
  const largest = Math.max(filtered, rgba);

  if (largest > maxDecodedSize) throw new DecodedStreamTooLargeError(largest, maxDecodedSize);

  let dd: Uint8Array;

  if (idat.length === 1) dd = idat[0]!;
  else {
    let total = 0;

    for (const c of idat) total += c.length;
    dd = new Uint8Array(total);
    let pos = 0;

    for (const c of idat) {
      dd.set(c, pos);
      pos += c.length;
    }
  }

  out.data = _decompress(out, dd, filtered);

  return out;
}

function _decompress(out: PNGImage, dd: Uint8Array, filtered: number): Uint8Array {
  // Inflate into a zero-filled buffer of exactly the filtered size. fflate
  // never grows a caller-supplied buffer: Huffman output past its end is
  // dropped, and a stored block that does not fit throws RangeError, which
  // ends decoding with what was written so far. Short output leaves zeros.
  const result = new Uint8Array(filtered);
  const raw = out.tabs.CgBI ? dd : dd.subarray(2, Math.max(2, dd.length - 4)); // zlib header, adler32

  try {
    inflateSync(raw, { out: result });
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
  }

  if (out.interlace === 0) return _filterZero(result, out, 0, out.width, out.height);

  return _readInterlace(result, out);
}

function _readInterlace(data: Uint8Array, out: PNGImage): Uint8Array {
  const w = out.width;
  const h = out.height;
  const bpp = _getBPP(out);
  const cbpp = bpp >> 3;
  const bpl = Math.ceil((w * bpp) / 8);
  const img = new Uint8Array(h * bpl);
  let di = 0;

  let pass = 0;

  while (pass < 7) {
    const ri = row_increment[pass]!;
    const ci = col_increment[pass]!;
    let sw = 0;
    let sh = 0;
    let cr = starting_row[pass]!;

    while (cr < h) {
      cr += ri;
      sh++;
    }

    let cc = starting_col[pass]!;

    while (cc < w) {
      cc += ci;
      sw++;
    }

    const bpll = Math.ceil((sw * bpp) / 8);
    _filterZero(data, out, di, sw, sh);

    let y = 0;
    let row = starting_row[pass]!;

    while (row < h) {
      let col = starting_col[pass]!;
      let cdi = (di + y * bpll) << 3;

      while (col < w) {
        if (bpp === 1) {
          const val = (data[cdi >> 3]! >> (7 - (cdi & 7))) & 1;
          const idx1 = row * bpl + (col >> 3);
          img[idx1] = (img[idx1] ?? 0) | (val << (7 - ((col & 7) << 0)));
        }

        if (bpp === 2) {
          const val = (data[cdi >> 3]! >> (6 - (cdi & 7))) & 3;
          const idx2 = row * bpl + (col >> 2);
          img[idx2] = (img[idx2] ?? 0) | (val << (6 - ((col & 3) << 1)));
        }

        if (bpp === 4) {
          const val = (data[cdi >> 3]! >> (4 - (cdi & 7))) & 15;
          const idx4 = row * bpl + (col >> 1);
          img[idx4] = (img[idx4] ?? 0) | (val << (4 - ((col & 1) << 2)));
        }

        if (bpp >= 8) {
          const ii = row * bpl + col * cbpp;

          for (let j = 0; j < cbpp; j++) img[ii + j] = data[(cdi >> 3) + j]!;
        }

        cdi += bpp;
        col += ci;
      }

      y++;
      row += ri;
    }

    if (sw * sh !== 0) di += sh * (1 + bpll);
    pass = pass + 1;
  }

  return img;
}

function _getBPP(out: PNGImage): number {
  const noc = [1, null, 3, 1, 2, null, 4][out.ctype]!;

  return noc * out.depth;
}

function _filterZero(
  data: Uint8Array,
  out: PNGImage,
  off: number,
  w: number,
  h: number,
): Uint8Array {
  const bpp = Math.ceil(_getBPP(out) / 8);
  const bpl = Math.ceil((w * _getBPP(out)) / 8);

  let type = data[off]!;
  let x = 0;

  if (type > 1) data[off] = [0, 0, 1][type - 2]!;

  if (type === 3)
    for (x = bpp; x < bpl; x++) data[x + 1] = (data[x + 1]! + (data[x + 1 - bpp]! >>> 1)) & 255;

  for (let y = 0; y < h; y++) {
    const i = off + y * bpl;
    const di = i + y + 1;
    type = data[di - 1]!;
    x = 0;

    if (type === 0) for (; x < bpl; x++) data[i + x] = data[di + x]!;
    else if (type === 1) {
      for (; x < bpp; x++) data[i + x] = data[di + x]!;

      for (; x < bpl; x++) data[i + x] = data[di + x]! + data[i + x - bpp]!;
    } else if (type === 2) {
      for (; x < bpl; x++) data[i + x] = data[di + x]! + data[i + x - bpl]!;
    } else if (type === 3) {
      for (; x < bpp; x++) data[i + x] = data[di + x]! + (data[i + x - bpl]! >>> 1);

      for (; x < bpl; x++)
        data[i + x] = data[di + x]! + ((data[i + x - bpl]! + data[i + x - bpp]!) >>> 1);
    } else {
      for (; x < bpp; x++) data[i + x] = data[di + x]! + _paeth(0, data[i + x - bpl]!, 0);

      for (; x < bpl; x++)
        data[i + x] =
          data[di + x]! + _paeth(data[i + x - bpp]!, data[i + x - bpl]!, data[i + x - bpp - bpl]!);
    }
  }

  return data;
}

function _paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = p - a;
  const pb = p - b;
  const pc = p - c;

  if (pa * pa <= pb * pb && pa * pa <= pc * pc) return a;
  else if (pb * pb <= pc * pc) return b;

  return c;
}

function _IHDR(data: Uint8Array, offset: number, out: PNGImage): void {
  out.width = _bin.readUint(data, offset);
  offset += 4;
  out.height = _bin.readUint(data, offset);
  offset += 4;
  out.depth = data[offset]!;
  offset++;
  out.ctype = data[offset]!;
  offset++;
  const compress = data[offset]!;
  offset++;
  const filter = data[offset]!;
  offset++;
  out.interlace = data[offset]!;

  if (
    out.width === 0 ||
    out.height === 0 ||
    out.width > 0x7fffffff ||
    out.height > 0x7fffffff ||
    !VALID_DEPTHS[out.ctype]?.includes(out.depth) ||
    compress !== 0 ||
    filter !== 0 ||
    out.interlace > 1
  )
    throw new Error("Invalid PNG IHDR chunk");
}

// Default export for compatibility
const UPNG = { decode, toRGBA8 };

export default UPNG;
