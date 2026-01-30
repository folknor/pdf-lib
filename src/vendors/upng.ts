/**
 * UPNG.js - PNG decoder
 * Originally from https://github.com/photopea/UPNG.js
 * Absorbed and converted to TypeScript for pdf-lib
 *
 * Only includes decoding functionality (decode + toRGBA8)
 */

import pako from 'pako';

// Types
export interface PNGImage {
  width: number;
  height: number;
  depth: number;
  ctype: number;
  data: Uint8Array;
  tabs: PNGTabs;
  frames: PNGFrame[];
}

interface PNGTabs {
  acTL?: { num_frames: number; num_plays: number };
  PLTE?: number[];
  tRNS?: number | number[];
  iCCP?: Uint8Array;
  CgBI?: Uint8Array;
  pHYs?: [number, number, number];
  cHRM?: number[];
  tEXt?: Record<string, string>;
  zTXt?: Record<string, string>;
  iTXt?: Record<string, string>;
  gAMA?: number;
  sRGB?: number;
  bKGD?: number | number[];
  [key: string]: unknown;
}

interface PNGFrame {
  rect: { x: number; y: number; width: number; height: number };
  delay: number;
  dispose: number;
  blend: number;
  data?: Uint8Array;
}

// Binary utilities
const _bin = {
  nextZero: (data: Uint8Array, p: number): number => {
    while (data[p] !== 0) p++;
    return p;
  },
  readUshort: (buff: Uint8Array, p: number): number =>
    (buff[p]! << 8) | buff[p + 1]!,
  readUint: (buff: Uint8Array, p: number): number =>
    buff[p]! * (256 * 256 * 256) +
    ((buff[p + 1]! << 16) | (buff[p + 2]! << 8) | buff[p + 3]!),
  readASCII: (buff: Uint8Array, p: number, l: number): string => {
    let s = '';
    for (let i = 0; i < l; i++) s += String.fromCharCode(buff[p + i]!);
    return s;
  },
  readBytes: (buff: Uint8Array, p: number, l: number): number[] => {
    const arr: number[] = [];
    for (let i = 0; i < l; i++) arr.push(buff[p + i]!);
    return arr;
  },
  pad: (n: string): string => (n.length < 2 ? `0${n}` : n),
  readUTF8: (buff: Uint8Array, p: number, l: number): string => {
    let s = '';
    for (let i = 0; i < l; i++) s += `%${_bin.pad(buff[p + i]!.toString(16))}`;
    try {
      return decodeURIComponent(s);
    } catch {
      return _bin.readASCII(buff, p, l);
    }
  },
};

/**
 * Convert decoded PNG to RGBA8 format
 */
export function toRGBA8(out: PNGImage): ArrayBuffer[] {
  const w = out.width;
  const h = out.height;

  if (out.tabs.acTL == null)
    return [decodeImage(out.data, w, h, out).buffer as ArrayBuffer];

  const frms: ArrayBuffer[] = [];
  if (out.frames[0]!.data == null) out.frames[0]!.data = out.data;

  const len = w * h * 4;
  const img = new Uint8Array(len);
  const empty = new Uint8Array(len);
  const prev = new Uint8Array(len);

  for (let i = 0; i < out.frames.length; i++) {
    const frm = out.frames[i]!;
    const fx = frm.rect.x;
    const fy = frm.rect.y;
    const fw = frm.rect.width;
    const fh = frm.rect.height;
    const fdata = decodeImage(frm.data!, fw, fh, out);

    if (i !== 0) for (let j = 0; j < len; j++) prev[j] = img[j]!;

    if (frm.blend === 0) _copyTile(fdata, fw, fh, img, w, h, fx, fy, 0);
    else if (frm.blend === 1) _copyTile(fdata, fw, fh, img, w, h, fx, fy, 1);

    frms.push(img.buffer.slice(0) as ArrayBuffer);

    if (frm.dispose === 1) _copyTile(empty, fw, fh, img, w, h, fx, fy, 0);
    else if (frm.dispose === 2) for (let j = 0; j < len; j++) img[j] = prev[j]!;
  }
  return frms;
}

