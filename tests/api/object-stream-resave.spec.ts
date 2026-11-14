import fs from 'fs';
import { describe, expect, it } from 'vitest';
import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
} from '../../src/index';

// Source PDFs that use object streams must not have their original /ObjStm
// containers re-serialised on a full save; stale copies inside them would
// overwrite modified objects on the next load.
const source = fs.readFileSync('./assets/pdfs/standard_fonts_demo.pdf');
const Marker = PDFName.of('TestMarker');

const isObjStm = (obj: unknown) =>
  obj instanceof PDFRawStream &&
  obj.dict.lookup(PDFName.of('Type')) === PDFName.of('ObjStm');

const markAllDicts = (doc: PDFDocument, value: number) => {
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict) obj.set(Marker, PDFNumber.of(value));
  }
};

const expectAllDictsMarked = (doc: PDFDocument, value: number) => {
  let count = 0;

  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict)) continue;
    expect(obj.lookup(Marker, PDFNumber).asNumber()).toBe(value);
    count++;
  }

  expect(count).toBeGreaterThan(0);
};

describe('Full save of a PDF with object streams', () => {
  it('uses a fixture that actually contains object streams', async () => {
    const doc = await PDFDocument.load(source);

    const objStms = doc.context
      .enumerateIndirectObjects()
      .filter(([, obj]) => isObjStm(obj));

    expect(objStms.length).toBeGreaterThan(0);
  });

  for (const useObjectStreams of [true, false]) {
    it(`keeps modifications across save/load cycles (useObjectStreams: ${useObjectStreams})`, async () => {
      const doc1 = await PDFDocument.load(source);
      markAllDicts(doc1, 1);

      const doc2 = await PDFDocument.load(
        await doc1.save({ useObjectStreams }),
      );

      expectAllDictsMarked(doc2, 1);

      markAllDicts(doc2, 2);

      const doc3 = await PDFDocument.load(
        await doc2.save({ useObjectStreams }),
      );

      expectAllDictsMarked(doc3, 2);
    });

    it(`does not write the source /ObjStm containers (useObjectStreams: ${useObjectStreams})`, async () => {
      const doc = await PDFDocument.load(source);

      const sourceRefs = doc.context
        .enumerateIndirectObjects()
        .filter(([, obj]) => isObjStm(obj))
        .map(([ref]) => ref);

      const reloaded = await PDFDocument.load(
        await doc.save({ useObjectStreams }),
      );

      for (const ref of sourceRefs) {
        expect(isObjStm(reloaded.context.lookup(ref))).toBe(false);
      }
    });
  }
});
