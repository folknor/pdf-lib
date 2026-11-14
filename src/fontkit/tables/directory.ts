import * as r from '../../vendors/restructure/index.js';
import Tables from './index.js';

interface TableEntryData {
  tag: string;
  checkSum: number;
  offset: any;
  length: number;
}

interface DirectoryData {
  tag: string;
  numTables: number;
  searchRange: number;
  entrySelector: number;
  rangeShift: number;
  tables: TableEntryData[] | Record<string, TableEntryData>;
}

const TableEntry = new r.Struct({
  tag: new r.String(4),
  checkSum: r.uint32,
  offset: new r.Pointer(r.uint32, 'void', { type: 'global' }),
  length: r.uint32,
});

const Directory = new r.Struct({
  tag: new r.String(4),
  numTables: r.uint16,
  searchRange: r.uint16,
  entrySelector: r.uint16,
  rangeShift: r.uint16,
  tables: new r.Array(TableEntry, 'numTables'),
});

Directory.process = function (this: Record<string, unknown>) {
  const self = this as unknown as DirectoryData;
  const tables: Record<string, TableEntryData> = {};

  for (const table of self.tables as TableEntryData[]) {
    tables[table.tag] = table;
  }

  self.tables = tables;
};

/** The tables `encodeSfnt` writes: the TrueType set PDF embedding needs. */
const ENCODABLE_TAGS = new Set([
  'head',
  'hhea',
  'loca',
  'maxp',
  'cvt ',
  'prep',
  'glyf',
  'hmtx',
  'fpgm',
]);

/**
 * Big-endian uint32 sum (mod 2^32) of `length` bytes at 4-aligned `start` in
 * `view`, whose bytes past `length` up to the next multiple of 4 are zero.
 */
const checksum = (view: DataView, start: number, length: number): number => {
  let sum = 0;

  for (let i = 0; i < length; i += 4) {
    sum = (sum + view.getUint32(start + i)) >>> 0;
  }

  return sum;
};

/**
 * Writes a TrueType sfnt (signature 0x00010000) holding `tables`, keyed by
 * tag; absent (undefined) tables are skipped. Records are sorted by tag, each
 * table starts 4-byte aligned with zero padding not counted in its length,
 * every record carries its table checksum, and `head.checkSumAdjustment` is
 * set for the finished file (the `head` record's checksum is taken with that
 * field zero, as the OpenType spec requires).
 *
 * Only the PDF embedding table set is supported; no cmap, name, OS/2 or post
 * is written, so the result is a PDF font program, not a standalone font.
 */
export const encodeSfnt = (tables: Record<string, unknown>): Uint8Array => {
  const tags = Object.keys(tables)
    .filter((tag) => tables[tag] !== undefined)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const encoded = tags.map((tag) => {
    if (!ENCODABLE_TAGS.has(tag)) {
      throw new Error(`encodeSfnt cannot write table "${tag}"`);
    }

    const bytes = (Tables[tag] as r.Base<unknown>).toBuffer(tables[tag]);

    // checkSumAdjustment is computed over the file with this field zero.
    if (tag === 'head') bytes.fill(0, 8, 12);

    return bytes;
  });

  const numTables = tags.length;
  const headerSize = 12 + 16 * numTables;
  const align = (n: number) => (n + 3) & ~3;

  let size = headerSize;

  const offsets = encoded.map((bytes) => {
    const offset = size;
    size = align(size + bytes.length);

    return offset;
  });

  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);

  const entrySelector = numTables > 0 ? Math.floor(Math.log2(numTables)) : 0;
  const searchRange = numTables > 0 ? 2 ** entrySelector * 16 : 0;
  view.setUint32(0, 0x00010000);
  view.setUint16(4, numTables);
  view.setUint16(6, searchRange);
  view.setUint16(8, entrySelector);
  view.setUint16(10, numTables * 16 - searchRange);

  let headOffset = -1;
  tags.forEach((tag, i) => {
    const bytes = encoded[i]!;
    const offset = offsets[i]!;
    out.set(bytes, offset);

    if (tag === 'head') headOffset = offset;

    const record = 12 + 16 * i;

    for (let c = 0; c < 4; c++) out[record + c] = tag.charCodeAt(c);
    view.setUint32(record + 4, checksum(view, offset, bytes.length));
    view.setUint32(record + 8, offset);
    view.setUint32(record + 12, bytes.length);
  });

  if (headOffset >= 0) {
    const adjustment = (0xb1b0afba - checksum(view, 0, size)) >>> 0;
    view.setUint32(headOffset + 8, adjustment);
  }

  return out;
};

export default Directory;