function decodeImage(
  data: Uint8Array,
  w: number,
  h: number,
  out: PNGImage,
): Uint8Array {
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
    const ts = out.tabs['tRNS'] as number[] | undefined;
    if (ts == null) {
      if (depth === 8)
        for (let i = 0; i < area; i++) {
          const ti = i * 3;
          bf32[i] =
            (255 << 24) |
            (data[ti + 2]! << 16) |
            (data[ti + 1]! << 8) |
            data[ti]!;
        }
      if (depth === 16)
        for (let i = 0; i < area; i++) {
          const ti = i * 6;
          bf32[i] =
            (255 << 24) |
            (data[ti + 4]! << 16) |
            (data[ti + 2]! << 8) |
            data[ti]!;
        }
    } else {
      const tr = ts[0]!;
      const tg = ts[1]!;
      const tb = ts[2]!;
      if (depth === 8)
        for (let i = 0; i < area; i++) {
          const qi = i << 2;
          const ti = i * 3;
          bf32[i] =
            (255 << 24) |
            (data[ti + 2]! << 16) |
            (data[ti + 1]! << 8) |
            data[ti]!;
          if (data[ti] === tr && data[ti + 1] === tg && data[ti + 2] === tb)
            bf[qi + 3] = 0;
        }
      if (depth === 16)
        for (let i = 0; i < area; i++) {
          const qi = i << 2;
          const ti = i * 6;
          bf32[i] =
            (255 << 24) |
            (data[ti + 4]! << 16) |
            (data[ti + 2]! << 8) |
            data[ti]!;
          if (
            rs(data, ti) === tr &&
            rs(data, ti + 2) === tg &&
            rs(data, ti + 4) === tb
          )
            bf[qi + 3] = 0;
        }
    }
  } else if (ctype === 3) {
    // palette
    const p = out.tabs['PLTE'] as number[];
    const ap = out.tabs['tRNS'] as number[] | undefined;
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
    const tr = out.tabs['tRNS'] != null ? (out.tabs['tRNS'] as number) : -1;
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
          const gr =
            85 * ((data[off + (x >>> 2)]! >>> (6 - ((x & 3) << 1))) & 3);
          const al = gr === tr * 85 ? 0 : 255;
          bf32[to + x] = (al << 24) | (gr << 16) | (gr << 8) | gr;
        }
      else if (depth === 4)
        for (let x = 0; x < w; x++) {
          const gr =
            17 * ((data[off + (x >>> 1)]! >>> (4 - ((x & 1) << 2))) & 15);
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

/**
 * Decode PNG data
 */
export function decode(buff: ArrayBuffer): PNGImage {
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
    data: new Uint8Array(0),
    tabs: {},
    frames: [],
  };
  const dd = new Uint8Array(data.length);
  let doff = 0;
  let fd: Uint8Array | undefined;
  let foff = 0;

  const mgck = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++)
    if (data[i] !== mgck[i]) throw new Error('The input is not a PNG file!');

  while (offset < data.length) {
    const len = bin.readUint(data, offset);
    offset += 4;
    const type = bin.readASCII(data, offset, 4);
    offset += 4;

    if (type === 'IHDR') {
      _IHDR(data, offset, out);
    } else if (type === 'iCCP') {
      let off = offset;
      while (data[off] !== 0) off++;
      const fil = data.slice(off + 2, offset + len);
      let res: Uint8Array;
      try {
        res = _inflate(fil);
      } catch {
        res = inflateRaw(fil);
      }
      out.tabs[type] = res;
    } else if (type === 'CgBI') {
      out.tabs[type] = data.slice(offset, offset + 4);
    } else if (type === 'IDAT') {
      for (let i = 0; i < len; i++) dd[doff + i] = data[offset + i]!;
      doff += len;
    } else if (type === 'acTL') {
      out.tabs[type] = {
        num_frames: rUi(data, offset),
        num_plays: rUi(data, offset + 4),
      };
      fd = new Uint8Array(data.length);
    } else if (type === 'fcTL') {
      if (foff !== 0) {
        const fr = out.frames[out.frames.length - 1]!;
        fr.data = _decompress(
          out,
          fd!.slice(0, foff),
          fr.rect.width,
          fr.rect.height,
        );
        foff = 0;
      }
      const rct = {
        x: rUi(data, offset + 12),
        y: rUi(data, offset + 16),
        width: rUi(data, offset + 4),
        height: rUi(data, offset + 8),
      };
      let del = rUs(data, offset + 22);
      del = rUs(data, offset + 20) / (del === 0 ? 100 : del);
      const frm: PNGFrame = {
        rect: rct,
        delay: Math.round(del * 1000),
        dispose: data[offset + 24]!,
        blend: data[offset + 25]!,
      };
      out.frames.push(frm);
    } else if (type === 'fdAT') {
      for (let i = 0; i < len - 4; i++) fd![foff + i] = data[offset + i + 4]!;
      foff += len - 4;
    } else if (type === 'pHYs') {
      out.tabs[type] = [
        bin.readUint(data, offset),
        bin.readUint(data, offset + 4),
        data[offset + 8]!,
      ];
    } else if (type === 'cHRM') {
      out.tabs[type] = [];
      for (let i = 0; i < 8; i++)
        (out.tabs[type] as number[]).push(bin.readUint(data, offset + i * 4));
    } else if (type === 'tEXt' || type === 'zTXt') {
      if (out.tabs[type] == null) out.tabs[type] = {};
      const nz = bin.nextZero(data, offset);
      const keyw = bin.readASCII(data, offset, nz - offset);
      let text: string;
      const tl = offset + len - nz - 1;
      if (type === 'tEXt') text = bin.readASCII(data, nz + 1, tl);
      else {
        const bfr = _inflate(data.slice(nz + 2, nz + 2 + tl));
        text = bin.readUTF8(bfr, 0, bfr.length);
      }
      (out.tabs[type] as Record<string, string>)[keyw] = text;
    } else if (type === 'iTXt') {
      if (out.tabs[type] == null) out.tabs[type] = {};
      let nz = 0;
      let off = offset;
      nz = bin.nextZero(data, off);
      const keyw = bin.readASCII(data, off, nz - off);
      off = nz + 1;
      const cflag = data[off]!;
      off += 2;
      nz = bin.nextZero(data, off);
      off = nz + 1;
      nz = bin.nextZero(data, off);
      off = nz + 1;
      let text: string;
      const tl = len - (off - offset);
      if (cflag === 0) text = bin.readUTF8(data, off, tl);
      else {
        const bfr = _inflate(data.slice(off, off + tl));
        text = bin.readUTF8(bfr, 0, bfr.length);
      }
      (out.tabs[type] as Record<string, string>)[keyw] = text;
    } else if (type === 'PLTE') {
      out.tabs[type] = bin.readBytes(data, offset, len);
    } else if (type === 'hIST') {
      const pl = (out.tabs['PLTE'] as number[]).length / 3;
      out.tabs[type] = [];
      for (let i = 0; i < pl; i++)
        (out.tabs[type] as number[]).push(rUs(data, offset + i * 2));
    } else if (type === 'tRNS') {
      if (out.ctype === 3) out.tabs[type] = bin.readBytes(data, offset, len);
      else if (out.ctype === 0) out.tabs[type] = rUs(data, offset);
      else if (out.ctype === 2)
        out.tabs[type] = [
          rUs(data, offset),
          rUs(data, offset + 2),
          rUs(data, offset + 4),
        ];
    } else if (type === 'gAMA') {
      out.tabs[type] = bin.readUint(data, offset) / 100000;
    } else if (type === 'sRGB') {
      out.tabs[type] = data[offset]!;
    } else if (type === 'bKGD') {
      if (out.ctype === 0 || out.ctype === 4)
        out.tabs[type] = [rUs(data, offset)];
      else if (out.ctype === 2 || out.ctype === 6)
        out.tabs[type] = [
          rUs(data, offset),
          rUs(data, offset + 2),
          rUs(data, offset + 4),
        ];
      else if (out.ctype === 3) out.tabs[type] = data[offset]!;
    } else if (type === 'IEND') {
      break;
    }
    offset += len;
    offset += 4; // CRC
  }
  if (foff !== 0) {
    const fr = out.frames[out.frames.length - 1]!;
    fr.data = _decompress(
      out,
      fd!.slice(0, foff),
      fr.rect.width,
      fr.rect.height,
    );
  }
  out.data = _decompress(out, dd, out.width, out.height);

  return out;
}

