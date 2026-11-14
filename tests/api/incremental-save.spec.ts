import fs from 'fs';
import { describe, it, expect } from 'vitest';
import { PDFDocument } from '../../src/index';

describe('Incremental Save', () => {
  it('rejects a snapshot from a created document before preparing or writing', async () => {
    const doc = await PDFDocument.create();
    const snapshot = doc.takeSnapshot();
    const objects = doc.context.enumerateIndirectObjects();
    await expect(doc.saveIncremental(snapshot)).rejects.toThrow(
      /requires the document to be loaded with forIncrementalUpdate: true/,
    );
    expect(doc.context.enumerateIndirectObjects()).toEqual(objects);
    expect(doc.context.snapshot).toBeUndefined();
  });

  it('rejects a snapshot when loaded without forIncrementalUpdate', async () => {
    const doc = await PDFDocument.load(fs.readFileSync('./assets/pdfs/normal.pdf'));
    const snapshot = doc.takeSnapshot();
    const objects = doc.context.enumerateIndirectObjects();
    await expect(doc.saveIncremental(snapshot)).rejects.toThrow(
      /requires the document to be loaded with forIncrementalUpdate: true/,
    );
    expect(doc.context.enumerateIndirectObjects()).toEqual(objects);
    expect(doc.context.snapshot).toBeUndefined();
  });

  it('rejects a snapshot from another document before preparing or writing', async () => {
    const bytes = fs.readFileSync('./assets/pdfs/normal.pdf');
    const doc = await PDFDocument.load(bytes, { forIncrementalUpdate: true });
    const other = await PDFDocument.load(bytes, { forIncrementalUpdate: true });
    const snapshot = doc.takeSnapshot();
    const objects = doc.context.enumerateIndirectObjects();
    await expect(doc.saveIncremental(other.takeSnapshot())).rejects.toThrow(
      /requires the installed snapshot for this document/,
    );
    expect(doc.context.enumerateIndirectObjects()).toEqual(objects);
    expect(doc.context.snapshot).toBe(snapshot);
    expect(doc.takeSnapshot()).toBe(snapshot);
  });

  it('can take a snapshot and save incrementally', async () => {
    const pdfBytes = fs.readFileSync('./assets/pdfs/normal.pdf');
    
    // Load for incremental update
    const pdfDoc = await PDFDocument.load(pdfBytes, { forIncrementalUpdate: true });
    
    // Take a snapshot
    const snapshot = pdfDoc.takeSnapshot();
    expect(snapshot.pdfSize).toBe(pdfBytes.length);
    
    // Make a change
    const page = pdfDoc.getPages()[0];
    page.drawText('TEST', { x: 50, y: 50, size: 12 });
    
    // Save incrementally using commit()
    const incrementalBytes = await pdfDoc.commit();
    
    // Incremental bytes should start with the original PDF
    // (first bytes should match original)
    expect(incrementalBytes.length).toBeGreaterThan(pdfBytes.length);
    
    // Verify the incremental PDF loads correctly
    const verifyDoc = await PDFDocument.load(incrementalBytes);
    expect(verifyDoc.getPageCount()).toBe(pdfDoc.getPageCount());
  });

  it('saveIncremental returns only the delta bytes', async () => {
    const pdfBytes = fs.readFileSync('./assets/pdfs/normal.pdf');

    // Load for incremental update
    const pdfDoc = await PDFDocument.load(pdfBytes, { forIncrementalUpdate: true });
    const snapshot = pdfDoc.takeSnapshot();

    // Make a change
    const page = pdfDoc.getPages()[0];
    page.drawText('HELLO', { x: 100, y: 100, size: 20 });

    // saveIncremental returns ONLY the delta bytes (not the full PDF)
    const deltaBytes = await pdfDoc.saveIncremental(snapshot);

    // Delta should be smaller than original (it's just the new objects)
    expect(deltaBytes.length).toBeLessThan(pdfBytes.length);
    expect(deltaBytes.length).toBeGreaterThan(0);

    // Manually combine original + delta to create full PDF
    const fullBytes = new Uint8Array(pdfBytes.length + deltaBytes.length);
    fullBytes.set(pdfBytes);
    fullBytes.set(deltaBytes, pdfBytes.length);

    // Verify combined PDF loads correctly
    const verifyDoc = await PDFDocument.load(fullBytes);
    expect(verifyDoc.getPageCount()).toBeGreaterThan(0);
  });

  it('preserves original bytes at the start of incremental save', async () => {
    const pdfBytes = fs.readFileSync('./assets/pdfs/normal.pdf');
    const pdfDoc = await PDFDocument.load(pdfBytes, { forIncrementalUpdate: true });

    pdfDoc.takeSnapshot();
    const page = pdfDoc.getPages()[0];
    page.drawText('X', { x: 0, y: 0, size: 10 });

    const incrementalBytes = await pdfDoc.commit();

    // First N bytes should match original (commit() prepends original bytes)
    // Convert both to Uint8Array for consistent comparison
    const originalStart = new Uint8Array(pdfBytes.slice(0, 100));
    const incrementalStart = incrementalBytes.slice(0, 100);
    expect(Array.from(incrementalStart)).toEqual(Array.from(originalStart));
  });

  it('keeps largestObjectNumber and trailer entries across linearized sections', async () => {
    const pdfBytes = fs.readFileSync(
      './assets/pdfs/linearized_with_object_streams.pdf',
    );
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      forIncrementalUpdate: true,
      updateMetadata: false,
    });

    // The main xref stream (last in the file) has a smaller /Size than the
    // first-page section, which is the newest along the chain: /Size and
    // largestObjectNumber come from the newest, not from file order.
    expect(pdfDoc.context.trailerInfo.Size!.asNumber()).toBe(85335);
    expect(pdfDoc.context.largestObjectNumber).toBe(85334);

    // The final XRef stream omits Root/Info/ID; they must be kept from
    // earlier sections.
    expect(pdfDoc.context.trailerInfo.Root).toBeTruthy();
    expect(pdfDoc.context.trailerInfo.Info).toBeTruthy();
    expect(pdfDoc.context.trailerInfo.ID).toBeTruthy();
  }, 30000);
});
