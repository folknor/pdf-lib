import fs from 'fs';
import { PDFDocument } from '../src/index';

/**
 * These test files from cantoo issues #63/#64 are both TRUNCATED PDFs:
 * - QWHyicZLjE_InvoicePaper_1715478056267.pdf - truncated in xref section (loads ok)
 * - y0j2NRDLuw_InvoicePaper_1715784300908.pdf - truncated mid-object (fails correctly)
 *
 * Parser correctly rejects severely truncated PDFs. This is expected behavior.
 */
describe('Issue PDF files (truncated)', () => {
  it('loads QWHyicZLjE (truncated in xref, recoverable)', async () => {
    const filename = 'QWHyicZLjE_InvoicePaper_1715478056267.pdf';
    if (!fs.existsSync(filename)) {
      console.log('Skipping - file not found:', filename);
      return;
    }
    const bytes = fs.readFileSync(filename);
    // Truncated in xref section but still loadable
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(0);
  });

  it('rejects y0j2NRDLuw (truncated mid-object) with clear error', async () => {
    const filename = 'y0j2NRDLuw_InvoicePaper_1715784300908.pdf';
    if (!fs.existsSync(filename)) {
      console.log('Skipping - file not found:', filename);
      return;
    }
    const bytes = fs.readFileSync(filename);
    // Truncated mid-object - correctly rejected with helpful message
    await expect(PDFDocument.load(bytes)).rejects.toThrow(
      'file may be truncated',
    );
  });
});