function _decompress(
  out: PNGImage,
  dd: Uint8Array,
  w: number,
  h: number,
): Uint8Array {
  const bpp = _getBPP(out);
  const bpl = Math.ceil((w * bpp) / 8);
  const buff = new Uint8Array(
    (bpl + 1 + (out as unknown as { interlace: number }).interlace) * h,
  );
  let result: Uint8Array;
  if (out.tabs['CgBI']) result = inflateRaw(dd, buff);
  else result = _inflate(dd, buff);

  const interlace = (out as unknown as { interlace: number }).interlace;
  if (interlace === 0) result = _filterZero(result, out, 0, w, h);
  else if (interlace === 1) result = _readInterlace(result, out);
  return result;
}

function _inflate(data: Uint8Array, buff?: Uint8Array): Uint8Array {
  const out = inflateRaw(
    new Uint8Array(data.buffer, data.byteOffset + 2, data.length - 6),
    buff,
  );
  return out;
}

// Minimal inflateRaw implementation
function inflateRaw(data: Uint8Array, buff?: Uint8Array): Uint8Array {
  return pako.inflateRaw(
    data,
    buff ? { to: undefined } : undefined,
  ) as unknown as Uint8Array;
}

function _readInterlace(data: Uint8Array, out: PNGImage): Uint8Array {
  const w = out.width;
  const h = out.height;
  const bpp = _getBPP(out);
  const cbpp = bpp >> 3;
  const bpl = Math.ceil((w * bpp) / 8);
  const img = new Uint8Array(h * bpl);
  let di = 0;

  const starting_row = [0, 0, 4, 0, 2, 0, 1];
  const starting_col = [0, 4, 0, 2, 0, 1, 0];
  const row_increment = [8, 8, 8, 4, 4, 2, 2];
  const col_increment = [8, 8, 4, 4, 2, 2, 1];

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
    for (x = bpp; x < bpl; x++)
      data[x + 1] = (data[x + 1]! + (data[x + 1 - bpp]! >>> 1)) & 255;

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
      for (; x < bpp; x++)
        data[i + x] = data[di + x]! + (data[i + x - bpl]! >>> 1);
      for (; x < bpl; x++)
        data[i + x] =
          data[di + x]! + ((data[i + x - bpl]! + data[i + x - bpp]!) >>> 1);
    } else {
      for (; x < bpp; x++)
        data[i + x] = data[di + x]! + _paeth(0, data[i + x - bpl]!, 0);
      for (; x < bpl; x++)
        data[i + x] =
          data[di + x]! +
          _paeth(
            data[i + x - bpp]!,
            data[i + x - bpl]!,
            data[i + x - bpp - bpl]!,
          );
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
  // compress, filter, interlace - stored internally
  (out as unknown as { compress: number }).compress = data[offset]!;
  offset++;
  (out as unknown as { filter: number }).filter = data[offset]!;
  offset++;
  (out as unknown as { interlace: number }).interlace = data[offset]!;
}

