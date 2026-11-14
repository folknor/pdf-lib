import { describe, expect, it } from 'vitest';
import {
  PDFArray,
  PDFDocument,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFString,
} from '../../../src/index';
import { UnreadableEncryptionError } from '../../../src/core/errors';
import PDFParser from '../../../src/core/parser/PDFParser';

/** Appends parts to a file, remembering where each one starts. */
class FileBuilder {
  private text = '%PDF-1.5\n';

  add(part: string): number {
    const at = this.text.length;
    this.text += part;
    return at;
  }

  get offset(): number {
    return this.text.length;
  }

  bytes(): Uint8Array {
    return new Uint8Array(Buffer.from(this.text, 'latin1'));
  }
}

const entry = (offset: number, gen: number, type: 'n' | 'f') =>
  `${String(offset).padStart(10, '0')} ${String(gen).padStart(5, '0')} ${type} \n`;

/** An xref table section with one subsection per [first, entries] pair. */
const table = (
  subsections: [number, string[]][],
  trailer: string,
): string =>
  `xref\n${subsections
    .map(([first, rows]) => `${first} ${rows.length}\n${rows.join('')}`)
    .join('')}trailer\n<< ${trailer} >>\n`;

/** An unfiltered xref stream with /W [1 4 2]. */
const xrefStream = (
  num: number,
  size: number,
  rows: [number, number, number][],
  extra = '',
): string => {
  let data = '';
  for (const [t, f2, f3] of rows) {
    data += String.fromCharCode(
      t,
      (f2 >>> 24) & 0xff,
      (f2 >>> 16) & 0xff,
      (f2 >>> 8) & 0xff,
      f2 & 0xff,
      (f3 >>> 8) & 0xff,
      f3 & 0xff,
    );
  }
  return `${num} 0 obj\n<< /Type /XRef /Size ${size} /W [1 4 2] /Length ${data.length}${extra} >>\nstream\n${data}\nendstream\nendobj\n`;
};

/** An unfiltered object stream holding `members` ([number, source]). */
const objectStream = (
  num: number,
  members: [number, string][],
  extra = '',
): string => {
  let header = '';
  let body = '';
  for (const [n, source] of members) {
    header += `${n} ${body.length} `;
    body += `${source} `;
  }
  const data = header + body;
  return `${num} 0 obj\n<< /Type /ObjStm /N ${members.length} /First ${header.length} /Length ${data.length}${extra} >>\nstream\n${data}\nendstream\nendobj\n`;
};

const catalog = (num: number) =>
  `${num} 0 obj\n<< /Type /Catalog /Pages ${num + 1} 0 R >>\nendobj\n`;
const pages = (num: number) =>
  `${num} 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n`;

const parse = (bytes: Uint8Array) =>
  PDFParser.forBytesWithOptions(bytes).parseDocument();

const numbersOf = (refs: PDFRef[], num: number) =>
  refs.filter((ref) => ref.objectNumber === num).map(String);

