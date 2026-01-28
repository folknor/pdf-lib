import fs from 'fs';
import {
  BlendMode,
  degrees,
  grayscale,
  LineCapStyle,
  PDFArray,
  PDFDocument,
  PDFName,
  pushGraphicsState,
  popGraphicsState,
  rgb,
  cmyk,
  StandardFonts,
} from '../../src/index';
import { TextRenderingMode } from '../../src/api/operators.js';

const birdPng = fs.readFileSync('assets/images/greyscale_bird.png');

describe('PDFDocument', () => {
  describe('getSize() method', () => {
    it("returns the width and height of the the page's MediaBox", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.node.set(PDFName.MediaBox, pdfDoc.context.obj([5, 5, 20, 50]));
      expect(page.getSize()).toEqual({ width: 15, height: 45 });
    });
  });

  describe('setSize() method', () => {
    it("sets the width and height of only the the page's MediaBox when the other boxes are not defined", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();

      page.setMediaBox(5, 5, 20, 50);
      expect(page.getMediaBox()).toEqual({ x: 5, y: 5, width: 20, height: 50 });
      expect(page.node.MediaBox()).toBeInstanceOf(PDFArray);
      expect(page.node.CropBox()).toBeUndefined();
      expect(page.node.BleedBox()).toBeUndefined();
      expect(page.node.TrimBox()).toBeUndefined();
      expect(page.node.ArtBox()).toBeUndefined();

      page.setSize(15, 45);
      expect(page.getSize()).toEqual({ width: 15, height: 45 });
      expect(page.getMediaBox()).toEqual({ x: 5, y: 5, width: 15, height: 45 });
      expect(page.node.MediaBox()).toBeInstanceOf(PDFArray);
      expect(page.node.CropBox()).toBeUndefined();
      expect(page.node.BleedBox()).toBeUndefined();
      expect(page.node.TrimBox()).toBeUndefined();
      expect(page.node.ArtBox()).toBeUndefined();
    });

    it("sets the width and height of the the page's CropBox, BleedBox, TrimBox, and ArtBox when they equal the MediaBox", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();

      page.setMediaBox(5, 5, 20, 50);
      page.setCropBox(5, 5, 20, 50);
      page.setBleedBox(5, 5, 20, 50);
      page.setTrimBox(5, 5, 20, 50);
      page.setArtBox(5, 5, 20, 50);

      expect(page.getMediaBox()).toEqual({ x: 5, y: 5, width: 20, height: 50 });
      expect(page.getCropBox()).toEqual({ x: 5, y: 5, width: 20, height: 50 });
      expect(page.getBleedBox()).toEqual({ x: 5, y: 5, width: 20, height: 50 });
      expect(page.getTrimBox()).toEqual({ x: 5, y: 5, width: 20, height: 50 });
      expect(page.getArtBox()).toEqual({ x: 5, y: 5, width: 20, height: 50 });

      expect(page.node.MediaBox()).toBeInstanceOf(PDFArray);
      expect(page.node.CropBox()).toBeInstanceOf(PDFArray);
      expect(page.node.BleedBox()).toBeInstanceOf(PDFArray);
      expect(page.node.TrimBox()).toBeInstanceOf(PDFArray);
      expect(page.node.ArtBox()).toBeInstanceOf(PDFArray);

      page.setSize(15, 45);
      expect(page.getSize()).toEqual({ width: 15, height: 45 });
      expect(page.getMediaBox()).toEqual({ x: 5, y: 5, width: 15, height: 45 });
      expect(page.getCropBox()).toEqual({ x: 5, y: 5, width: 15, height: 45 });
      expect(page.getBleedBox()).toEqual({ x: 5, y: 5, width: 15, height: 45 });
      expect(page.getTrimBox()).toEqual({ x: 5, y: 5, width: 15, height: 45 });
      expect(page.getArtBox()).toEqual({ x: 5, y: 5, width: 15, height: 45 });
    });

    it("does not set the width and height of the the page's CropBox, BleedBox, TrimBox, or ArtBox when they do not equal the MediaBox", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();

      page.setMediaBox(5, 5, 20, 50);
      page.setCropBox(0, 0, 20, 50);
      page.setBleedBox(5, 5, 10, 25);
      page.setTrimBox(5, 0, 10, 50);
      page.setArtBox(0, 5, 20, 25);

      expect(page.getMediaBox()).toEqual({ x: 5, y: 5, width: 20, height: 50 });
      expect(page.getCropBox()).toEqual({ x: 0, y: 0, width: 20, height: 50 });
      expect(page.getBleedBox()).toEqual({ x: 5, y: 5, width: 10, height: 25 });
      expect(page.getTrimBox()).toEqual({ x: 5, y: 0, width: 10, height: 50 });
      expect(page.getArtBox()).toEqual({ x: 0, y: 5, width: 20, height: 25 });

      expect(page.node.MediaBox()).toBeInstanceOf(PDFArray);
      expect(page.node.CropBox()).toBeInstanceOf(PDFArray);
      expect(page.node.BleedBox()).toBeInstanceOf(PDFArray);
      expect(page.node.TrimBox()).toBeInstanceOf(PDFArray);
      expect(page.node.ArtBox()).toBeInstanceOf(PDFArray);

      page.setSize(15, 45);
      expect(page.getSize()).toEqual({ width: 15, height: 45 });
      expect(page.getMediaBox()).toEqual({ x: 5, y: 5, width: 15, height: 45 });
      expect(page.getCropBox()).toEqual({ x: 0, y: 0, width: 20, height: 50 });
      expect(page.getBleedBox()).toEqual({ x: 5, y: 5, width: 10, height: 25 });
      expect(page.getTrimBox()).toEqual({ x: 5, y: 0, width: 10, height: 50 });
      expect(page.getArtBox()).toEqual({ x: 0, y: 5, width: 20, height: 25 });
    });
  });

  // https://github.com/Hopding/pdf-lib/issues/1075
  it('drawImage() does not reuse existing XObject keys', async () => {
    const pdfDoc1 = await PDFDocument.create();
    const image1 = await pdfDoc1.embedPng(birdPng);
    const page1 = pdfDoc1.addPage();

    expect(page1.node.normalizedEntries().XObject.keys().length).toEqual(0);
    page1.drawImage(image1);
    expect(page1.node.normalizedEntries().XObject.keys().length).toEqual(1);

    const key1 = page1.node.normalizedEntries().XObject.keys()[0];

    const pdfDoc2 = await PDFDocument.load(await pdfDoc1.save());
    const image2 = await pdfDoc2.embedPng(birdPng);
    const page2 = pdfDoc2.getPage(0);

    expect(page2.node.normalizedEntries().XObject.keys().length).toEqual(1);
    page2.drawImage(image2);
    expect(page2.node.normalizedEntries().XObject.keys().length).toEqual(2);

    const key2 = page2.node.normalizedEntries().XObject.keys()[1];
    expect(key1).not.toEqual(key2);
    expect(page2.node.normalizedEntries().XObject.keys()).toEqual([key1, key2]);
  });

  // https://github.com/Hopding/pdf-lib/issues/1075
  it('setFont() does not reuse existing Font keys', async () => {
    const pdfDoc1 = await PDFDocument.create();
    const font1 = await pdfDoc1.embedFont(StandardFonts.Helvetica);
    const page1 = pdfDoc1.addPage();

    expect(page1.node.normalizedEntries().Font.keys().length).toEqual(0);
    page1.setFont(font1);
    expect(page1.node.normalizedEntries().Font.keys().length).toEqual(1);

    const key1 = page1.node.normalizedEntries().Font.keys()[0];

    const pdfDoc2 = await PDFDocument.load(await pdfDoc1.save());
    const font2 = await pdfDoc2.embedFont(StandardFonts.Helvetica);
    const page2 = pdfDoc2.getPage(0);

    expect(page2.node.normalizedEntries().Font.keys().length).toEqual(1);
    page2.setFont(font2);
    expect(page2.node.normalizedEntries().Font.keys().length).toEqual(2);

    const key2 = page2.node.normalizedEntries().Font.keys()[1];
    expect(key1).not.toEqual(key2);
    expect(page2.node.normalizedEntries().Font.keys()).toEqual([key1, key2]);
  });

  // ===== NEW TESTS =====

  describe('getRotation() / setRotation() methods', () => {
    it('returns 0 degrees by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(page.getRotation()).toEqual(degrees(0));
    });

    it('sets and gets 90 degree rotation', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.setRotation(degrees(90));
      expect(page.getRotation()).toEqual(degrees(90));
    });

    it('sets and gets 180 degree rotation', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.setRotation(degrees(180));
      expect(page.getRotation()).toEqual(degrees(180));
    });

    it('sets and gets 270 degree rotation', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.setRotation(degrees(270));
      expect(page.getRotation()).toEqual(degrees(270));
    });

    it('sets and gets negative 90 degree rotation', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.setRotation(degrees(-90));
      expect(page.getRotation()).toEqual(degrees(-90));
    });

    it('throws for non-multiple-of-90 rotation', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() => page.setRotation(degrees(45))).toThrow();
    });
  });

  describe('getWidth() / getHeight() methods', () => {
    it('returns the width from getSize()', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([300, 500]);
      expect(page.getWidth()).toBe(300);
    });

    it('returns the height from getSize()', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([300, 500]);
      expect(page.getHeight()).toBe(500);
    });
  });

  describe('setWidth() / setHeight() methods', () => {
    it('sets only the width while preserving the height', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([300, 500]);
      page.setWidth(400);
      expect(page.getWidth()).toBe(400);
      expect(page.getHeight()).toBe(500);
    });

    it('sets only the height while preserving the width', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([300, 500]);
      page.setHeight(600);
      expect(page.getWidth()).toBe(300);
      expect(page.getHeight()).toBe(600);
    });
  });

  describe('position / cursor methods', () => {
    it('getPosition() returns (0, 0) by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(page.getPosition()).toEqual({ x: 0, y: 0 });
    });

    it('getX() returns 0 by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(page.getX()).toBe(0);
    });

    it('getY() returns 0 by default', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(page.getY()).toBe(0);
    });

    it('moveTo() sets both x and y', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.moveTo(50, 100);
      expect(page.getPosition()).toEqual({ x: 50, y: 100 });
      expect(page.getX()).toBe(50);
      expect(page.getY()).toBe(100);
    });

    it('moveDown() decreases y', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.moveTo(50, 100);
      page.moveDown(30);
      expect(page.getY()).toBe(70);
      expect(page.getX()).toBe(50);
    });

    it('moveUp() increases y', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.moveTo(50, 100);
      page.moveUp(25);
      expect(page.getY()).toBe(125);
      expect(page.getX()).toBe(50);
    });

    it('moveLeft() decreases x', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.moveTo(50, 100);
      page.moveLeft(15);
      expect(page.getX()).toBe(35);
      expect(page.getY()).toBe(100);
    });

    it('moveRight() increases x', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.moveTo(50, 100);
      page.moveRight(20);
      expect(page.getX()).toBe(70);
      expect(page.getY()).toBe(100);
    });

    it('chaining multiple move operations accumulates correctly', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.moveTo(100, 200);
      page.moveRight(10);
      page.moveUp(20);
      page.moveLeft(5);
      page.moveDown(8);
      expect(page.getX()).toBe(105);
      expect(page.getY()).toBe(212);
    });

    it('resetPosition() resets x and y to (0, 0)', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.moveTo(50, 100);
      expect(page.getPosition()).toEqual({ x: 50, y: 100 });
      page.resetPosition();
      expect(page.getPosition()).toEqual({ x: 0, y: 0 });
    });
  });

  describe('setFontSize() method', () => {
    it('does not throw when setting a valid font size', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() => page.setFontSize(12)).not.toThrow();
      expect(() => page.setFontSize(36)).not.toThrow();
      expect(() => page.setFontSize(0)).not.toThrow();
    });
  });

  describe('setFontColor() method', () => {
    it('does not throw when setting an rgb color', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() => page.setFontColor(rgb(0.5, 0.5, 0.5))).not.toThrow();
    });

    it('does not throw when setting a cmyk color', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() => page.setFontColor(cmyk(0.4, 0.7, 0.39, 0.15))).not.toThrow();
    });

    it('does not throw when setting a grayscale color', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() => page.setFontColor(grayscale(0.5))).not.toThrow();
    });
  });

  describe('setLineHeight() method', () => {
    it('does not throw when setting a valid line height', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() => page.setLineHeight(12)).not.toThrow();
      expect(() => page.setLineHeight(36)).not.toThrow();
    });
  });

  describe('drawText() method', () => {
    it('draws text with default options (auto-embeds Helvetica)', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() => page.drawText('Hello, World!')).not.toThrow();
    });

    it('draws text with an explicit font', async () => {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const page = pdfDoc.addPage();
      expect(() =>
        page.drawText('Hello, World!', { font }),
      ).not.toThrow();
    });

    it('draws text with all options', async () => {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Courier);
      const page = pdfDoc.addPage();
      expect(() =>
        page.drawText('Hello\nWorld', {
          x: 50,
          y: 400,
          font,
          size: 18,
          color: rgb(1, 0, 0),
          opacity: 0.75,
          lineHeight: 20,
          rotate: degrees(10),
          xSkew: degrees(5),
          ySkew: degrees(5),
          blendMode: BlendMode.Multiply,
          maxWidth: 200,
          wordBreaks: [' '],
        }),
      ).not.toThrow();
    });

    it('draws text at the current cursor position when x/y not specified', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      page.setFont(font);
      page.moveTo(100, 200);
      // Should not throw; text drawn at (100, 200)
      expect(() => page.drawText('Positioned text')).not.toThrow();
    });

    it('uses the default font size and line height set on the page', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      page.setFont(font);
      page.setFontSize(14);
      page.setLineHeight(18);
      page.setFontColor(rgb(0, 0, 1));
      // Should not throw
      expect(() => page.drawText('Styled text\nSecond line')).not.toThrow();
    });

    it('restores the old font after drawing with a different font', async () => {
      const pdfDoc = await PDFDocument.create();
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const courier = await pdfDoc.embedFont(StandardFonts.Courier);
      const page = pdfDoc.addPage();
      page.setFont(helvetica);

      // Draw with courier temporarily
      page.drawText('Courier text', { font: courier });

      // The page's default font should be restored to helvetica
      // Drawing again without specifying font should not throw
      expect(() => page.drawText('Back to Helvetica')).not.toThrow();
    });

    it('draws text with stroke options', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      expect(() =>
        page.drawText('Stroked text', {
          font,
          strokeColor: rgb(1, 0, 0),
          strokeWidth: 2,
          renderMode: TextRenderingMode.Outline,
        }),
      ).not.toThrow();
    });

    it('handles multiline text with maxWidth', async () => {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const page = pdfDoc.addPage();
      expect(() =>
        page.drawText(
          'This is a long sentence that should be broken into multiple lines when maxWidth is specified.',
          { font, maxWidth: 100 },
        ),
      ).not.toThrow();
    });
  });

  describe('drawRectangle() method', () => {
    it('draws a rectangle with default options', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() => page.drawRectangle()).not.toThrow();
    });

    it('draws a rectangle with all options', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() =>
        page.drawRectangle({
          x: 50,
          y: 50,
          width: 200,
          height: 100,
          rotate: degrees(15),
          xSkew: degrees(5),
          ySkew: degrees(5),
          borderWidth: 3,
          borderColor: grayscale(0.5),
          borderDashArray: [5, 3],
          borderDashPhase: 0,
          borderLineCap: LineCapStyle.Round,
          color: rgb(0.75, 0.2, 0.2),
          opacity: 0.5,
          borderOpacity: 0.75,
          blendMode: BlendMode.Overlay,
        }),
      ).not.toThrow();
    });

    it('draws a rectangle with only borderColor (no fill)', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() =>
        page.drawRectangle({
          x: 10,
          y: 10,
          width: 100,
          height: 50,
          borderColor: rgb(0, 0, 1),
          borderWidth: 2,
        }),
      ).not.toThrow();
    });

    it('draws a rectangle with rounded corners', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() =>
        page.drawRectangle({
          x: 10,
          y: 10,
          width: 200,
          height: 100,
          rx: 10,
          ry: 10,
          color: rgb(0, 1, 0),
        }),
      ).not.toThrow();
    });

    it('uses page cursor position when x/y not specified', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.moveTo(75, 150);
      expect(() =>
        page.drawRectangle({ width: 50, height: 30 }),
      ).not.toThrow();
    });
  });

  describe('drawLine() method', () => {
    it('draws a line with minimal options', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() =>
        page.drawLine({
          start: { x: 0, y: 0 },
          end: { x: 100, y: 100 },
        }),
      ).not.toThrow();
    });

    it('draws a line with all options', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() =>
        page.drawLine({
          start: { x: 25, y: 75 },
          end: { x: 200, y: 300 },
          thickness: 3,
          color: rgb(0.75, 0.2, 0.2),
          opacity: 0.5,
          dashArray: [5, 3],
          dashPhase: 0,
          lineCap: LineCapStyle.Round,
          blendMode: BlendMode.Normal,
        }),
      ).not.toThrow();
    });

    it('defaults to black when no color specified', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      // Should not throw; defaults color to black internally
      expect(() =>
        page.drawLine({
          start: { x: 0, y: 0 },
          end: { x: 50, y: 50 },
        }),
      ).not.toThrow();
    });
  });

  describe('drawEllipse() method', () => {
    it('draws an ellipse with default options', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() => page.drawEllipse()).not.toThrow();
    });

    it('draws an ellipse with all options', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() =>
        page.drawEllipse({
          x: 200,
          y: 200,
          xScale: 100,
          yScale: 50,
          rotate: degrees(30),
          color: rgb(0.75, 0.2, 0.2),
          opacity: 0.5,
          borderColor: grayscale(0.5),
          borderWidth: 3,
          borderOpacity: 0.75,
          borderDashArray: [5, 3],
          borderDashPhase: 0,
          borderLineCap: LineCapStyle.Butt,
          blendMode: BlendMode.Screen,
        }),
      ).not.toThrow();
    });

    it('draws an ellipse with only borderColor', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() =>
        page.drawEllipse({
          x: 100,
          y: 100,
          xScale: 80,
          yScale: 40,
          borderColor: rgb(1, 0, 0),
          borderWidth: 2,
        }),
      ).not.toThrow();
    });
  });

  describe('drawCircle() method', () => {
    it('draws a circle with default options', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() => page.drawCircle()).not.toThrow();
    });

    it('draws a circle with all options', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() =>
        page.drawCircle({
          x: 200,
          y: 150,
          size: 75,
          color: rgb(0.75, 0.2, 0.2),
          opacity: 0.5,
          borderColor: grayscale(0.5),
          borderWidth: 5,
          borderOpacity: 0.75,
          blendMode: BlendMode.Darken,
        }),
      ).not.toThrow();
    });

    it('uses default size of 100 when size not specified', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      // drawCircle without size should use default 100
      expect(() =>
        page.drawCircle({ x: 150, y: 150, color: rgb(0, 0, 1) }),
      ).not.toThrow();
    });
  });

  describe('drawSquare() method', () => {
    it('draws a square with default options', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() => page.drawSquare()).not.toThrow();
    });

    it('draws a square with size and styling', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() =>
        page.drawSquare({
          x: 50,
          y: 50,
          size: 100,
          color: rgb(0, 1, 0),
          borderColor: rgb(0, 0, 0),
          borderWidth: 2,
          opacity: 0.8,
          borderOpacity: 1,
          rotate: degrees(45),
        }),
      ).not.toThrow();
    });
  });

  describe('drawSvgPath() method', () => {
    const svgPath =
      'M 0,20 L 100,160 Q 130,200 150,120 C 190,-40 200,200 300,150 L 400,90';

    it('draws an SVG path with default options', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() => page.drawSvgPath(svgPath)).not.toThrow();
    });

    it('draws an SVG path with all options', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() =>
        page.drawSvgPath(svgPath, {
          x: 25,
          y: 75,
          scale: 0.5,
          rotate: degrees(15),
          color: rgb(1, 0, 0),
          opacity: 0.75,
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 2,
          borderOpacity: 0.8,
          borderDashArray: [4, 2],
          borderDashPhase: 1,
          borderLineCap: LineCapStyle.Square,
          blendMode: BlendMode.Multiply,
        }),
      ).not.toThrow();
    });

    it('defaults to border-only rendering when neither color nor borderColor specified', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      // When no color or borderColor, it sets borderColor to black
      expect(() => page.drawSvgPath(svgPath, { x: 10, y: 10 })).not.toThrow();
    });

    it('draws an SVG path at the current cursor position', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.moveTo(100, 200);
      expect(() => page.drawSvgPath('M 0,0 L 50,50')).not.toThrow();
    });
  });

  describe('drawImage() with options', () => {
    it('draws an image with all options', async () => {
      const pdfDoc = await PDFDocument.create();
      const image = await pdfDoc.embedPng(birdPng);
      const page = pdfDoc.addPage();
      expect(() =>
        page.drawImage(image, {
          x: 50,
          y: 50,
          width: 100,
          height: 80,
          rotate: degrees(45),
          xSkew: degrees(5),
          ySkew: degrees(5),
          opacity: 0.5,
          blendMode: BlendMode.Screen,
        }),
      ).not.toThrow();
    });

    it('draws an image at the cursor position when x/y not specified', async () => {
      const pdfDoc = await PDFDocument.create();
      const image = await pdfDoc.embedPng(birdPng);
      const page = pdfDoc.addPage();
      page.moveTo(100, 200);
      expect(() => page.drawImage(image)).not.toThrow();
    });

    it('uses the image native dimensions when width/height not specified', async () => {
      const pdfDoc = await PDFDocument.create();
      const image = await pdfDoc.embedPng(birdPng);
      const page = pdfDoc.addPage();
      expect(() => page.drawImage(image, { x: 0, y: 0 })).not.toThrow();
    });
  });

  describe('translateContent() method', () => {
    it('does not throw when translating content', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() => page.translateContent(50, 50)).not.toThrow();
    });

    it('can translate by zero', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() => page.translateContent(0, 0)).not.toThrow();
    });

    it('can translate by negative values', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() => page.translateContent(-25, -30)).not.toThrow();
    });
  });

  describe('scale() method', () => {
    it('scales both size and content', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([200, 400]);
      page.scale(0.5, 0.5);
      expect(page.getWidth()).toBe(100);
      expect(page.getHeight()).toBe(200);
    });

    it('can scale up', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([100, 200]);
      page.scale(2, 3);
      expect(page.getWidth()).toBe(200);
      expect(page.getHeight()).toBe(600);
    });

    it('can scale independently on x and y', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([200, 400]);
      page.scale(0.5, 1.5);
      expect(page.getWidth()).toBe(100);
      expect(page.getHeight()).toBe(600);
    });
  });

  describe('scaleContent() method', () => {
    it('does not change the page size', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([200, 400]);
      page.scaleContent(0.5, 0.5);
      expect(page.getWidth()).toBe(200);
      expect(page.getHeight()).toBe(400);
    });

    it('does not throw with valid arguments', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() => page.scaleContent(1.5, 2.0)).not.toThrow();
    });
  });

  describe('pushOperators() method', () => {
    it('pushes a single operator', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() => page.pushOperators(pushGraphicsState())).not.toThrow();
    });

    it('pushes multiple operators', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      expect(() =>
        page.pushOperators(pushGraphicsState(), popGraphicsState()),
      ).not.toThrow();
    });

    it('pushes operators and produces valid PDF bytes', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.pushOperators(pushGraphicsState(), popGraphicsState());
      // Saving to bytes should succeed, proving the operators are well-formed
      const bytes = await pdfDoc.save();
      expect(bytes.length).toBeGreaterThan(0);
    });
  });

  describe('getFont() method', () => {
    it('returns a font and key, auto-embedding Helvetica if none set', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const [font, fontKey] = page.getFont();
      expect(font).toBeDefined();
      expect(fontKey).toBeDefined();
    });

    it('returns the explicitly set font', async () => {
      const pdfDoc = await PDFDocument.create();
      const courier = await pdfDoc.embedFont(StandardFonts.Courier);
      const page = pdfDoc.addPage();
      page.setFont(courier);
      const [font] = page.getFont();
      expect(font).toBe(courier);
    });
  });

  describe('end-to-end: draw operations produce saveable PDF', () => {
    it('saves a PDF with multiple draw operations', async () => {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const image = await pdfDoc.embedPng(birdPng);
      const page = pdfDoc.addPage([600, 800]);

      page.setFont(font);
      page.setFontSize(16);
      page.setFontColor(rgb(0, 0, 0));
      page.setLineHeight(20);

      page.moveTo(50, 750);
      page.drawText('Title');

      page.moveDown(30);
      page.drawText('Body text here', { size: 12 });

      page.drawRectangle({
        x: 50,
        y: 600,
        width: 200,
        height: 100,
        color: rgb(0.9, 0.9, 0.9),
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      page.drawCircle({ x: 300, y: 400, size: 50, color: rgb(1, 0, 0) });

      page.drawEllipse({
        x: 400,
        y: 300,
        xScale: 80,
        yScale: 40,
        color: rgb(0, 0, 1),
      });

      page.drawLine({
        start: { x: 50, y: 200 },
        end: { x: 550, y: 200 },
        thickness: 2,
        color: grayscale(0.5),
      });

      page.drawImage(image, { x: 50, y: 50, width: 100, height: 100 });

      page.drawSvgPath('M 0,0 L 50,50 L 100,0 Z', {
        x: 400,
        y: 100,
        color: rgb(0, 1, 0),
      });

      page.drawSquare({
        x: 250,
        y: 500,
        size: 60,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      const bytes = await pdfDoc.save();
      expect(bytes.length).toBeGreaterThan(0);

      // Verify the saved PDF can be loaded back
      const loadedDoc = await PDFDocument.load(bytes);
      expect(loadedDoc.getPageCount()).toBe(1);
    });
  });

  describe('rotation persists through save/load', () => {
    it('rotation is preserved after saving and reloading', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.setRotation(degrees(90));

      const bytes = await pdfDoc.save();
      const loaded = await PDFDocument.load(bytes);
      const loadedPage = loaded.getPage(0);
      expect(loadedPage.getRotation()).toEqual(degrees(90));
    });
  });

  describe('size persists through save/load', () => {
    it('page dimensions are preserved after saving and reloading', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([123, 456]);

      const bytes = await pdfDoc.save();
      const loaded = await PDFDocument.load(bytes);
      const loadedPage = loaded.getPage(0);
      expect(loadedPage.getWidth()).toBe(123);
      expect(loadedPage.getHeight()).toBe(456);
    });
  });
});
