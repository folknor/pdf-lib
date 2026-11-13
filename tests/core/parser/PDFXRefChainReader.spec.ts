import { zlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import PDFXRefChainReader, {
  XRefChainError,
} from '../../../src/core/parser/PDFXRefChainReader';

/** Builds a file from parts, returning the bytes and each part's offset. */
const build = (parts: (string | Uint8Array)[]) => {
  const offsets: number[] = [];
  const chunks: Buffer[] = [];
  let at = 0;
  for (const part of parts) {
    offsets.push(at);
    const chunk =
      typeof part === 'string' ? Buffer.from(part, 'latin1') : Buffer.from(part);
    chunks.push(chunk);
    at += chunk.length;
  }
  return { bytes: new Uint8Array(Buffer.concat(chunks)), offsets };
};

const entry = (offset: number, gen: number, type: 'n' | 'f') =>
  `${String(offset).padStart(10, '0')} ${String(gen).padStart(5, '0')} ${type} \n`;

/** An xref stream object with /W [1 2 1] and the given rows. */
const xrefStream = (
  num: number,
  index: number[],
  rows: [number, number, number][],
  extra = '',
) => {
  const data: number[] = [];
  for (const [t, f2, f3] of rows) data.push(t, f2 >> 8, f2 & 0xff, f3);
  const body = Buffer.from(data);
  return Buffer.concat([
    Buffer.from(
      `${num} 0 obj\n<< /Type /XRef /Size ${index[0]! + index[1]!} /W [1 2 1] /Index [${index.join(' ')}] /Length ${body.length}${extra} >>\nstream\n`,
      'latin1',
    ),
    body,
    Buffer.from('\nendstream\nendobj\n', 'latin1'),
  ]);
};

describe('PDFXRefChainReader', () => {
  it('takes the newest entry of each number along /Prev, a free one included', () => {
    const older = `xref\n0 4\n${entry(0, 65535, 'f')}${entry(100, 0, 'n')}${entry(200, 0, 'n')}${entry(300, 0, 'n')}trailer\n<< /Size 4 >>\n`;
    const { bytes, offsets } = build(['%PDF-1.4\n', older]);
    const newer = `xref\n0 1\n${entry(0, 65535, 'f')}2 1\n${entry(0, 1, 'f')}trailer\n<< /Size 4 /Prev ${offsets[1]} >>\n`;
    const file = build([bytes, newer]);
    const xref = PDFXRefChainReader.read(file.bytes, file.offsets[1]!);
    expect(xref.size).toBe(4);
    expect(xref.entries.get(1)).toEqual({ kind: 'inUse', offset: 100, generation: 0 });
    expect(xref.entries.get(2)).toEqual({ kind: 'free', generation: 1 });
    expect(xref.entries.get(3)).toEqual({ kind: 'inUse', offset: 300, generation: 0 });
    expect(xref.highestFree).toBe(2);
  });

  it('reads xref streams, type-2 entries included', () => {
    const { bytes } = build([
      '%PDF-1.5\n',
      xrefStream(3, [0, 4], [
        [0, 0, 255],
        [1, 9, 0],
        [2, 3, 0],
        [1, 40, 0],
      ]),
    ]);
    const xref = PDFXRefChainReader.read(bytes, 9);
    expect(xref.entries.get(1)).toEqual({ kind: 'inUse', offset: 9, generation: 0 });
    expect(xref.entries.get(2)).toEqual({ kind: 'compressed' });
  });

  it('reads a hybrid section as table, then /XRefStm, then /Prev', () => {
    const older = `xref\n0 4\n${entry(0, 65535, 'f')}${entry(1, 0, 'n')}${entry(2, 0, 'n')}${entry(3, 0, 'n')}trailer\n<< /Size 4 >>\n`;
    const base = build(['%PDF-1.5\n', older]);
    const stm = xrefStream(9, [1, 3], [
      [1, 11, 0],
      [2, 9, 0],
      [1, 33, 0],
    ]);
    const withStm = build([base.bytes, stm]);
    const table = `xref\n0 3\n${entry(0, 65535, 'f')}${entry(10, 0, 'n')}${entry(0, 0, 'f')}trailer\n<< /Size 10 /XRefStm ${withStm.offsets[1]} /Prev ${base.offsets[1]} >>\n`;
    const file = build([withStm.bytes, table]);
    const xref = PDFXRefChainReader.read(file.bytes, file.offsets[1]!);
    // The table wins over its stream, a free entry included.
    expect(xref.entries.get(1)).toEqual({ kind: 'inUse', offset: 10, generation: 0 });
    expect(xref.entries.get(2)).toEqual({ kind: 'free', generation: 0 });
    // The stream wins over /Prev.
    expect(xref.entries.get(3)).toEqual({ kind: 'inUse', offset: 33, generation: 0 });
  });

  it('refuses an entry at or above its own /Size', () => {
    const table = `xref\n0 3\n${entry(0, 65535, 'f')}${entry(1, 0, 'n')}${entry(2, 0, 'n')}trailer\n<< /Size 2 >>\n`;
    const { bytes } = build(['%PDF-1.4\n', table]);
    expect(() => PDFXRefChainReader.read(bytes, 9)).toThrow(XRefChainError);
  });

  it('refuses an older entry the newest /Size leaves out', () => {
    const older = `xref\n0 4\n${entry(0, 65535, 'f')}${entry(1, 0, 'n')}${entry(2, 0, 'n')}${entry(3, 0, 'n')}trailer\n<< /Size 4 >>\n`;
    const base = build(['%PDF-1.4\n', older]);
    const newer = `xref\n0 1\n${entry(0, 65535, 'f')}trailer\n<< /Size 2 /Prev ${base.offsets[1]} >>\n`;
    const file = build([base.bytes, newer]);
    expect(() => PDFXRefChainReader.read(file.bytes, file.offsets[1]!)).toThrow(
      /newest \/Size/,
    );
  });

  it('refuses damaged sections rather than guess', () => {
    const stream = (s: Buffer) => build(['%PDF-1.5\n', s]).bytes;
    // Truncated: two rows declared, one present.
    expect(() =>
      PDFXRefChainReader.read(stream(xrefStream(3, [1, 2], [[1, 9, 0]])), 9),
    ).toThrow(/truncated/);
    // An unknown entry type.
    expect(() =>
      PDFXRefChainReader.read(stream(xrefStream(3, [0, 2], [[0, 0, 255], [3, 9, 0]])), 9),
    ).toThrow(/entry type 3/);
    // A negative /Index.
    const negative = xrefStream(3, [0, 1], [[0, 0, 255]]);
    expect(() =>
      PDFXRefChainReader.read(
        stream(Buffer.from(negative.toString('latin1').replace('/Index [0 1]', '/Index [-1 1]'), 'latin1')),
        9,
      ),
    ).toThrow(/Index/);
    // A generation above 65535, a fractional /Size, two entries for one number.
    const tableOf = (body: string, size: string) =>
      build(['%PDF-1.4\n', `xref\n${body}trailer\n<< /Size ${size} >>\n`]).bytes;
    expect(() =>
      PDFXRefChainReader.read(tableOf(`0 2\n${entry(0, 65535, 'f')}${entry(9, 100000, 'n')}`, '2'), 9),
    ).toThrow(/generation/);
    expect(() =>
      PDFXRefChainReader.read(tableOf(`0 1\n${entry(0, 65535, 'f')}`, '1.5'), 9),
    ).toThrow(/Size/);
    expect(() =>
      PDFXRefChainReader.read(
        tableOf(`0 2\n${entry(0, 65535, 'f')}${entry(9, 0, 'n')}1 1\n${entry(20, 0, 'n')}`, '2'),
        9,
      ),
    ).toThrow(/two entries/);
  });

  it('reverses a PNG predictor', () => {
    // Rows [0 0 255] and [1 0 9 0] under /W [1 2 1]; the second row with the
    // Up filter, so each byte is stored as its difference from the row above.
    const body = zlibSync(new Uint8Array([0, 0, 0, 0, 255, 2, 1, 0, 9, 1]));
    const { bytes } = build([
      '%PDF-1.5\n',
      Buffer.concat([
        Buffer.from(
          `3 0 obj\n<< /Type /XRef /Size 2 /W [1 2 1] /Filter /FlateDecode /DecodeParms << /Predictor 12 /Columns 4 >> /Length ${body.length} >>\nstream\n`,
          'latin1',
        ),
        body,
        Buffer.from('\nendstream\nendobj\n', 'latin1'),
      ]),
    ]);
    expect(PDFXRefChainReader.read(bytes, 9).entries.get(1)).toEqual({
      kind: 'inUse',
      offset: 9,
      generation: 0,
    });
  });

  it('ignores /DecodeParms on an unfiltered stream', () => {
    const body = Buffer.from([0, 0, 0, 255, 1, 0, 9, 0]);
    const { bytes } = build([
      '%PDF-1.5\n',
      Buffer.concat([
        Buffer.from(
          `3 0 obj\n<< /Type /XRef /Size 2 /W [1 2 1] /DecodeParms << /Predictor 15 /Columns 4 >> /Length ${body.length} >>\nstream\n`,
          'latin1',
        ),
        body,
        Buffer.from('\nendstream\nendobj\n', 'latin1'),
      ]),
    ]);
    expect(PDFXRefChainReader.read(bytes, 9).entries.get(1)).toEqual({
      kind: 'inUse',
      offset: 9,
      generation: 0,
    });
  });

  it('reads a supplemental stream shared by two revisions', () => {
    const stm = xrefStream(9, [1, 1], [[1, 11, 0]]);
    const base = build(['%PDF-1.5\n', stm]);
    const older = `xref\n0 1\n${entry(0, 65535, 'f')}trailer\n<< /Size 10 /XRefStm ${base.offsets[1]} >>\n`;
    const withOlder = build([base.bytes, older]);
    const newer = `xref\n0 1\n${entry(0, 65535, 'f')}trailer\n<< /Size 10 /XRefStm ${base.offsets[1]} /Prev ${withOlder.offsets[1]} >>\n`;
    const file = build([withOlder.bytes, newer]);
    expect(
      PDFXRefChainReader.read(file.bytes, file.offsets[1]!).entries.get(1),
    ).toEqual({ kind: 'inUse', offset: 11, generation: 0 });
  });

  it('decodes offsets wider than 31 bits', () => {
    const body = Buffer.from([0, 0, 0, 0, 0, 255, 255, 1, 0x80, 0, 0, 0, 0, 0]);
    const { bytes } = build([
      '%PDF-1.5\n',
      Buffer.concat([
        Buffer.from(`3 0 obj\n<< /Type /XRef /Size 2 /W [1 4 2] /Length ${body.length} >>\nstream\n`, 'latin1'),
        body,
        Buffer.from('\nendstream\nendobj\n', 'latin1'),
      ]),
    ]);
    expect(PDFXRefChainReader.read(bytes, 9).entries.get(1)).toEqual({
      kind: 'inUse',
      offset: 2147483648,
      generation: 0,
    });
  });

  it('refuses an offset that is not a section, and a loop', () => {
    const { bytes } = build(['%PDF-1.4\n', `xref\n0 1\n${entry(0, 65535, 'f')}trailer\n<< /Size 1 /Prev 9 >>\n`]);
    expect(() => PDFXRefChainReader.read(bytes, 3)).toThrow(XRefChainError);
    expect(() => PDFXRefChainReader.read(bytes, 9)).toThrow(/loops/);
  });
});
