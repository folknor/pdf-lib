import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName, PDFString } from '../../src/index';

const latin1 = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);

const onePage = async () => {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.addPage([100, 100]);
  return doc.save({ useObjectStreams: false });
};

const startxrefTarget = (bytes: Uint8Array) => {
  const text = latin1(bytes);
  const at = Number(text.match(/startxref\s+(\d+)/)![1]);
  return text.slice(at, at + 20);
};

describe('saving with object streams leaves the document as it was', () => {
  it('lets a page be added after a full save of an incremental load', async () => {
    const doc = await PDFDocument.load(await onePage(), {
      forIncrementalUpdate: true,
      updateMetadata: false,
    });
    await doc.save({ rewrite: true, useObjectStreams: true });
    doc.addPage();
    expect(doc.getPageCount()).toBe(2);
  });

  it('neither adds, removes nor renumbers objects', async () => {
    for (const updateMetadata of [false, true]) {
      const doc = await PDFDocument.create({ updateMetadata });
      doc.addPage([100, 100]);
      const largest = doc.context.largestObjectNumber;
      const refs = doc.context
        .enumerateIndirectObjects()
        .map(([ref]) => ref.toString());
      await doc.save({ useObjectStreams: true });
      expect(
        doc.context.enumerateIndirectObjects().map(([ref]) => ref.toString()),
      ).toEqual(refs);
      expect(doc.context.largestObjectNumber).toBe(largest);
      const again = await PDFDocument.load(
        await doc.save({ useObjectStreams: true }),
      );
      expect(again.getPageCount()).toBe(1);
    }
  });

  it('never reuses a committed object stream number in a later commit', async () => {
    const original = await onePage();
    const doc = await PDFDocument.load(original, {
      forIncrementalUpdate: true,
      updateMetadata: false,
    });
    const keep = doc.context.register(
      doc.context.obj({ Marker: PDFString.of('kept') }),
    );
    doc.catalog.set(PDFName.of('Keep'), keep);
    const first = await doc.commit({ useObjectStreams: true });
    const firstIncrement = latin1(first.subarray(original.length));
    const containers = [...firstIncrement.matchAll(/(\d+) 0 obj\s*<<(?:(?!endobj)[\s\S])*?\/Type \/(?:ObjStm|XRef)/g)].map(
      (m) => m[1],
    );
    expect(containers.length).toBe(2);

    doc.addPage([50, 50]);
    doc.addPage([50, 50]);
    const out = await doc.commit({ useObjectStreams: true });
    const second = latin1(out.subarray(first.length));
    for (const n of containers) {
      expect(second).not.toMatch(new RegExp(`(^|\\n)${n} 0 obj`));
    }
  });
});

describe('full saves with object streams', () => {
  it('write the xref stream where startxref points when the source had one', async () => {
    const src = await PDFDocument.create();
    src.addPage([100, 100]);
    const doc = await PDFDocument.load(
      await src.save({ useObjectStreams: true }),
    );
    const out = await doc.save({ useObjectStreams: true });
    expect(startxrefTarget(out)).toMatch(/^\d+ 0 obj/);
    expect(latin1(out).match(/\/Type \/XRef/g)?.length).toBe(1);
  });

  it('are the default for a loaded document the version allows', async () => {
    const doc = await PDFDocument.load(await onePage());
    expect(latin1(await doc.save())).toContain('/Type /XRef');
  });

  it('keep an untyped signature dict with /ByteRange out of object streams', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.addPage([100, 100]);
    const sig = doc.context.register(
      doc.context.obj({ ByteRange: [0, 0, 0, 0], Contents: PDFString.of('') }),
    );
    doc.catalog.set(PDFName.of('Sig'), sig);
    const out = latin1(await doc.save({ useObjectStreams: true }));
    expect(out).toMatch(
      new RegExp(`${sig.objectNumber} 0 obj\\s*<<[^]*?/ByteRange`),
    );
  });
});
