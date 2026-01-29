import fs from 'fs';
import { describe, it, expect } from 'vitest';
import { PDFDocument } from '../../src/index';

describe('Incremental Save', () => {
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
});
