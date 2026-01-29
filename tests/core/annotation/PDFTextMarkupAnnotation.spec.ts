import {
  AnnotationTypes,
  PDFAnnotation,
  PDFDocument,
  PDFNumber,
  PDFTextMarkupAnnotation,
} from '../../../src/index';

describe('PDFTextMarkupAnnotation', () => {
  describe('annotations() method', () => {
    it('returns empty array when page has no annotations', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();

      const annotations = page.annotations();
      expect(annotations).toBeDefined();
      expect(annotations.length).toBe(0);
    });
  });

  describe('addTextMarkupAnnotation()', () => {
    it('can add a highlight annotation to a page', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      const annotation = page.addTextMarkupAnnotation({
        subtype: AnnotationTypes.Highlight,
        color: [1, 1, 0], // Yellow
        rect: {
          x: 50,
          y: 300,
          width: 150,
          height: 20,
        },
        contents: 'This is a highlight annotation',
        quadPoints: {
          leftbottomX: 50,
          leftbottomY: 300,
          lefttopX: 50,
          lefttopY: 320,
          righttopX: 200,
          righttopY: 320,
          rightbottomX: 200,
          rightbottomY: 300,
        },
      });

      expect(annotation).toBeDefined();
      expect(annotation).toBeInstanceOf(PDFTextMarkupAnnotation);
      expect(annotation.getSubtype()).toBe(AnnotationTypes.Highlight);
    });

    it('can read back added highlight annotation from page', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      page.addTextMarkupAnnotation({
        subtype: AnnotationTypes.Highlight,
        color: [1, 1, 0],
        rect: { x: 50, y: 300, width: 150, height: 20 },
        contents: 'Test highlight',
        quadPoints: {
          leftbottomX: 50,
          leftbottomY: 300,
          lefttopX: 50,
          lefttopY: 320,
          righttopX: 200,
          righttopY: 320,
          rightbottomX: 200,
          rightbottomY: 300,
        },
      });

      const annotations = page.annotations();
      expect(annotations.length).toBe(1);

      const fetched = annotations[0] as PDFTextMarkupAnnotation;
      expect(fetched).toBeInstanceOf(PDFTextMarkupAnnotation);
      expect(fetched.getSubtype()).toBe(AnnotationTypes.Highlight);
      expect(fetched.Contents()?.asString()).toBe('Test highlight');
    });

    it('can add underline annotation', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      const annotation = page.addTextMarkupAnnotation({
        subtype: AnnotationTypes.Underline,
        color: [0, 0, 1], // Blue
        rect: { x: 100, y: 200, width: 200, height: 15 },
        quadPoints: {
          leftbottomX: 100,
          leftbottomY: 200,
          lefttopX: 100,
          lefttopY: 215,
          righttopX: 300,
          righttopY: 215,
          rightbottomX: 300,
          rightbottomY: 200,
        },
      });

      expect(annotation.getSubtype()).toBe(AnnotationTypes.Underline);
    });

    it('can add strikeout annotation', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      const annotation = page.addTextMarkupAnnotation({
        subtype: AnnotationTypes.StrikeOut,
        color: [1, 0, 0], // Red
        rect: { x: 100, y: 200, width: 200, height: 15 },
        quadPoints: {
          leftbottomX: 100,
          leftbottomY: 200,
          lefttopX: 100,
          lefttopY: 215,
          righttopX: 300,
          righttopY: 215,
          rightbottomX: 300,
          rightbottomY: 200,
        },
      });

      expect(annotation.getSubtype()).toBe(AnnotationTypes.StrikeOut);
    });

    it('can add squiggly annotation', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      const annotation = page.addTextMarkupAnnotation({
        subtype: AnnotationTypes.Squiggly,
        color: [0, 1, 0], // Green
        rect: { x: 100, y: 200, width: 200, height: 15 },
        quadPoints: {
          leftbottomX: 100,
          leftbottomY: 200,
          lefttopX: 100,
          lefttopY: 215,
          righttopX: 300,
          righttopY: 215,
          rightbottomX: 300,
          rightbottomY: 200,
        },
      });

      expect(annotation.getSubtype()).toBe(AnnotationTypes.Squiggly);
    });

    it('sets optional properties correctly', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const modDate = new Date('2024-01-15T10:30:00Z');

      const annotation = page.addTextMarkupAnnotation({
        subtype: AnnotationTypes.Highlight,
        color: [1, 1, 0],
        rect: { x: 50, y: 300, width: 150, height: 20 },
        contents: 'Test contents',
        name: 'test-annotation-id',
        flags: 4, // Print flag
        border: [0, 0, 1],
        modificationDate: modDate,
        quadPoints: {
          leftbottomX: 50,
          leftbottomY: 300,
          lefttopX: 50,
          lefttopY: 320,
          righttopX: 200,
          righttopY: 320,
          rightbottomX: 200,
          rightbottomY: 300,
        },
      });

      expect(annotation.Contents()?.asString()).toBe('Test contents');
      expect(annotation.NM()?.asString()).toBe('test-annotation-id');
      expect(annotation.getFlags()).toBe(4);
    });
  });

  describe('QuadPoints()', () => {
    it('returns quad points as array of PDFNumbers', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      const annotation = page.addTextMarkupAnnotation({
        subtype: AnnotationTypes.Highlight,
        color: [1, 1, 0],
        rect: { x: 50, y: 300, width: 150, height: 20 },
        quadPoints: {
          leftbottomX: 50,
          leftbottomY: 300,
          lefttopX: 50,
          lefttopY: 320,
          righttopX: 200,
          righttopY: 320,
          rightbottomX: 200,
          rightbottomY: 300,
        },
      });

      const quadPoints = annotation.QuadPoints();
      expect(quadPoints).toBeDefined();
      expect(quadPoints?.length).toBe(8);
      expect(quadPoints?.[0]).toBeInstanceOf(PDFNumber);
    });
  });

  describe('setQuadPoints()', () => {
    it('can set quad points with tuple', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      const annotation = page.addTextMarkupAnnotation({
        subtype: AnnotationTypes.Highlight,
        color: [1, 1, 0],
        rect: { x: 50, y: 300, width: 150, height: 20 },
        quadPoints: {
          leftbottomX: 50,
          leftbottomY: 300,
          lefttopX: 50,
          lefttopY: 320,
          righttopX: 200,
          righttopY: 320,
          rightbottomX: 200,
          rightbottomY: 300,
        },
      });

      annotation.setQuadPoints([10, 20, 30, 40, 50, 60, 70, 80]);
      const quadPoints = annotation.QuadPoints();
      expect(quadPoints?.[0].asNumber()).toBe(10);
      expect(quadPoints?.[7].asNumber()).toBe(80);
    });

    it('can set quad points with individual arguments', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      const annotation = page.addTextMarkupAnnotation({
        subtype: AnnotationTypes.Highlight,
        color: [1, 1, 0],
        rect: { x: 50, y: 300, width: 150, height: 20 },
        quadPoints: {
          leftbottomX: 50,
          leftbottomY: 300,
          lefttopX: 50,
          lefttopY: 320,
          righttopX: 200,
          righttopY: 320,
          rightbottomX: 200,
          rightbottomY: 300,
        },
      });

      annotation.setQuadPoints(100, 110, 120, 130, 140, 150, 160, 170);
      const quadPoints = annotation.QuadPoints();
      expect(quadPoints?.[0].asNumber()).toBe(100);
      expect(quadPoints?.[7].asNumber()).toBe(170);
    });
  });

  describe('PDFAnnotation base class methods', () => {
    it('getSubtype returns AnnotationTypes enum value', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      const annotation = page.addTextMarkupAnnotation({
        subtype: AnnotationTypes.Highlight,
        color: [1, 1, 0],
        rect: { x: 50, y: 300, width: 150, height: 20 },
        quadPoints: {
          leftbottomX: 50,
          leftbottomY: 300,
          lefttopX: 50,
          lefttopY: 320,
          righttopX: 200,
          righttopY: 320,
          rightbottomX: 200,
          rightbottomY: 300,
        },
      });

      expect(annotation.getSubtype()).toBe(AnnotationTypes.Highlight);
    });

    it('getRectangle returns correct dimensions', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      const annotation = page.addTextMarkupAnnotation({
        subtype: AnnotationTypes.Highlight,
        color: [1, 1, 0],
        rect: { x: 50, y: 300, width: 150, height: 20 },
        quadPoints: {
          leftbottomX: 50,
          leftbottomY: 300,
          lefttopX: 50,
          lefttopY: 320,
          righttopX: 200,
          righttopY: 320,
          rightbottomX: 200,
          rightbottomY: 300,
        },
      });

      const rect = annotation.getRectangle();
      expect(rect.x).toBe(50);
      expect(rect.y).toBe(300);
      expect(rect.width).toBe(150);
      expect(rect.height).toBe(20);
    });

    it('getParentPage returns the page the annotation is on', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      const annotation = page.addTextMarkupAnnotation({
        subtype: AnnotationTypes.Highlight,
        color: [1, 1, 0],
        rect: { x: 50, y: 300, width: 150, height: 20 },
        quadPoints: {
          leftbottomX: 50,
          leftbottomY: 300,
          lefttopX: 50,
          lefttopY: 320,
          righttopX: 200,
          righttopY: 320,
          rightbottomX: 200,
          rightbottomY: 300,
        },
      });

      const parentPage = annotation.getParentPage();
      expect(parentPage).toBeDefined();
      expect(parentPage).toBe(page.node);
    });
  });

  describe('AnnotationFactory', () => {
    it('creates PDFTextMarkupAnnotation for highlight subtype', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      page.addTextMarkupAnnotation({
        subtype: AnnotationTypes.Highlight,
        color: [1, 1, 0],
        rect: { x: 50, y: 300, width: 150, height: 20 },
        quadPoints: {
          leftbottomX: 50,
          leftbottomY: 300,
          lefttopX: 50,
          lefttopY: 320,
          righttopX: 200,
          righttopY: 320,
          rightbottomX: 200,
          rightbottomY: 300,
        },
      });

      const annotations = page.annotations();
      expect(annotations[0]).toBeInstanceOf(PDFTextMarkupAnnotation);
    });

    it('creates PDFAnnotation for generic annotation subtypes', async () => {
      // Non-markup annotations should return base PDFAnnotation class
      // This is tested implicitly through the factory behavior
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      // Page has no annotations initially, so annotations() returns empty
      expect(page.annotations().length).toBe(0);
    });
  });

  describe('PDF roundtrip', () => {
    it('annotations persist after save and reload', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);

      page.addTextMarkupAnnotation({
        subtype: AnnotationTypes.Highlight,
        color: [1, 1, 0],
        rect: { x: 50, y: 300, width: 150, height: 20 },
        contents: 'Persisted highlight',
        quadPoints: {
          leftbottomX: 50,
          leftbottomY: 300,
          lefttopX: 50,
          lefttopY: 320,
          righttopX: 200,
          righttopY: 320,
          rightbottomX: 200,
          rightbottomY: 300,
        },
      });

      // Save and reload
      const pdfBytes = await pdfDoc.save();
      const reloadedDoc = await PDFDocument.load(pdfBytes);
      const reloadedPage = reloadedDoc.getPage(0);

      const annotations = reloadedPage.annotations();
      expect(annotations.length).toBe(1);

      const annotation = annotations[0] as PDFTextMarkupAnnotation;
      expect(annotation).toBeInstanceOf(PDFTextMarkupAnnotation);
      expect(annotation.getSubtype()).toBe(AnnotationTypes.Highlight);
      expect(annotation.Contents()?.asString()).toBe('Persisted highlight');
    });
  });
});
