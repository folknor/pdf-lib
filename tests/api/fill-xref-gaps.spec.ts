import { describe, expect, it } from 'vitest';
import { PDFDocument } from '../../src/index';

const decode = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

/**
 * Every entry of the xref table that starts at `at` (default: the last), as
 * a map from object number to its line, read from the text and not through
 * the library's parser. Also returns how many subsections it has.
 */
const table = (text: string, at = text.lastIndexOf('\nxref\n') + 1) => {
  const section = text.slice(at + 5, text.indexOf('trailer', at));
  const entries = new Map<number, string>();
  let subsections = 0;
  let num = 0;
  for (const line of section.split('\n').filter((l) => l.length > 0)) {
    const header = /^(\d+) (\d+)$/.exec(line);
    if (header) {
      num = Number(header[1]);
      subsections++;
    } else {
      entries.set(num++, line.trim());
    }
  }
  return { entries, subsections };
};

const lastTrailer = (text: string) => text.slice(text.lastIndexOf('trailer'));

const loadThreePages = async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.addPage();
  doc.addPage();
  const bytes = await doc.save({ useObjectStreams: false });
  return {
    bytes,
    doc: await PDFDocument.load(bytes, { forIncrementalUpdate: true }),
  };
};

describe('fillXrefGaps in an increment', () => {
  it('lists every number it does not write as the file already resolves it', async () => {
    const { bytes, doc } = await loadThreePages();
    doc.getPage(1).drawText('x');
    const text = decode(
      await doc.saveIncremental(doc.takeSnapshot(), {
        useObjectStreams: false,
        fillXrefGaps: true,
      }),
    );
    const base = table(decode(bytes)).entries;
    const filled = table(text);
    expect(filled.subsections).toBe(1);
    const written = new Set<number>();
    for (const m of text.matchAll(/^(\d+) 0 obj$/gm)) written.add(Number(m[1]));
    expect(written.size).toBeGreaterThan(0);
    for (const [num, line] of filled.entries) {
      if (num === 0 || written.has(num)) continue;
      expect(line).toBe(base.get(num));
      expect(line).toMatch(/ n$/);
    }
  });

  it('frees a removed page and keeps an earlier revision\'s free entry and generation', async () => {
    const { doc } = await loadThreePages();
    const first = doc.getPage(0).ref.objectNumber;
    doc.removePage(0);
    await doc.commit({ useObjectStreams: false });
    const third = doc.getPage(1).ref.objectNumber;
    doc.removePage(1);
    const text = decode(
      await doc.commit({ useObjectStreams: false, fillXrefGaps: true }),
    );
    const { entries, subsections } = table(text);
    expect(subsections).toBe(1);
    expect(entries.get(first)).toMatch(/ 00001 f$/);
    expect(entries.get(third)).toMatch(/ 00001 f$/);
    // One ascending chain from object 0 through both.
    const [low, high] = [first, third].sort((a, b) => a - b);
    expect(entries.get(0)).toBe(`${String(low).padStart(10, '0')} 65535 f`);
    expect(entries.get(low!)!.slice(0, 10)).toBe(String(high).padStart(10, '0'));
  });

  it('refuses a gap that is inherited from an object stream', async () => {
    const { doc } = await loadThreePages();
    doc.getPage(0).drawText('a');
    await doc.commit({ useObjectStreams: true });
    doc.getPage(2).drawText('b');
    await expect(
      doc.commit({ useObjectStreams: false, fillXrefGaps: true }),
    ).rejects.toThrow(/object stream/);
  });

  it('refuses a file whose xref chain cannot be read', async () => {
    const { bytes } = await loadThreePages();
    const text = decode(bytes);
    const at = text.lastIndexOf('startxref\n') + 10;
    const offset = Number(/\d+/.exec(text.slice(at))![0]);
    const broken = Buffer.from(
      text.slice(0, at) + String(offset + 1) + text.slice(at + String(offset).length),
      'latin1',
    );
    const doc = await PDFDocument.load(new Uint8Array(broken), {
      forIncrementalUpdate: true,
    });
    doc.getPage(0).drawText('x');
    await expect(
      doc.saveIncremental(doc.takeSnapshot(), {
        useObjectStreams: false,
        fillXrefGaps: true,
      }),
    ).rejects.toThrow(/cross-reference chain/);
  });
});

describe('increment trailers', () => {
  it('keep /Size over an unchanged highest object', async () => {
    const { bytes, doc } = await loadThreePages();
    const size = /\/Size (\d+)/.exec(lastTrailer(decode(bytes)))![1];
    // Only the catalog is written; the highest number is skipped.
    const text = decode(
      await doc.saveIncremental(doc.takeSnapshot(), { useObjectStreams: false }),
    );
    expect(/\/Size (\d+)/.exec(lastTrailer(text))![1]).toBe(size);
  });

  it('commit() takes the next /Prev from the written xref, not from stream text', async () => {
    const { doc } = await loadThreePages();
    const page = doc.getPage(0);
    const stream = doc.context.stream('startxref\n7\n');
    page.node.addContentStream(doc.context.register(stream));
    const text = decode(await doc.commit({ useObjectStreams: false }));
    const expected = Number(/startxref\n(\d+)/.exec(text.slice(text.lastIndexOf('startxref')))![1]);
    expect(doc.context.pdfFileDetails.prevStartXRef).toBe(expected);
  });
});
