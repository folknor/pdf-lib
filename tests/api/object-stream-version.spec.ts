import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFHeader, PDFName, PDFString } from '../../src/index';

const latin1 = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);

const catalogVersionOf = async (bytes: Uint8Array) => {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });

  return doc.catalog.get(PDFName.of('Version'))?.toString();
};

const bytesWithHeader = async (major: number, minor: number) => {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.addPage([100, 100]);
  doc.context.header = PDFHeader.forVersion(major, minor);

  return doc.save({ useObjectStreams: false });
};

describe('object streams and the declared PDF version', () => {
  it('raises a pre-1.5 header to 1.5 on a full save with object streams', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.addPage();
    doc.context.header = PDFHeader.forVersion(1, 3);
    const out = latin1(await doc.save({ useObjectStreams: true }));
    expect(out.startsWith('%PDF-1.5\n')).toBe(true);
    expect(out).toContain('/Type /XRef');
  });

  it('keeps a pre-1.5 header when object streams are not used', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.addPage();
    doc.context.header = PDFHeader.forVersion(1, 4);
    const out = latin1(await doc.save({ useObjectStreams: false }));
    expect(out.startsWith('%PDF-1.4\n')).toBe(true);
  });

  it('never lowers a header above 1.5', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.addPage();
    const out = latin1(await doc.save({ useObjectStreams: true }));
    expect(out.startsWith('%PDF-1.7\n')).toBe(true);
  });

  it('leaves the header alone when the catalog /Version already allows them', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.addPage();
    doc.context.header = PDFHeader.forVersion(1, 3);
    doc.catalog.set(PDFName.of('Version'), PDFName.of('1.7'));
    const out = latin1(await doc.save({ useObjectStreams: true }));
    expect(out.startsWith('%PDF-1.3\n')).toBe(true);
  });

  it('throws on a malformed catalog /Version before changing anything', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.context.header = PDFHeader.forVersion(1, 3);
    doc.catalog.set(PDFName.of('Version'), PDFString.of('1.7'));
    await expect(doc.save({ useObjectStreams: true })).rejects.toThrow(
      /catalog \/Version is malformed/,
    );
    expect(doc.getPageCount()).toBe(0);
    expect(doc.context.header.getVersionString()).toBe('1.3');
  });

  it('raises the catalog /Version in an increment onto a pre-1.5 file', async () => {
    const original = await bytesWithHeader(1, 4);

    const doc = await PDFDocument.load(original, {
      forIncrementalUpdate: true,
      updateMetadata: false,
    });

    doc.addPage();

    const out = await doc.saveIncremental(doc.takeSnapshot(), {
      useObjectStreams: true,
    });

    const full = new Uint8Array(original.length + out.length);
    full.set(original);
    full.set(out, original.length);
    expect(latin1(full).startsWith('%PDF-1.4\n')).toBe(true);
    expect(latin1(out)).toContain('/Type /XRef');
    expect(await catalogVersionOf(full)).toBe('/1.5');
  });

  it('defaults an increment onto a pre-1.5 file to a classic xref', async () => {
    const original = await bytesWithHeader(1, 4);

    const doc = await PDFDocument.load(original, {
      forIncrementalUpdate: true,
      updateMetadata: false,
    });

    doc.addPage();
    const out = await doc.commit();
    expect(latin1(out.subarray(original.length))).not.toContain('/Type /XRef');
    expect(await catalogVersionOf(out)).toBeUndefined();
  });

  it('judges increments by the original header, not one a full save raised', async () => {
    const original = await bytesWithHeader(1, 3);

    const doc = await PDFDocument.load(original, {
      forIncrementalUpdate: true,
      updateMetadata: false,
    });

    const rewritten = latin1(
      await doc.save({ rewrite: true, useObjectStreams: true }),
    );

    expect(rewritten.startsWith('%PDF-1.5\n')).toBe(true);

    // The default for the increment must not follow the raised header.
    doc.catalog.set(PDFName.of('Note'), PDFString.of('first'));
    const plain = await doc.commit();
    expect(latin1(plain.subarray(original.length))).not.toContain(
      '/Type /XRef',
    );

    doc.catalog.set(PDFName.of('Note'), PDFString.of('second'));
    const withStreams = await doc.commit({ useObjectStreams: true });
    expect(latin1(withStreams).startsWith('%PDF-1.3\n')).toBe(true);
    expect(await catalogVersionOf(withStreams)).toBe('/1.5');
  });

  it('raises the catalog /Version through save() on its incremental path', async () => {
    const original = await bytesWithHeader(1, 4);

    const doc = await PDFDocument.load(original, {
      forIncrementalUpdate: true,
      updateMetadata: false,
    });

    doc.takeSnapshot();
    doc.addPage();
    const out = await doc.save({ useObjectStreams: true });
    expect(latin1(out).startsWith('%PDF-1.4\n')).toBe(true);
    expect(await catalogVersionOf(out)).toBe('/1.5');
  });
});
