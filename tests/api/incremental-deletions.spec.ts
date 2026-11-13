import { describe, expect, it } from 'vitest';
import {
  PDFDocument,
  PDFRef,
  PDFStreamWriter,
  PDFWriter,
} from '../../src/index';

const loadThreePages = async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.addPage();
  doc.addPage();
  const bytes = await doc.save({ useObjectStreams: false });
  return PDFDocument.load(bytes, { forIncrementalUpdate: true });
};

const decode = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

/** Every entry of the last xref table, as [objectNumber, line]. */
const tableEntries = (text: string): [number, string][] => {
  const section = text.slice(
    text.lastIndexOf('\nxref\n') + 6,
    text.lastIndexOf('\ntrailer'),
  );
  const lines = section.split('\n').filter((l) => l.length > 0);
  const entries: [number, string][] = [];
  let num = 0;
  for (const line of lines) {
    const header = /^(\d+) (\d+)$/.exec(line);
    if (header) {
      num = Number(header[1]);
    } else {
      entries.push([num++, line.trim()]);
    }
  }
  return entries;
};

/** Every entry of an unencoded xref stream, as [objectNumber, tuple]. */
const streamEntries = (text: string): [number, number[]][] => {
  const at = text.lastIndexOf('/Type /XRef');
  const dictStart = text.lastIndexOf('<<', at);
  const dict = text.slice(dictStart, text.indexOf('stream', at));
  const w = /\/W \[ (\d+) (\d+) (\d+) \]/.exec(dict)!.slice(1).map(Number);
  const index = /\/Index \[ ([\d ]+) \]/.exec(dict)![1]!.split(' ').map(Number);
  const start = text.indexOf('stream\n', at) + 7;
  const data = Buffer.from(text.slice(start), 'latin1');
  const read = (off: number, n: number) => {
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 256 + data[off + i]!;
    return v;
  };
  const width = w[0]! + w[1]! + w[2]!;
  const out: [number, number[]][] = [];
  let off = 0;
  for (let i = 0; i < index.length; i += 2) {
    for (let k = 0; k < index[i + 1]!; k++) {
      out.push([
        index[i]! + k,
        [read(off, w[0]!), read(off + w[0]!, w[1]!), read(off + w[0]! + w[1]!, w[2]!)],
      ]);
      off += width;
    }
  }
  return out;
};

describe('deletions in an increment', () => {
  it('frees a removed page in the xref table, once, as the head of the chain', async () => {
    const doc = await loadThreePages();
    const pageRef = doc.getPage(1).ref;
    doc.removePage(1);
    const text = decode(await doc.saveIncremental(doc.takeSnapshot(), { useObjectStreams: false }));
    const entries = tableEntries(text);
    const numbers = entries.map(([n]) => n);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(entries.find(([n]) => n === 0)![1]).toBe(
      `${String(pageRef.objectNumber).padStart(10, '0')} 65535 f`,
    );
    expect(entries.find(([n]) => n === pageRef.objectNumber)![1]).toBe(
      '0000000000 00001 f',
    );
  });

  it('writes a number deleted and assigned again in use only', async () => {
    const doc = await loadThreePages();
    const ref = doc.getPage(1).ref;
    const page = doc.context.lookup(ref)!;
    doc.context.delete(ref);
    doc.context.assign(ref, page);
    const text = decode(await doc.saveIncremental(doc.takeSnapshot(), { useObjectStreams: false }));
    const entries = tableEntries(text);
    const numbers = entries.map(([n]) => n);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(entries.find(([n]) => n === ref.objectNumber)![1]).toMatch(/ 00000 n$/);
    expect(entries.find(([n]) => n === 0)![1]).toBe('0000000000 65535 f');
  });

  it('frees nothing for a ref the document does not hold', async () => {
    const doc = await loadThreePages();
    const ref = doc.getPage(1).ref;
    doc.context.delete(PDFRef.of(ref.objectNumber, 1));
    doc.context.delete(PDFRef.of(doc.context.largestObjectNumber + 5));
    const fresh = doc.context.register(doc.context.obj({}));
    doc.context.delete(fresh);
    expect(doc.takeSnapshot().deletedRefs()).toEqual([]);
  });

  it('caps the generation of a freed entry at 65535', async () => {
    const doc = await loadThreePages();
    const ref = doc.getPage(1).ref;
    const page = doc.context.lookup(ref)!;
    const old = PDFRef.of(ref.objectNumber, 65535);
    doc.context.delete(ref);
    doc.context.assign(old, page);
    doc.context.delete(old);
    const text = decode(await doc.saveIncremental(doc.takeSnapshot(), { useObjectStreams: false }));
    expect(tableEntries(text).find(([n]) => n === ref.objectNumber)![1]).toBe(
      '0000000000 65535 f',
    );
  });

  it('frees removed objects in an xref stream, chained in ascending order', async () => {
    const doc = await loadThreePages();
    const first = doc.getPage(0).ref;
    const last = doc.getPage(2).ref;
    doc.removePage(2);
    doc.removePage(0);
    const snapshot = doc.takeSnapshot();
    const writer = PDFStreamWriter.forContextWithSnapshot(doc.context, 50, snapshot, false);
    const entries = streamEntries(decode(await writer.serializeToBuffer()));
    const numbers = entries.map(([n]) => n);
    expect(new Set(numbers).size).toBe(numbers.length);
    const [low, high] = [first, last].sort((a, b) => a.objectNumber - b.objectNumber);
    expect(entries.find(([n]) => n === 0)![1]).toEqual([0, low!.objectNumber, 65535]);
    expect(entries.find(([n]) => n === low!.objectNumber)![1]).toEqual([
      0,
      high!.objectNumber,
      1,
    ]);
    expect(entries.find(([n]) => n === high!.objectNumber)![1]).toEqual([0, 0, 1]);
  });

  it('refuses to write two generations of one number', async () => {
    const doc = await loadThreePages();
    const ref = doc.getPage(1).ref;
    doc.context.assign(PDFRef.of(ref.objectNumber, 1), doc.context.obj({}));
    const writer = PDFWriter.forContextWithSnapshot(doc.context, 50, doc.takeSnapshot());
    await expect(writer.serializeToBuffer()).rejects.toThrow(/more than one generation/);
  });
});