describe('loading through the cross-reference chain', () => {
  /**
   * Revision 1 holds `3 0`; revision 2 frees it (generation 1 next) and
   * revision 3 reuses the number as `3 1`. Both bodies stay in the file.
   */
  const reusedNumber = () => {
    const f = new FileBuilder();
    const o1 = f.add(catalog(1));
    const o2 = f.add(pages(2));
    const o3 = f.add('3 0 obj\n(old)\nendobj\n');
    const x1 = f.add(
      table(
        [[0, [entry(0, 65535, 'f'), entry(o1, 0, 'n'), entry(o2, 0, 'n'), entry(o3, 0, 'n')]]],
        '/Size 4 /Root 1 0 R',
      ),
    );
    f.add(`startxref\n${x1}\n%%EOF\n`);
    const x2 = f.add(
      table(
        [[0, [entry(3, 65535, 'f')]], [3, [entry(0, 1, 'f')]]],
        `/Size 4 /Root 1 0 R /Prev ${x1}`,
      ),
    );
    f.add(`startxref\n${x2}\n%%EOF\n`);
    const n3 = f.add('3 1 obj\n(new)\nendobj\n');
    const x3 = f.add(
      table(
        [[0, [entry(0, 65535, 'f')]], [3, [entry(n3, 1, 'n')]]],
        `/Size 4 /Root 1 0 R /Prev ${x2}`,
      ),
    );
    f.add(`startxref\n${x3}\n%%EOF\n`);
    return f.bytes();
  };

  it('holds only the generation the xref names for a reused number', async () => {
    const context = await parse(reusedNumber());
    const refs = context.enumerateIndirectObjects().map(([ref]) => ref);
    expect(numbersOf(refs, 3)).toEqual(['3 1 R']);
    expect(context.lookup(PDFRef.of(3, 1))).toEqual(PDFString.of('new'));
  });

  it('saves a file whose history reused a number', async () => {
    const bytes = reusedNumber();
    const full = await PDFDocument.load(bytes, { updateMetadata: false });
    await expect(full.save()).resolves.toBeInstanceOf(Uint8Array);

    const doc = await PDFDocument.load(bytes, {
      forIncrementalUpdate: true,
      updateMetadata: false,
    });
    const snapshot = doc.takeSnapshot();
    doc.context.assign(PDFRef.of(3, 1), PDFString.of('changed'));
    const increment = await doc.saveIncremental(snapshot);
    const updated = new Uint8Array(bytes.length + increment.length);
    updated.set(bytes);
    updated.set(increment, bytes.length);
    const context = await parse(updated);
    expect(context.lookup(PDFRef.of(3, 1))).toEqual(PDFString.of('changed'));
  });

  it('loads nothing for a number the xref frees, its body still in the file', async () => {
    const f = new FileBuilder();
    const o1 = f.add(catalog(1));
    const o2 = f.add(pages(2));
    const o3 = f.add('3 0 obj\n(gone)\nendobj\n');
    const x1 = f.add(
      table(
        [[0, [entry(0, 65535, 'f'), entry(o1, 0, 'n'), entry(o2, 0, 'n'), entry(o3, 0, 'n')]]],
        '/Size 4 /Root 1 0 R',
      ),
    );
    const x2 = f.add(
      table(
        [[0, [entry(3, 65535, 'f')]], [3, [entry(0, 1, 'f')]]],
        `/Size 4 /Root 1 0 R /Prev ${x1}`,
      ),
    );
    f.add(`startxref\n${x2}\n%%EOF\n`);
    const context = await parse(f.bytes());
    expect(context.lookup(PDFRef.of(3))).toBeUndefined();
    expect(context.enumerateIndirectObjects()).toHaveLength(2);
  });

  it('takes the body the xref names over a stale object-stream member of the same number', async () => {
    const f = new FileBuilder();
    const o1 = f.add(catalog(1));
    const o2 = f.add(pages(2));
    // Object stream 4, later in the file, still carries an old copy of 3
    // next to a live member 5: file order would pick the stale copy.
    const o3 = f.add('3 0 obj\n(current)\nendobj\n');
    const o4 = f.add(objectStream(4, [[3, '(stale)'], [5, '(member)']]));
    const xs = f.offset;
    f.add(
      xrefStream(6, 7, [
        [0, 0, 65535],
        [1, o1, 0],
        [1, o2, 0],
        [1, o3, 0],
        [1, o4, 0],
        [2, 4, 1],
        [1, xs, 0],
      ], ' /Root 1 0 R'),
    );
    f.add(`startxref\n${xs}\n%%EOF\n`);
    const context = await parse(f.bytes());
    expect(context.lookup(PDFRef.of(3))).toEqual(PDFString.of('current'));
    expect(context.lookup(PDFRef.of(5))).toEqual(PDFString.of('member'));
    expect(context.pdfFileDetails.useObjectStreams).toBe(true);
  });

  it('loads what an object stream needs to be decoded from another object stream', async () => {
    const f = new FileBuilder();
    const o1 = f.add(catalog(1));
    const o2 = f.add(pages(2));
    // Stream 4 holds member 6, an empty /Filter array; stream 5 names it.
    const o4 = f.add(objectStream(4, [[6, '[]']]));
    const o5 = f.add(objectStream(5, [[7, '(seven)']], ' /Filter 6 0 R'));
    const xs = f.offset;
    f.add(
      xrefStream(3, 8, [
        [0, 0, 65535],
        [1, o1, 0],
        [1, o2, 0],
        [1, xs, 0],
        [1, o4, 0],
        [1, o5, 0],
        [2, 4, 0],
        [2, 5, 0],
      ], ' /Root 1 0 R'),
    );
    f.add(`startxref\n${xs}\n%%EOF\n`);
    const context = await parse(f.bytes());
    expect(context.lookup(PDFRef.of(6))).toBeInstanceOf(PDFArray);
    expect(context.lookup(PDFRef.of(7))).toEqual(PDFString.of('seven'));
  });

  it('does not follow parameters decoding ignores into the stream itself', async () => {
    const f = new FileBuilder();
    const o1 = f.add(catalog(1));
    const o2 = f.add(pages(2));
    // No /Filter, so /DecodeParms is ignored, though it names member 6.
    const o4 = f.add(objectStream(4, [[5, '(five)'], [6, '/Identity']], ' /DecodeParms << /Name 6 0 R >>'));
    f.add('7 0 obj\n(freed)\nendobj\n');
    const xs = f.offset;
    f.add(
      xrefStream(3, 8, [
        [0, 0, 65535],
        [1, o1, 0],
        [1, o2, 0],
        [1, xs, 0],
        [1, o4, 0],
        [2, 4, 0],
        [2, 4, 1],
        [0, 0, 1],
      ], ' /Root 1 0 R'),
    );
    f.add(`startxref\n${xs}\n%%EOF\n`);
    const context = await parse(f.bytes());
    expect(context.lookup(PDFRef.of(5))).toEqual(PDFString.of('five'));
    expect(context.lookup(PDFRef.of(7))).toBeUndefined();
  });

  it('reads an indirect /Length before searching for the end of the stream', async () => {
    const f = new FileBuilder();
    const o1 = f.add(catalog(1));
    const o2 = f.add(pages(2));
    // The data holds a false end marker; only the length finds the real end.
    const data = 'a\nendstream\nb';
    const o3 = f.add(`3 0 obj\n<< /Length 4 0 R >>\nstream\n${data}\nendstream\nendobj\n`);
    const o4 = f.add(`4 0 obj\n${data.length}\nendobj\n`);
    const x = f.add(
      table(
        [[0, [entry(0, 65535, 'f'), entry(o1, 0, 'n'), entry(o2, 0, 'n'), entry(o3, 0, 'n'), entry(o4, 0, 'n')]]],
        '/Size 5 /Root 1 0 R',
      ),
    );
    f.add(`startxref\n${x}\n%%EOF\n`);
    const context = await parse(f.bytes());
    const stream = context.lookup(PDFRef.of(3), PDFRawStream);
    expect(Buffer.from(stream.contents).toString('latin1')).toBe(data);
  });

  it('loads nothing for an xref-stream entry of an undefined type', async () => {
    const f = new FileBuilder();
    const o1 = f.add(catalog(1));
    const o2 = f.add(pages(2));
    const o3 = f.add('3 0 obj\n(hidden)\nendobj\n');
    const xs = f.offset;
    f.add(
      xrefStream(4, 5, [
        [0, 0, 65535],
        [1, o1, 0],
        [1, o2, 0],
        [7, o3, 0],
        [1, xs, 0],
      ], ' /Root 1 0 R'),
    );
    f.add(`startxref\n${xs}\n%%EOF\n`);
    const context = await parse(f.bytes());
    expect(context.lookup(PDFRef.of(3))).toBeUndefined();
  });

  it('takes the trailer from the newest section along the chain', async () => {
    const f = new FileBuilder();
    const o1 = f.add(catalog(1));
    const o2 = f.add(pages(2));
    const o3 = f.add('3 0 obj\n<< /Title (first) >>\nendobj\n');
    const x1 = f.add(
      table(
        [[0, [entry(0, 65535, 'f'), entry(o1, 0, 'n'), entry(o2, 0, 'n'), entry(o3, 0, 'n')]]],
        '/Size 4 /Root 1 0 R /Info 3 0 R',
      ),
    );
    const o4 = f.add('4 0 obj\n<< /Title (second) >>\nendobj\n');
    const x2 = f.add(
      table(
        [[0, [entry(0, 65535, 'f')]], [4, [entry(o4, 0, 'n')]]],
        `/Size 5 /Info 4 0 R /Prev ${x1}`,
      ),
    );
    f.add(`startxref\n${x2}\n%%EOF\n`);
    const context = await parse(f.bytes());
    expect(context.trailerInfo.Info).toBe(PDFRef.of(4));
    // /Root comes from the older section, which the newest one omits.
    expect(context.trailerInfo.Root).toBe(PDFRef.of(1));
    expect(context.trailerInfo.Size).toEqual(PDFNumber.of(5));
  });

  describe('reconstruction', () => {
    it('keeps the last body of a number met in the file, whatever its generation', async () => {
      // No usable xref: an offset points nowhere.
      const f = new FileBuilder();
      f.add(catalog(1));
      f.add(pages(2));
      f.add('3 0 obj\n(old)\nendobj\n');
      f.add('3 1 obj\n(new)\nendobj\n');
      f.add('0 2 obj\n(not an object)\nendobj\n');
      f.add('trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n999999\n%%EOF\n');
      const context = await parse(f.bytes());
      const refs = context.enumerateIndirectObjects().map(([ref]) => ref);
      expect(numbersOf(refs, 3)).toEqual(['3 1 R']);
      expect(numbersOf(refs, 0)).toEqual([]);
    });

    it('counts object-stream members met before a member that fails', async () => {
      const f = new FileBuilder();
      f.add(catalog(1));
      f.add(pages(2));
      f.add('3 1 obj\n(old)\nendobj\n');
      // Member 3 parses; the member after it does not.
      f.add(objectStream(4, [[3, '(new)'], [5, ')']]));
      f.add('trailer\n<< /Size 6 /Root 1 0 R >>\n%%EOF\n');
      const context = await parse(f.bytes());
      const refs = context.enumerateIndirectObjects().map(([ref]) => ref);
      expect(numbersOf(refs, 3)).toEqual(['3 0 R']);
      expect(context.lookup(PDFRef.of(3))).toEqual(PDFString.of('new'));
    });

    it('is used, not an error, when startxref is followed by no usable number', async () => {
      for (const tail of [`startxref\n${'9'.repeat(16)}\n%%EOF\n`,'startxref\n12abc\n%%EOF\n']) {
        const f = new FileBuilder();
        f.add(catalog(1));
        f.add(pages(2));
        f.add(`trailer\n<< /Size 3 /Root 1 0 R >>\n${tail}`);
        const context = await parse(f.bytes());
        expect(context.lookup(PDFRef.of(1))).toBeDefined();
      }
    });

  });

  describe('an entry that does not lead to its object', () => {
    it.each(['later', 'compressed', 'missing marker', 'invalid body', 'jibberish', 'string', 'fallback'])(
      'does not recover headers inside data (%s)',
      async (variant) => {
        const f = new FileBuilder();
        const o1 = f.add(catalog(1));
        const o2 = f.add(pages(2));
        f.add('3 0 obj\n(real)\nendobj\n');
        const data = 'endstream\nendobj\n3 0 obj\n(fake)\nendobj\n';
        if (variant === 'string') {
          f.add('garbage (3 0 obj\n(fake)\nendobj)\n');
        } else {
          const prefix = variant === 'invalid body' ? '4 0 obj\nBROKEN ' :
            variant === 'jibberish' ? 'garbage ' : '4 0 obj\n';
          const payload = variant === 'fallback' ? '3 0 obj\n(fake)\nendobj\n' : data;
          const length = variant === 'fallback' ? '99 0 R' : '5 0 R';
          f.add(`${prefix}<< /Length ${length} >>\nstream\n${payload}\n${variant === 'missing marker' ? 'damaged ' : ''}endstream\nendobj\n`);
        }
        const o5 = variant === 'compressed' ? 0 : f.add(`5 0 obj\n${data.length}\nendobj\n`);
        const o6 = variant === 'compressed' ? f.add(objectStream(6, [[5, String(data.length)]])) : 0;
        const x = f.offset;
        f.add(xrefStream(7, 8, [
          [0, 0, 65535], [1, o1, 0], [1, o2, 0],
          [1, o2, 0], [0, 0, 0],
          variant === 'compressed' ? [2, 6, 0] : [1, o5, 0],
          o6 ? [1, o6, 0] : [0, 0, 0], [1, x, 0],
        ], ' /Root 1 0 R'));
        f.add(`startxref\n${x}\n%%EOF\n`);
        const context = await parse(f.bytes());
        expect(context.lookup(PDFRef.of(3))).toEqual(PDFString.of('real'));
        expect(context.lookup(PDFRef.of(4))).toBeUndefined();
      },
    );

    it('loads nothing when no body has the generation it names', async () => {
      const f = new FileBuilder();
      const o1 = f.add(catalog(1));
      const o2 = f.add(pages(2));
      f.add('3 0 obj\n(three)\nendobj\n');
      const x = f.add(
        table(
          // Object 3's entry names generation 2, which no body has.
          [[0, [entry(0, 65535, 'f'), entry(o1, 0, 'n'), entry(o2, 0, 'n'), entry(o2, 2, 'n')]]],
          '/Size 4 /Root 1 0 R',
        ),
      );
      f.add(`startxref\n${x}\n%%EOF\n`);
      const context = await parse(f.bytes());
      expect(context.lookup(PDFRef.of(3))).toBeUndefined();
      expect(context.lookup(PDFRef.of(1))).toBeDefined();
    });

    it('finds that body alone, and the rest keeps the xref selection', async () => {
      const f = new FileBuilder();
      const o1 = f.add(catalog(1));
      const o2 = f.add(pages(2));
      f.add('3 0 obj\n(gone)\nendobj\n');
      f.add('4 0 obj\n(four)\nendobj\n');
      // A later stream whose data holds a header of 4 0, which is no body.
      const data = '4 0 obj\n(inside)\nendobj\n';
      f.add(`5 0 obj\n<< /Length ${data.length} >>\nstream\n${data}\nendstream\nendobj\n`);
      const x = f.add(
        table(
          [[0, [
            entry(0, 65535, 'f'),
            entry(o1, 0, 'n'),
            entry(o2, 0, 'n'),
            entry(0, 1, 'f'),
            // A stale offset: object 2's.
            entry(o2, 0, 'n'),
          ]]],
          '/Size 5 /Root 1 0 R',
        ),
      );
      f.add(`startxref\n${x}\n%%EOF\n`);
      const context = await parse(f.bytes());
      expect(context.lookup(PDFRef.of(4))).toEqual(PDFString.of('four'));
      // Freed and unlisted numbers stay out, unlike in a rebuild.
      expect(context.lookup(PDFRef.of(3))).toBeUndefined();
      expect(context.lookup(PDFRef.of(5))).toBeUndefined();
    });

    it('reads a member by number from its own object stream when the index is wrong', async () => {
      const f = new FileBuilder();
      const o1 = f.add(catalog(1));
      const o2 = f.add(pages(2));
      const o4 = f.add(objectStream(4, [[5, '(five)'], [6, '(six)']]));
      // Another stream's copy of 5, met later in the file.
      const o7 = f.add(objectStream(7, [[5, '(stale)']]));
      const xs = f.offset;
      f.add(
        xrefStream(3, 8, [
          [0, 0, 65535],
          [1, o1, 0],
          [1, o2, 0],
          [1, xs, 0],
          [1, o4, 0],
          [2, 4, 1],
          [2, 4, 1],
          [1, o7, 0],
        ], ' /Root 1 0 R'),
      );
      f.add(`startxref\n${xs}\n%%EOF\n`);
      const context = await parse(f.bytes());
      expect(context.lookup(PDFRef.of(5))).toEqual(PDFString.of('five'));
      expect(context.lookup(PDFRef.of(6))).toEqual(PDFString.of('six'));
    });

    it('loads no member of an object stream whose offset table is bad', async () => {
      const f = new FileBuilder();
      const o1 = f.add(catalog(1));
      const o2 = f.add(pages(2));
      // Descending offsets; the padding after them reads as a valid table.
      const data = `${'5 9 6 0 7 0 8 3 '.padEnd(40, ' ')}42 43`;
      const o4 = f.add(`4 0 obj\n<< /Type /ObjStm /N 2 /First 40 /Length ${data.length} >>\nstream\n${data}\nendstream\nendobj\n`);
      const xs = f.offset;
      f.add(
        xrefStream(3, 9, [
          [0, 0, 65535],
          [1, o1, 0],
          [1, o2, 0],
          [1, xs, 0],
          [1, o4, 0],
          [2, 4, 0],
          [0, 0, 1],
          [2, 4, 0],
          [2, 4, 1],
        ], ' /Root 1 0 R'),
      );
      f.add(`startxref\n${xs}\n%%EOF\n`);
      const context = await parse(f.bytes());
      for (const num of [5, 7, 8]) {
        expect(context.lookup(PDFRef.of(num))).toBeUndefined();
      }
    });

    it('loads nothing for a member whose container is not an object stream', async () => {
      const f = new FileBuilder();
      const o1 = f.add(catalog(1));
      const o2 = f.add(pages(2));
      f.add('5 0 obj\n(replaced)\nendobj\n');
      const o4 = f.add('4 0 obj\n(not a stream)\nendobj\n');
      const o6 = f.add(objectStream(6, [[5, '(elsewhere)']]));
      const xs = f.offset;
      f.add(
        xrefStream(3, 7, [
          [0, 0, 65535],
          [1, o1, 0],
          [1, o2, 0],
          [1, xs, 0],
          [1, o4, 0],
          [2, 4, 0],
          [1, o6, 0],
        ], ' /Root 1 0 R'),
      );
      f.add(`startxref\n${xs}\n%%EOF\n`);
      const context = await parse(f.bytes());
      expect(context.lookup(PDFRef.of(5))).toBeUndefined();
      expect(context.lookup(PDFRef.of(1))).toBeDefined();
    });

    it('refuses a declared encryption dictionary it cannot load', async () => {
      const f = new FileBuilder();
      const o1 = f.add(catalog(1));
      const o2 = f.add(pages(2));
      const x = f.add(
        table(
          [[0, [entry(0, 65535, 'f'), entry(o1, 0, 'n'), entry(o2, 0, 'n'), entry(o2, 0, 'n')]]],
          '/Size 4 /Root 1 0 R /Encrypt 3 0 R',
        ),
      );
      f.add(`startxref\n${x}\n%%EOF\n`);
      await expect(parse(f.bytes())).rejects.toThrow(UnreadableEncryptionError);
    });
  });

  it('leaves a compressed /Length unread without the key, and stays on the xref', async () => {
    const f = new FileBuilder();
    const o1 = f.add(catalog(1));
    const o2 = f.add(pages(2));
    const o3 = f.add('3 0 obj\n<< /Length 6 0 R >>\nstream\nabc\nendstream\nendobj\n');
    // Not a decodable object stream: reading it would fail.
    const o4 = f.add('4 0 obj\n<< /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode /Length 3 >>\nstream\nxyz\nendstream\nendobj\n');
    const o5 = f.add('5 0 obj\n<< /Filter /Standard >>\nendobj\n');
    f.add('7 0 obj\n(freed)\nendobj\n');
    const xs = f.offset;
    f.add(
      xrefStream(8, 9, [
        [0, 0, 65535],
        [1, o1, 0],
        [1, o2, 0],
        [1, o3, 0],
        [1, o4, 0],
        [1, o5, 0],
        [2, 4, 0],
        [0, 0, 1],
        [1, xs, 0],
      ], ' /Root 1 0 R /Encrypt 5 0 R'),
    );
    f.add(`startxref\n${xs}\n%%EOF\n`);
    const context = await parse(f.bytes());
    const stream = context.lookup(PDFRef.of(3), PDFRawStream);
    expect(Buffer.from(stream.contents).toString('latin1')).toBe('abc');
    // A reconstruction would have brought the freed body back.
    expect(context.lookup(PDFRef.of(7))).toBeUndefined();
  });

  it('keeps a compressed Root a keyless parse could not read, rather than recover another', async () => {
    // A parse without the key of an encrypted file leaves object-stream
    // members out; an old catalog still in use elsewhere must not replace
    // the Root it could not read yet.
    const f = new FileBuilder();
    const o2 = f.add(pages(2));
    const o3 = f.add(objectStream(3, [[1, `<< /Type /Catalog /Pages 2 0 R >>`]]));
    const o4 = f.add('4 0 obj\n<< /Filter /Standard >>\nendobj\n');
    const o5 = f.add(catalog(5).replace('6 0 R', '2 0 R'));
    const xs = f.offset;
    f.add(
      xrefStream(6, 7, [
        [0, 0, 65535],
        [2, 3, 0],
        [1, o2, 0],
        [1, o3, 0],
        [1, o4, 0],
        [1, o5, 0],
        [1, xs, 0],
      ], ' /Root 1 0 R /Encrypt 4 0 R'),
    );
    f.add(`startxref\n${xs}\n%%EOF\n`);
    const context = await parse(f.bytes());
    expect(context.trailerInfo.Root).toBe(PDFRef.of(1));
    expect(context.lookup(PDFRef.of(1))).toBeUndefined();
    expect(context.lookup(PDFRef.of(5))).toBeDefined();
  });
});
