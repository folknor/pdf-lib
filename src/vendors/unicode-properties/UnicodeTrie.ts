/**
 * Unicode Trie - Fast lookup of Unicode character properties
 * Originally from https://github.com/foliojs/unicode-trie
 * Absorbed and converted to TypeScript for pdf-lib
 */

// Shift size for getting the index-1 table offset.
const SHIFT_1 = 6 + 5;

// Shift size for getting the index-2 table offset.
const SHIFT_2 = 5;

// Difference between the two shift sizes,
// for getting an index-1 offset from an index-2 offset. 6=11-5
const SHIFT_1_2 = SHIFT_1 - SHIFT_2;

// Number of index-1 entries for the BMP. 32=0x20
// This part of the index-1 table is omitted from the serialized form.
const OMITTED_BMP_INDEX_1_LENGTH = 0x10000 >> SHIFT_1;

// Number of entries in an index-2 block. 64=0x40
const INDEX_2_BLOCK_LENGTH = 1 << SHIFT_1_2;

// Mask for getting the lower bits for the in-index-2-block offset.
const INDEX_2_MASK = INDEX_2_BLOCK_LENGTH - 1;

// Shift size for shifting left the index array values.
// Increases possible data size with 16-bit index values at the cost
// of compactability.
// This requires data blocks to be aligned by DATA_GRANULARITY.
const INDEX_SHIFT = 2;

// Number of entries in a data block. 32=0x20
const DATA_BLOCK_LENGTH = 1 << SHIFT_2;

// Mask for getting the lower bits for the in-data-block offset.
const DATA_MASK = DATA_BLOCK_LENGTH - 1;

// The part of the index-2 table for U+D800..U+DBFF stores values for
// lead surrogate code _units_ not code _points_.
// Values for lead surrogate code _points_ are indexed with this portion of the table.
// Length=32=0x20=0x400>>SHIFT_2. (There are 1024=0x400 lead surrogates.)
const LSCP_INDEX_2_OFFSET = 0x10000 >> SHIFT_2;

// The index-1 table, only used for supplementary code points, at offset 2112=0x840.
// Variable length, for code points up to highStart, where the last single-value range starts.
const INDEX_1_OFFSET = 0x840;

// The alignment size of a data block. Also the granularity for compaction.
const DATA_GRANULARITY = 1 << INDEX_SHIFT;

// Check if system is big-endian
const isBigEndian =
  new Uint8Array(new Uint32Array([0x12345678]).buffer)[0] === 0x12;

function swap32LE(array: Uint8Array): void {
  if (isBigEndian) {
    const len = array.length;
    for (let i = 0; i < len; i += 4) {
      const tmp0 = array[i]!;
      const tmp1 = array[i + 1]!;
      array[i] = array[i + 3]!;
      array[i + 1] = array[i + 2]!;
      array[i + 2] = tmp1;
      array[i + 3] = tmp0;
    }
  }
}

export class UnicodeTrie {
  data: Uint32Array;
  highStart: number;
  errorValue: number;

  constructor(input: Uint8Array) {
    // Read binary format header (8 bytes: highStart + errorValue)
    const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
    this.highStart = view.getUint32(0, true);
    this.errorValue = view.getUint32(4, true);

    // Data starts at byte 8, already decompressed (single zlib inflate was done before)
    const data = input.subarray(8);

    // Swap bytes from little-endian on big-endian systems
    swap32LE(data);

    this.data = new Uint32Array(
      data.buffer,
      data.byteOffset,
      data.byteLength / 4,
    );
  }

  get(codePoint: number): number {
    let index: number;

    if (codePoint < 0 || codePoint > 0x10ffff) {
      return this.errorValue;
    }

    if (codePoint < 0xd800 || (codePoint > 0xdbff && codePoint <= 0xffff)) {
      // Ordinary BMP code point, excluding leading surrogates.
      // BMP uses a single level lookup. BMP index starts at offset 0 in the index.
      // data is stored in the index array itself.
      index =
        (this.data[codePoint >> SHIFT_2]! << INDEX_SHIFT) +
        (codePoint & DATA_MASK);
      return this.data[index]!;
    }

    if (codePoint <= 0xffff) {
      // Lead Surrogate Code Point. A Separate index section is stored for
      // lead surrogate code units and code points.
      index =
        (this.data[LSCP_INDEX_2_OFFSET + ((codePoint - 0xd800) >> SHIFT_2)]! <<
          INDEX_SHIFT) +
        (codePoint & DATA_MASK);
      return this.data[index]!;
    }

    if (codePoint < this.highStart) {
      // Supplemental code point, use two-level lookup.
      index =
        this.data[
          INDEX_1_OFFSET - OMITTED_BMP_INDEX_1_LENGTH + (codePoint >> SHIFT_1)
        ]!;
      index = this.data[index + ((codePoint >> SHIFT_2) & INDEX_2_MASK)]!;
      index = (index << INDEX_SHIFT) + (codePoint & DATA_MASK);
      return this.data[index]!;
    }

    return this.data[this.data.length - DATA_GRANULARITY]!;
  }
}
