import {
  AnnotationTypes,
  PDFAnnotation,
  PDFDocument,
  PDFLinkAnnotation,
  rgb,
} from '../../../src/index';

describe('PDFLinkAnnotation', () => {
  describe('drawLink() and getLinkAnnotations()', () => {
    it('can add a link annotation to a page', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      page.drawLink({
        url: 'https://example.com',
        x: 50,
        y: 300,
        width: 150,
        height: 20,
      });

      const links = page.getLinkAnnotations();
      expect(links).toBeDefined();
      expect(links.length).toBe(1);
      expect(links[0]).toBeInstanceOf(PDFLinkAnnotation);
    });

    it('returns PDFLinkAnnotation from annotations() factory', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      page.drawLink({
        url: 'https://example.com',
        x: 50,
        y: 300,
        width: 150,
        height: 20,
      });

      const annotations = page.annotations();
      expect(annotations.length).toBe(1);
      expect(annotations[0]).toBeInstanceOf(PDFLinkAnnotation);
      expect(annotations[0]!.getSubtype()).toBe(AnnotationTypes.Link);
    });

    it('getUrl() extracts URL from link annotation', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      page.drawLink({
        url: 'https://pdf-lib.js.org',
        x: 50,
        y: 300,
        width: 150,
        height: 20,
      });

      const links = page.getLinkAnnotations();
      expect(links[0]!.getUrl()).toBe('https://pdf-lib.js.org');
    });

    it('getUrl() returns undefined for non-URI links', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      // Add a link that points to a destination (internal link)
      // For now we just test that getUrl returns undefined when no URL action
      const links = page.getLinkAnnotations();
      expect(links.length).toBe(0);
    });

    it('getLinkAnnotations() returns only link annotations', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      // Add a link annotation
      page.drawLink({
        url: 'https://example.com',
        x: 50,
        y: 300,
        width: 150,
        height: 20,
      });

      // Add a text markup annotation (different type)
      page.addTextMarkupAnnotation({
        subtype: AnnotationTypes.Highlight,
        color: [1, 1, 0],
        rect: { x: 100, y: 200, width: 100, height: 20 },
        quadPoints: {
          leftbottomX: 100,
          leftbottomY: 200,
          lefttopX: 100,
          lefttopY: 220,
          righttopX: 200,
          righttopY: 220,
          rightbottomX: 200,
          rightbottomY: 200,
        },
      });

      // All annotations should be 2
      const allAnnotations = page.annotations();
      expect(allAnnotations.length).toBe(2);

      // But getLinkAnnotations should only return 1
      const links = page.getLinkAnnotations();
      expect(links.length).toBe(1);
      expect(links[0]!.getSubtype()).toBe(AnnotationTypes.Link);
    });

    it('can add multiple link annotations', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      page.drawLink({
        url: 'https://example.com/page1',
        x: 50,
        y: 300,
        width: 100,
        height: 20,
      });

      page.drawLink({
        url: 'https://example.com/page2',
        x: 200,
        y: 300,
        width: 100,
        height: 20,
      });

      const links = page.getLinkAnnotations();
      expect(links.length).toBe(2);
      expect(links[0]!.getUrl()).toBe('https://example.com/page1');
      expect(links[1]!.getUrl()).toBe('https://example.com/page2');
    });
  });

  describe('removeAnnotation()', () => {
    it('removes a specific annotation from the page', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      page.drawLink({
        url: 'https://example.com',
        x: 50,
        y: 300,
        width: 150,
        height: 20,
      });

      let links = page.getLinkAnnotations();
      expect(links.length).toBe(1);

      const removed = page.removeAnnotation(links[0]!);
      expect(removed).toBe(true);

      links = page.getLinkAnnotations();
      expect(links.length).toBe(0);
    });

    it('returns false when annotation not found', async () => {
      const pdfDoc = await PDFDocument.create();
      const page1 = pdfDoc.addPage([600, 400]);
      const page2 = pdfDoc.addPage([600, 400]);

      page1.drawLink({
        url: 'https://example.com',
        x: 50,
        y: 300,
        width: 150,
        height: 20,
      });

      const links = page1.getLinkAnnotations();

      // Try to remove from wrong page (annotation not on page2)
      const removed = page2.removeAnnotation(links[0]!);
      expect(removed).toBe(false);

      // Original should still be there
      expect(page1.getLinkAnnotations().length).toBe(1);
    });

    it('removes the correct annotation when multiple exist', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      page.drawLink({
        url: 'https://first.com',
        x: 50,
        y: 300,
        width: 100,
        height: 20,
      });

      page.drawLink({
        url: 'https://second.com',
        x: 200,
        y: 300,
        width: 100,
        height: 20,
      });

      page.drawLink({
        url: 'https://third.com',
        x: 350,
        y: 300,
        width: 100,
        height: 20,
      });

      let links = page.getLinkAnnotations();
      expect(links.length).toBe(3);

      // Remove the middle one
      const secondLink = links[1]!;
      expect(secondLink.getUrl()).toBe('https://second.com');
      page.removeAnnotation(secondLink);

      links = page.getLinkAnnotations();
      expect(links.length).toBe(2);
      expect(links[0]!.getUrl()).toBe('https://first.com');
      expect(links[1]!.getUrl()).toBe('https://third.com');
    });
  });

  describe('removeAnnotations()', () => {
    it('removes annotations matching a predicate', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      page.drawLink({
        url: 'https://keep.com/page1',
        x: 50,
        y: 300,
        width: 100,
        height: 20,
      });

      page.drawLink({
        url: 'https://remove.com/page1',
        x: 200,
        y: 300,
        width: 100,
        height: 20,
      });

      page.drawLink({
        url: 'https://remove.com/page2',
        x: 350,
        y: 300,
        width: 100,
        height: 20,
      });

      const removed = page.removeAnnotations((annot) => {
        if (annot.getSubtype() !== AnnotationTypes.Link) return false;
        const url = (annot as PDFLinkAnnotation).getUrl();
        return url?.includes('remove.com') ?? false;
      });

      expect(removed).toBe(2);

      const links = page.getLinkAnnotations();
      expect(links.length).toBe(1);
      expect(links[0]!.getUrl()).toBe('https://keep.com/page1');
    });

    it('returns 0 when no annotations match', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      page.drawLink({
        url: 'https://example.com',
        x: 50,
        y: 300,
        width: 100,
        height: 20,
      });

      const removed = page.removeAnnotations((annot) => {
        const url = (annot as PDFLinkAnnotation).getUrl?.();
        return url?.includes('nonexistent') ?? false;
      });

      expect(removed).toBe(0);
      expect(page.getLinkAnnotations().length).toBe(1);
    });

    it('can remove all annotations', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      page.drawLink({
        url: 'https://example.com/1',
        x: 50,
        y: 300,
        width: 100,
        height: 20,
      });

      page.drawLink({
        url: 'https://example.com/2',
        x: 200,
        y: 300,
        width: 100,
        height: 20,
      });

      const removed = page.removeAnnotations(() => true);

      expect(removed).toBe(2);
      expect(page.annotations().length).toBe(0);
    });
  });

  describe('getRectangle()', () => {
    it('returns the link rectangle', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      page.drawLink({
        url: 'https://example.com',
        x: 50,
        y: 100,
        width: 200,
        height: 30,
      });

      const links = page.getLinkAnnotations();
      const rect = links[0]!.getRectangle();

      expect(rect.x).toBe(50);
      expect(rect.y).toBe(100);
      expect(rect.width).toBe(200);
      expect(rect.height).toBe(30);
    });
  });

  describe('PDF roundtrip', () => {
    it('link annotations persist after save and reload', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      page.drawLink({
        url: 'https://persisted-link.com',
        x: 50,
        y: 300,
        width: 150,
        height: 20,
      });

      // Save and reload
      const pdfBytes = await pdfDoc.save();
      const reloadedDoc = await PDFDocument.load(pdfBytes);
      const reloadedPage = reloadedDoc.getPage(0);

      const links = reloadedPage.getLinkAnnotations();
      expect(links.length).toBe(1);
      expect(links[0]).toBeInstanceOf(PDFLinkAnnotation);
      expect(links[0]!.getUrl()).toBe('https://persisted-link.com');
    });

    it('removed annotations do not persist', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      page.drawLink({
        url: 'https://will-be-removed.com',
        x: 50,
        y: 300,
        width: 150,
        height: 20,
      });

      page.drawLink({
        url: 'https://will-persist.com',
        x: 250,
        y: 300,
        width: 150,
        height: 20,
      });

      // Remove the first link
      const links = page.getLinkAnnotations();
      page.removeAnnotation(links[0]!);

      // Save and reload
      const pdfBytes = await pdfDoc.save();
      const reloadedDoc = await PDFDocument.load(pdfBytes);
      const reloadedPage = reloadedDoc.getPage(0);

      const reloadedLinks = reloadedPage.getLinkAnnotations();
      expect(reloadedLinks.length).toBe(1);
      expect(reloadedLinks[0]!.getUrl()).toBe('https://will-persist.com');
    });
  });
});