function _copyTile(
  sb: Uint8Array,
  sw: number,
  sh: number,
  tb: Uint8Array,
  tw: number,
  th: number,
  xoff: number,
  yoff: number,
  mode: number,
): boolean {
  const w = Math.min(sw, tw);
  const h = Math.min(sh, th);
  let si = 0;
  let ti = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (xoff >= 0 && yoff >= 0) {
        si = (y * sw + x) << 2;
        ti = ((yoff + y) * tw + xoff + x) << 2;
      } else {
        si = ((-yoff + y) * sw - xoff + x) << 2;
        ti = (y * tw + x) << 2;
      }

      if (mode === 0) {
        tb[ti] = sb[si]!;
        tb[ti + 1] = sb[si + 1]!;
        tb[ti + 2] = sb[si + 2]!;
        tb[ti + 3] = sb[si + 3]!;
      } else if (mode === 1) {
        const fa = sb[si + 3]! * (1 / 255);
        const fr = sb[si]! * fa;
        const fg = sb[si + 1]! * fa;
        const fb = sb[si + 2]! * fa;
        const ba = tb[ti + 3]! * (1 / 255);
        const br = tb[ti]! * ba;
        const bg = tb[ti + 1]! * ba;
        const bb = tb[ti + 2]! * ba;

        const ifa = 1 - fa;
        const oa = fa + ba * ifa;
        const ioa = oa === 0 ? 0 : 1 / oa;
        tb[ti + 3] = 255 * oa;
        tb[ti + 0] = (fr + br * ifa) * ioa;
        tb[ti + 1] = (fg + bg * ifa) * ioa;
        tb[ti + 2] = (fb + bb * ifa) * ioa;
      }
    }
  return true;
}

// Default export for compatibility
const UPNG = { decode, toRGBA8 };
export default UPNG;
