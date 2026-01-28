import { PDFDocument, PDFEmbeddedPage } from '../../src/index';

// Helper: creates a source document with content on its pages so embedding works.
// Pages must have a Contents stream or PDFPageEmbedder throws.
async function createSourceDoc(
  pageSizes: [number, number][],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const [w, h] of pageSizes) {
    const page = doc.addPage([w, h]);
    // Draw something to create a Contents stream
    page.drawRectangle({ x: 0, y: 0, width: 1, height: 1 });
  }
  return doc.save();
}

describe('PDFEmbeddedPage', () => {
  let embeddedPage: PDFEmbeddedPage;
  let dstDoc: PDFDocument;

  beforeAll(async () => {
    const srcBytes = await createSourceDoc([[500, 300]]);
    dstDoc = await PDFDocument.create();
    const srcDoc = await PDFDocument.load(srcBytes);
    const [page] = await dstDoc.embedPdf(srcDoc);
    embeddedPage = page;
  });

  it('is an instance of PDFEmbeddedPage', () => {
    expect(embeddedPage).toBeInstanceOf(PDFEmbeddedPage);
  });

  it('has the correct width and height from the source page', () => {
    expect(embeddedPage.width).toBe(500);
    expect(embeddedPage.height).toBe(300);
  });

  describe('size() method', () => {
    it('returns the width and height of the embedded page', () => {
      const size = embeddedPage.size();
      expect(size).toEqual({ width: 500, height: 300 });
    });
  });

  describe('scale() method', () => {
    it('returns the width and height scaled by the given factor', () => {
      const scaled = embeddedPage.scale(0.5);
      expect(scaled).toEqual({ width: 250, height: 150 });
    });

    it('scales up when factor is greater than 1', () => {
      const scaled = embeddedPage.scale(2);
      expect(scaled).toEqual({ width: 1000, height: 600 });
    });

    it('returns zero dimensions when factor is 0', () => {
      const scaled = embeddedPage.scale(0);
      expect(scaled).toEqual({ width: 0, height: 0 });
    });

    it('returns the original dimensions when factor is 1', () => {
      const scaled = embeddedPage.scale(1);
      expect(scaled).toEqual({ width: 500, height: 300 });
    });

    it('handles fractional scale factors', () => {
      const scaled = embeddedPage.scale(0.1);
      expect(scaled).toEqual({ width: 50, height: 30 });
    });

    it('throws an error when factor is not a number', () => {
      expect(() => embeddedPage.scale('2' as any)).toThrow();
    });
  });

  describe('embed() method', () => {
    it('embeds the page without throwing an error', async () => {
      await expect(embeddedPage.embed()).resolves.not.toThrow();
    });

    it('can be called multiple times without error', async () => {
      await embeddedPage.embed();
      await expect(embeddedPage.embed()).resolves.not.toThrow();
    });
  });

  describe('static of() method', () => {
    it('creates an embedded page via embedPdf that has a ref and doc', async () => {
      const srcBytes = await createSourceDoc([[200, 400]]);
      const src = await PDFDocument.load(srcBytes);

      const dst = await PDFDocument.create();
      const [page] = await dst.embedPdf(src);

      expect(page).toBeInstanceOf(PDFEmbeddedPage);
      expect(page.ref).toBeDefined();
      expect(page.doc).toBe(dst);
      expect(page.width).toBe(200);
      expect(page.height).toBe(400);
    });
  });

  describe('embedding multiple pages', () => {
    it('embeds specified pages from a multi-page source document', async () => {
      const srcBytes = await createSourceDoc([
        [100, 200],
        [300, 400],
        [500, 600],
      ]);
      const src = await PDFDocument.load(srcBytes);

      const dst = await PDFDocument.create();
      const pages = await dst.embedPdf(src, [0, 1, 2]);

      expect(pages).toHaveLength(3);
      expect(pages[0].width).toBe(100);
      expect(pages[0].height).toBe(200);
      expect(pages[1].width).toBe(300);
      expect(pages[1].height).toBe(400);
      expect(pages[2].width).toBe(500);
      expect(pages[2].height).toBe(600);
    });
  });

  describe('saving a document with embedded pages', () => {
    it('can save a document after embedding and drawing a page', async () => {
      const srcBytes = await createSourceDoc([[500, 300]]);
      const src = await PDFDocument.load(srcBytes);

      const dst = await PDFDocument.create();
      const [page] = await dst.embedPdf(src);
      const dstPage = dst.addPage();
      dstPage.drawPage(page);

      const pdfBytes = await dst.save();
      expect(pdfBytes.byteLength).toBeGreaterThan(0);
    });
  });
});
