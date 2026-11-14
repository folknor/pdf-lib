import { describe, expect, it } from 'vitest';
import { PDFArray, PDFDocument, PDFHexString, PDFString } from '../../src/index';

const ids = (doc: PDFDocument) => {
  const id = doc.context.lookup(doc.context.trailerInfo.ID, PDFArray);
  return [0, 1].map((idx) =>
    Array.from(id.lookup(idx, PDFString, PDFHexString).asBytes()),
  );
};
const readIDs = async (bytes: Uint8Array, password?: string) =>
  ids(await PDFDocument.load(bytes, { updateMetadata: false, password }));

for (const useObjectStreams of [false, true]) {
  describe(`revision IDs (object streams ${useObjectStreams})`, () => {
    it('keeps a first ID across full saves without changing the document', async () => {
      const doc = await PDFDocument.create({ updateMetadata: false });
      doc.addPage();
      const first = await readIDs(await doc.save({ useObjectStreams }));
      const second = await readIDs(await doc.save({ useObjectStreams }));
      expect(second[0]).toEqual(first[0]);
      expect(second[1]).not.toEqual(first[1]);
      expect(doc.context.trailerInfo.ID).toBeUndefined();
    });

    it('keeps the loaded first string and changes the second on saves and increments', async () => {
      const source = await PDFDocument.create({ updateMetadata: false });
      source.addPage();
      source.context.trailerInfo.ID = source.context.obj([
        PDFString.of('original first'), PDFString.of('original second'),
      ]);
      const original = await source.save({ useObjectStreams });
      const doc = await PDFDocument.load(original, {
        forIncrementalUpdate: true, updateMetadata: false,
      });
      const before = ids(doc);
      const trailerID = doc.context.trailerInfo.ID;
      const full = await readIDs(await doc.save({ rewrite: true, useObjectStreams }));
      expect(full[0]).toEqual(before[0]);
      expect(full[1]).not.toEqual(before[1]);
      const increment = await doc.saveIncremental(doc.takeSnapshot(), { useObjectStreams });
      const combined = new Uint8Array(original.length + increment.length);
      combined.set(original);
      combined.set(increment, original.length);
      const after = await readIDs(combined);
      expect(after[0]).toEqual(before[0]);
      expect(after[1]).not.toEqual(before[1]);
      expect(doc.context.trailerInfo.ID).toBe(trailerID);
    });

    it('carries each committed ID into the next revision', async () => {
      const source = await PDFDocument.create({ updateMetadata: false });
      source.addPage();
      const doc = await PDFDocument.load(await source.save(), {
        forIncrementalUpdate: true, updateMetadata: false,
      });
      const original = ids(doc);
      const first = await readIDs(await doc.commit({ useObjectStreams }));
      expect(ids(doc)).toEqual(first);
      const second = await readIDs(await doc.commit({ useObjectStreams }));
      expect(ids(doc)).toEqual(second);
      expect(first[0]).toEqual(original[0]);
      expect(second[0]).toEqual(first[0]);
      expect(first[1]).not.toEqual(original[1]);
      expect(second[1]).not.toEqual(first[1]);
    });

    it('keeps the encrypted file ID even when the document trailer ID changes', async () => {
      const source = await PDFDocument.create({ updateMetadata: false });
      source.addPage();
      source.encrypt({ userPassword: 'user', algorithm: 'RC4-128' });
      const original = await source.save({ useObjectStreams });
      const doc = await PDFDocument.load(original, {
        password: 'user', forIncrementalUpdate: true, updateMetadata: false,
      });
      const before = await readIDs(original, 'user');
      doc.context.trailerInfo.ID = doc.context.obj([
        PDFString.of('changed'), PDFString.of('changed'),
      ]);
      const trailerID = doc.context.trailerInfo.ID;
      await doc.saveIncremental(doc.takeSnapshot(), { useObjectStreams });
      expect(doc.context.trailerInfo.ID).toBe(trailerID);
      const committed = await doc.commit({ useObjectStreams });
      expect(await readIDs(committed, 'user')).toEqual(before);
      expect(ids(doc)).toEqual(before);
    });
  });
}
