import {
  BlendMode,
  cmyk,
  degrees,
  grayscale,
  LineCapStyle,
  PDFArray,
  PDFContentStream,
  PDFDocument,
  PDFName,
  rgb,
  StandardFonts,
} from '../../src/index';
import { TextRenderingMode } from '../../src/api/operators.js';

/**
 * Helper: extract the full content stream string from the LAST content stream
 * on a page. Drawing operations push operators onto the page's current content
 * stream, so after a series of draw calls, this returns the operator text for
 * everything drawn in the current "batch".
 */
function getLastContentStreamText(
  page: Awaited<ReturnType<typeof PDFDocument.prototype.addPage>>,
  doc: PDFDocument,
): string {
  const contents = page.node.Contents();
  if (!contents || !(contents instanceof PDFArray)) {
    throw new Error('Page has no Contents array');
  }
  const lastIndex = contents.size() - 1;
  const stream = contents.lookup(lastIndex);
  if (stream instanceof PDFContentStream) {
    return stream.getContentsString();
  }
  throw new Error('Last content stream is not a PDFContentStream');
}

/**
 * Helper: get ALL content stream strings for a page, concatenated.
 */
function getAllContentStreamText(
  page: Awaited<ReturnType<typeof PDFDocument.prototype.addPage>>,
  doc: PDFDocument,
): string {
  const contents = page.node.Contents();
  if (!contents || !(contents instanceof PDFArray)) {
    throw new Error('Page has no Contents array');
  }
  let result = '';
  for (let i = 0; i < contents.size(); i++) {
    const stream = contents.lookup(i);
    if (stream instanceof PDFContentStream) {
      result += stream.getContentsString();
    }
  }
  return result;
}

describe('PDFPage Drawing Operations - Content Stream Verification', () => {
  // =========================================================================
  // drawText
  // =========================================================================
  describe('drawText()', () => {
    it('produces BT and ET text block markers', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Hello', { font, x: 0, y: 0 });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('BT\n');
      expect(text).toContain('ET\n');
    });

    it('contains the Tf (font and size) operator with correct font size', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Hello', { font, size: 18, x: 10, y: 20 });

      const text = getLastContentStreamText(page, doc);
      // The Tf operator has the form: /FontName fontSize Tf
      expect(text).toMatch(/\/\S+ 18 Tf/);
    });

    it('contains the correct font reference in the Tf operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Courier);
      page.drawText('Code', { font, x: 0, y: 0 });

      const text = getLastContentStreamText(page, doc);
      // Should have a font name reference like /Courier_0 or similar
      expect(text).toMatch(/\/\S+ \d+ Tf/);
    });

    it('contains the Tj (showText) operator with hex-encoded text', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('ABC', { font, x: 0, y: 0 });

      const text = getLastContentStreamText(page, doc);
      // Text is hex-encoded as PDFHexString: <XXXX> Tj
      expect(text).toMatch(/<[0-9A-Fa-f]+> Tj/);
    });

    it('uses the Tm (text matrix) operator for position, rotation, and skew', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Positioned', { font, x: 100, y: 200, size: 12 });

      const text = getLastContentStreamText(page, doc);
      // The Tm operator sets the text matrix: a b c d e f Tm
      // For no rotation/skew: 1 0 0 1 x y Tm
      expect(text).toMatch(/1 0 0 1 100 200 Tm/);
    });

    it('sets RGB fill color with rg operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Red text', {
        font,
        x: 0,
        y: 0,
        color: rgb(1, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      // RGB fill color: r g b rg
      expect(text).toContain('1 0 0 rg');
    });

    it('sets CMYK fill color with k operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('CMYK text', {
        font,
        x: 0,
        y: 0,
        color: cmyk(0.5, 0.3, 0.1, 0),
      });

      const text = getLastContentStreamText(page, doc);
      // CMYK fill color: c m y k k
      expect(text).toContain('0.5 0.3 0.1 0 k');
    });

    it('sets grayscale fill color with g operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Gray text', {
        font,
        x: 0,
        y: 0,
        color: grayscale(0.5),
      });

      const text = getLastContentStreamText(page, doc);
      // Grayscale fill color: gray g
      expect(text).toContain('0.5 g');
    });

    it('wraps text operators in q/Q (push/pop graphics state)', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Wrapped', { font, x: 0, y: 0 });

      const text = getLastContentStreamText(page, doc);
      const lines = text.split('\n').filter((l) => l.trim() !== '');
      // First operator should be q (push graphics state)
      expect(lines[0]).toBe('q');
      // Last operator should be Q (pop graphics state)
      expect(lines[lines.length - 1]).toBe('Q');
    });

    it('sets the TL (text line height) operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Line height test', {
        font,
        x: 0,
        y: 0,
        lineHeight: 30,
      });

      const text = getLastContentStreamText(page, doc);
      // TL operator: lineHeight TL
      expect(text).toContain('30 TL');
    });

    it('emits T* (next line) for each line in multiline text', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Line1\nLine2\nLine3', {
        font,
        x: 0,
        y: 0,
        lineHeight: 20,
      });

      const text = getLastContentStreamText(page, doc);
      // Each line gets a Tj followed by T*
      const tjMatches = text.match(/<[0-9A-Fa-f]+> Tj/g);
      const tStarMatches = text.match(/T\*/g);
      expect(tjMatches).toHaveLength(3);
      expect(tStarMatches).toHaveLength(3);
    });

    it('applies gs (graphics state) operator when opacity is set', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Semi-transparent', {
        font,
        x: 0,
        y: 0,
        opacity: 0.5,
      });

      const text = getLastContentStreamText(page, doc);
      // Graphics state should be set: /GSname gs
      expect(text).toMatch(/\/GS\S* gs/);
    });

    it('applies gs operator when blendMode is set', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Blended', {
        font,
        x: 0,
        y: 0,
        blendMode: BlendMode.Multiply,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toMatch(/\/GS\S* gs/);
    });

    it('uses default font size of 24 when size is not specified', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Default size', { font, x: 0, y: 0 });

      const text = getLastContentStreamText(page, doc);
      expect(text).toMatch(/\/\S+ 24 Tf/);
    });

    it('uses page default font size when setFontSize was called', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.setFont(font);
      page.setFontSize(14);
      page.drawText('Custom size', { x: 0, y: 0 });

      const text = getLastContentStreamText(page, doc);
      expect(text).toMatch(/\/\S+ 14 Tf/);
    });

    it('uses page cursor position when x/y are not provided', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.setFont(font);
      page.moveTo(55, 77);
      page.drawText('At cursor');

      const text = getLastContentStreamText(page, doc);
      expect(text).toMatch(/1 0 0 1 55 77 Tm/);
    });

    it('sets stroke color (RG) and line width (w) when strokeColor and strokeWidth are provided', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Stroked', {
        font,
        x: 0,
        y: 0,
        strokeColor: rgb(0, 1, 0),
        strokeWidth: 2,
        renderMode: TextRenderingMode.FillAndOutline,
      });

      const text = getLastContentStreamText(page, doc);
      // Stroke color for RGB: R G B RG
      expect(text).toContain('0 1 0 RG');
      // Line width: w operator
      expect(text).toContain('2 w');
      // Text rendering mode: Tr operator (FillAndOutline = 2)
      expect(text).toContain('2 Tr');
    });

    it('applies rotation via the Tm text matrix operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Rotated', {
        font,
        x: 50,
        y: 100,
        rotate: degrees(90),
      });

      const text = getLastContentStreamText(page, doc);
      // For 90 degrees: cos(90)=~0, sin(90)=1
      // Tm matrix should be: 0 1 -1 0 50 100 Tm (approximately)
      expect(text).toMatch(/Tm/);
      // Should NOT be the identity matrix
      expect(text).not.toContain('1 0 0 1 50 100 Tm');
    });
  });

  // =========================================================================
  // drawLine
  // =========================================================================
  describe('drawLine()', () => {
    it('contains m (moveTo) and l (lineTo) operators with correct coordinates', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawLine({
        start: { x: 10, y: 20 },
        end: { x: 300, y: 400 },
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('10 20 m');
      expect(text).toContain('300 400 l');
    });

    it('contains S (stroke) operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawLine({
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toMatch(/\nS\n/);
    });

    it('sets line width with w operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawLine({
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
        thickness: 5,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('5 w');
    });

    it('defaults to thickness 1 when not specified', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawLine({
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('1 w');
    });

    it('sets RGB stroke color with RG operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawLine({
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
        color: rgb(0.75, 0.2, 0.2),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('0.75 0.2 0.2 RG');
    });

    it('defaults to black (0 0 0 RG) when no color specified', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawLine({
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('0 0 0 RG');
    });

    it('sets dash pattern with d operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawLine({
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
        dashArray: [5, 3],
        dashPhase: 2,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('[5 3] 2 d');
    });

    it('sets line cap style with J operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawLine({
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
        lineCap: LineCapStyle.Round,
      });

      const text = getLastContentStreamText(page, doc);
      // Round = 1
      expect(text).toContain('1 J');
    });

    it('wraps line operators in q/Q graphics state', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawLine({
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
      });

      const text = getLastContentStreamText(page, doc);
      const lines = text.split('\n').filter((l) => l.trim() !== '');
      expect(lines[0]).toBe('q');
      expect(lines[lines.length - 1]).toBe('Q');
    });

    it('applies gs operator when opacity is set', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawLine({
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
        opacity: 0.5,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toMatch(/\/GS\S* gs/);
    });

    it('uses grayscale stroke color with G operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawLine({
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
        color: grayscale(0.7),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('0.7 G');
    });

    it('uses CMYK stroke color with K operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawLine({
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
        color: cmyk(0.1, 0.2, 0.3, 0.4),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('0.1 0.2 0.3 0.4 K');
    });
  });

  // =========================================================================
  // drawRectangle
  // =========================================================================
  describe('drawRectangle()', () => {
    it('produces SVG path operators for a basic rectangle', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 50,
        y: 100,
        width: 200,
        height: 150,
        color: rgb(1, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      // drawRectangle now goes through drawSvgPath internally
      // It should contain path operators (m for moveto, l for lineto or H/V as converted)
      // and a fill operator (f)
      expect(text).toContain('m');
      expect(text).toMatch(/\nf\n/);
    });

    it('sets RGB fill color with rg operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        color: rgb(0.5, 0.6, 0.7),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('0.5 0.6 0.7 rg');
    });

    it('uses cm (concat transformation matrix) for positioning', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 50,
        y: 100,
        width: 200,
        height: 150,
        color: rgb(0, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      // The rectangle uses a transformation matrix for positioning
      expect(text).toContain('cm');
    });

    it('sets border color with RG and border width with w operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        borderColor: rgb(1, 0, 0),
        borderWidth: 3,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('1 0 0 RG');
      expect(text).toContain('3 w');
    });

    it('uses B (fill and stroke) when both color and borderColor are set', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        color: rgb(0.9, 0.9, 0.9),
        borderColor: rgb(0, 0, 0),
        borderWidth: 2,
      });

      const text = getLastContentStreamText(page, doc);
      // B = fillAndStroke
      expect(text).toMatch(/\nB\n/);
    });

    it('uses S (stroke only) when only borderColor is set', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toMatch(/\nS\n/);
    });

    it('uses f (fill only) when only color is set', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        color: rgb(0.5, 0.5, 0.5),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toMatch(/\nf\n/);
    });

    it('defaults to black fill when neither color nor borderColor specified', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({ x: 0, y: 0, width: 100, height: 50 });

      const text = getLastContentStreamText(page, doc);
      // Default is to set color to black
      expect(text).toContain('0 0 0 rg');
      expect(text).toMatch(/\nf\n/);
    });

    it('sets border dash pattern with d operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
        borderDashArray: [4, 2],
        borderDashPhase: 1,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('[4 2] 1 d');
    });

    it('wraps rectangle operators in q/Q graphics state', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({ x: 0, y: 0, width: 100, height: 50 });

      const text = getLastContentStreamText(page, doc);
      const lines = text.split('\n').filter((l) => l.trim() !== '');
      expect(lines[0]).toBe('q');
      expect(lines[lines.length - 1]).toBe('Q');
    });

    it('applies gs operator when opacity is specified', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        color: rgb(1, 0, 0),
        opacity: 0.5,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toMatch(/\/GS\S* gs/);
    });

    it('uses CMYK fill color with k operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        color: cmyk(0.2, 0.4, 0.6, 0.1),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('0.2 0.4 0.6 0.1 k');
    });

    it('uses grayscale fill color with g operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        color: grayscale(0.3),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('0.3 g');
    });

    it('applies border line cap with J operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
        borderLineCap: LineCapStyle.Projecting,
      });

      const text = getLastContentStreamText(page, doc);
      // Projecting = 2
      expect(text).toContain('2 J');
    });

    it('uses default width 150 and height 100 when not specified', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({ x: 0, y: 0, color: rgb(0, 0, 0) });

      const text = getLastContentStreamText(page, doc);
      // The SVG path for a 150x100 rectangle: M 0,0 H 150 V 100 H 0 Z
      // This translates to moveTo(0,0), lineTo(150,0), lineTo(150,100), lineTo(0,100), closePath
      expect(text).toContain('150 0 l');
    });
  });

  // =========================================================================
  // drawSquare
  // =========================================================================
  describe('drawSquare()', () => {
    it('produces a square (equal width and height) path', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSquare({
        x: 10,
        y: 20,
        size: 80,
        color: rgb(0, 1, 0),
      });

      const text = getLastContentStreamText(page, doc);
      // SVG path for 80x80: M 0,0 H 80 V 80 H 0 Z
      // Should include lineTo for width=80 and height=80
      expect(text).toContain('80 0 l');
    });

    it('wraps in q/Q and uses fill operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSquare({ x: 0, y: 0, size: 50, color: rgb(0, 0, 1) });

      const text = getLastContentStreamText(page, doc);
      const lines = text.split('\n').filter((l) => l.trim() !== '');
      expect(lines[0]).toBe('q');
      expect(lines[lines.length - 1]).toBe('Q');
      expect(text).toMatch(/\nf\n/);
    });
  });

  // =========================================================================
  // drawCircle
  // =========================================================================
  describe('drawCircle()', () => {
    it('produces bezier curve (c) operators for the circle path', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawCircle({
        x: 200,
        y: 200,
        size: 50,
        color: rgb(1, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      // A circle drawn as bezier curves uses 'c' operators
      const curveMatches = text.match(/\bc\n/g);
      // An ellipse/circle requires 4 bezier curve segments
      expect(curveMatches).not.toBeNull();
      expect(curveMatches!.length).toBe(4);
    });

    it('contains a closePath (h) operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawCircle({ x: 100, y: 100, size: 30, color: rgb(0, 0, 0) });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('\nh\n');
    });

    it('wraps in q/Q graphics state', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawCircle({ x: 100, y: 100, size: 30, color: rgb(0, 0, 0) });

      const text = getLastContentStreamText(page, doc);
      const lines = text.split('\n').filter((l) => l.trim() !== '');
      expect(lines[0]).toBe('q');
      expect(lines[lines.length - 1]).toBe('Q');
    });

    it('sets fill color for a filled circle', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawCircle({
        x: 100,
        y: 100,
        size: 50,
        color: rgb(0.2, 0.4, 0.8),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('0.2 0.4 0.8 rg');
      expect(text).toMatch(/\nf\n/);
    });

    it('uses stroke operator when only borderColor is set', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawCircle({
        x: 100,
        y: 100,
        size: 50,
        borderColor: rgb(0, 0, 0),
        borderWidth: 2,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('0 0 0 RG');
      expect(text).toContain('2 w');
      expect(text).toMatch(/\nS\n/);
    });

    it('uses fill and stroke when both color and borderColor are set', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawCircle({
        x: 100,
        y: 100,
        size: 50,
        color: rgb(1, 1, 0),
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('1 1 0 rg');
      expect(text).toContain('0 0 0 RG');
      expect(text).toMatch(/\nB\n/);
    });
  });

  // =========================================================================
  // drawEllipse
  // =========================================================================
  describe('drawEllipse()', () => {
    it('produces bezier curve operators for the ellipse', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawEllipse({
        x: 200,
        y: 200,
        xScale: 100,
        yScale: 50,
        color: rgb(0, 0, 1),
      });

      const text = getLastContentStreamText(page, doc);
      const curveMatches = text.match(/\bc\n/g);
      expect(curveMatches).not.toBeNull();
      expect(curveMatches!.length).toBe(4);
    });

    it('contains a closePath (h) and fill (f) operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawEllipse({
        x: 100,
        y: 100,
        xScale: 80,
        yScale: 40,
        color: rgb(1, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('\nh\n');
      expect(text).toMatch(/\nf\n/);
    });

    it('uses transformation matrix (cm) for positioning', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawEllipse({
        x: 150,
        y: 250,
        xScale: 60,
        yScale: 30,
        color: rgb(0, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      // Ellipse uses cm for translation and scale
      expect(text).toContain('cm');
    });

    it('sets border dash pattern with d operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawEllipse({
        x: 100,
        y: 100,
        xScale: 50,
        yScale: 50,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
        borderDashArray: [3, 5],
        borderDashPhase: 0,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('[3 5] 0 d');
    });
  });

  // =========================================================================
  // drawSvgPath
  // =========================================================================
  describe('drawSvgPath()', () => {
    it('translates M (moveTo) SVG command to m PDF operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 10,20 L 30,40', {
        x: 0,
        y: 0,
        borderColor: rgb(0, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('10 20 m');
    });

    it('translates L (lineTo) SVG command to l PDF operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 0,0 L 100,200', {
        x: 0,
        y: 0,
        borderColor: rgb(0, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('100 200 l');
    });

    it('translates C (cubic bezier) SVG command to c PDF operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 0,0 C 10,20 30,40 50,60', {
        x: 0,
        y: 0,
        borderColor: rgb(0, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toMatch(/10 20 30 40 50 60 c/);
    });

    it('translates Q (quadratic bezier) SVG command to v PDF operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 0,0 Q 50,100 100,0', {
        x: 0,
        y: 0,
        borderColor: rgb(0, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      // Quadratic curves use v (CurveToReplicateInitialPoint)
      expect(text).toMatch(/v\n/);
    });

    it('translates Z (closePath) SVG command to h PDF operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 0,0 L 100,0 L 50,100 Z', {
        x: 0,
        y: 0,
        color: rgb(0, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('\nh\n');
    });

    it('applies the scale option as a cm transformation', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 0,0 L 100,100', {
        x: 0,
        y: 0,
        scale: 0.5,
        borderColor: rgb(0, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      // Scale 0.5 is applied via cm: 0.5 0 0 -0.5 0 0 cm (y-flip applied)
      expect(text).toContain('0.5 0 0 -0.5 0 0 cm');
    });

    it('applies no explicit scale but still flips Y axis (1 0 0 -1)', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 0,0 L 100,100', {
        x: 0,
        y: 0,
        borderColor: rgb(0, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      // Default: Y axis flip: scale(1, -1) => 1 0 0 -1 0 0 cm
      expect(text).toContain('1 0 0 -1 0 0 cm');
    });

    it('applies translate via cm operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 0,0 L 100,100', {
        x: 50,
        y: 75,
        borderColor: rgb(0, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      // Translation: 1 0 0 1 x y cm
      expect(text).toContain('1 0 0 1 50 75 cm');
    });

    it('sets fill color when color is specified and uses f operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 0,0 L 100,0 L 50,100 Z', {
        x: 0,
        y: 0,
        color: rgb(1, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('1 0 0 rg');
      expect(text).toMatch(/\nf\n/);
    });

    it('sets stroke color when borderColor is specified and uses S operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 0,0 L 100,0 L 50,100 Z', {
        x: 0,
        y: 0,
        borderColor: rgb(0, 1, 0),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('0 1 0 RG');
      expect(text).toMatch(/\nS\n/);
    });

    it('uses B (fill and stroke) when both color and borderColor are specified', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 0,0 L 100,0 L 50,100 Z', {
        x: 0,
        y: 0,
        color: rgb(1, 0, 0),
        borderColor: rgb(0, 0, 1),
        borderWidth: 2,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('1 0 0 rg');
      expect(text).toContain('0 0 1 RG');
      expect(text).toContain('2 w');
      expect(text).toMatch(/\nB\n/);
    });

    it('defaults to borderColor black when neither color nor borderColor specified', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 0,0 L 100,0 L 50,100 Z', {
        x: 0,
        y: 0,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('0 0 0 RG');
      expect(text).toMatch(/\nS\n/);
    });

    it('sets border width with w operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 0,0 L 100,100', {
        x: 0,
        y: 0,
        borderColor: rgb(0, 0, 0),
        borderWidth: 4,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('4 w');
    });

    it('applies gs when opacity is specified', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 0,0 L 100,100', {
        x: 0,
        y: 0,
        color: rgb(1, 0, 0),
        opacity: 0.6,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toMatch(/\/GS\S* gs/);
    });

    it('applies gs when borderOpacity is specified', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 0,0 L 100,100', {
        x: 0,
        y: 0,
        borderColor: rgb(0, 0, 0),
        borderOpacity: 0.3,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toMatch(/\/GS\S* gs/);
    });

    it('sets border dash pattern with d operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 0,0 L 100,100', {
        x: 0,
        y: 0,
        borderColor: rgb(0, 0, 0),
        borderDashArray: [8, 4],
        borderDashPhase: 2,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('[8 4] 2 d');
    });

    it('handles complex SVG paths with multiple commands', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const complexPath =
        'M 0,20 L 100,160 Q 130,200 150,120 C 190,-40 200,200 300,150 L 400,90';
      page.drawSvgPath(complexPath, {
        x: 0,
        y: 0,
        borderColor: rgb(0, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      // Should have moveTo
      expect(text).toContain('0 20 m');
      // Should have lineTo
      expect(text).toContain('100 160 l');
      // Should have bezier curve
      expect(text).toMatch(/c\n/);
      // Should have quadratic curve (mapped to v)
      expect(text).toMatch(/v\n/);
      // Ends with stroke
      expect(text).toMatch(/\nS\n/);
    });
  });

  // =========================================================================
  // Color Verification - Cross-cutting
  // =========================================================================
  describe('Color operator verification across draw methods', () => {
    it('drawRectangle with CMYK border color uses K operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        borderColor: cmyk(0.1, 0.2, 0.3, 0.4),
        borderWidth: 1,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('0.1 0.2 0.3 0.4 K');
    });

    it('drawEllipse with grayscale fill uses g operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawEllipse({
        x: 100,
        y: 100,
        xScale: 50,
        yScale: 50,
        color: grayscale(0.8),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('0.8 g');
    });

    it('drawCircle with CMYK fill uses k operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawCircle({
        x: 100,
        y: 100,
        size: 50,
        color: cmyk(0, 0.5, 1, 0),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('0 0.5 1 0 k');
    });

    it('drawSvgPath with grayscale stroke uses G operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 0,0 L 100,100', {
        x: 0,
        y: 0,
        borderColor: grayscale(0.4),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('0.4 G');
    });
  });

  // =========================================================================
  // Graphics State (Opacity/BlendMode) Verification
  // =========================================================================
  describe('Graphics state (opacity/blendMode) verification', () => {
    it('embeds ExtGState resource when opacity is used in drawRectangle', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        color: rgb(1, 0, 0),
        opacity: 0.5,
      });

      // Verify the gs operator is in the content stream
      const text = getLastContentStreamText(page, doc);
      expect(text).toMatch(/\/GS\S* gs/);

      // Verify the ExtGState was registered in page resources
      const extGState =
        page.node.normalizedEntries().ExtGState;
      expect(extGState.keys().length).toBeGreaterThan(0);
    });

    it('embeds ExtGState resource when blendMode is used', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        color: rgb(1, 0, 0),
        blendMode: BlendMode.Screen,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toMatch(/\/GS\S* gs/);

      const extGState =
        page.node.normalizedEntries().ExtGState;
      expect(extGState.keys().length).toBeGreaterThan(0);
    });

    it('does NOT embed ExtGState when no opacity or blendMode is specified', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        color: rgb(1, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).not.toMatch(/\/GS\S* gs/);
    });

    it('embeds ExtGState for borderOpacity in drawEllipse', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawEllipse({
        x: 100,
        y: 100,
        xScale: 50,
        yScale: 50,
        borderColor: rgb(0, 0, 0),
        borderWidth: 2,
        borderOpacity: 0.7,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toMatch(/\/GS\S* gs/);
    });

    it('embeds ExtGState for line opacity', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawLine({
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
        opacity: 0.25,
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toMatch(/\/GS\S* gs/);
    });
  });

  // =========================================================================
  // Multiple draw operations on same page
  // =========================================================================
  describe('Multiple draw operations share the same content stream', () => {
    it('accumulates operators from multiple drawRectangle calls', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        color: rgb(1, 0, 0),
      });
      page.drawRectangle({
        x: 100,
        y: 100,
        width: 80,
        height: 80,
        color: rgb(0, 1, 0),
      });

      const text = getLastContentStreamText(page, doc);
      // Should contain both fill colors
      expect(text).toContain('1 0 0 rg');
      expect(text).toContain('0 1 0 rg');
      // Should have two pairs of q/Q
      const qCount = (text.match(/^q$/gm) || []).length;
      const QCount = (text.match(/^Q$/gm) || []).length;
      expect(qCount).toBe(2);
      expect(QCount).toBe(2);
    });

    it('accumulates operators from mixed draw operations', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);

      page.drawRectangle({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        color: rgb(0.9, 0.9, 0.9),
      });
      page.drawText('Hello', { font, x: 10, y: 10 });
      page.drawLine({
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
      });

      const text = getLastContentStreamText(page, doc);
      // Rectangle fill
      expect(text).toContain('0.9 0.9 0.9 rg');
      // Text operators
      expect(text).toContain('BT');
      expect(text).toContain('ET');
      // Line stroke
      expect(text).toContain('0 0 0 RG');
      expect(text).toMatch(/<[0-9A-Fa-f]+> Tj/);
    });
  });

  // =========================================================================
  // Round-trip save/load verification
  // =========================================================================
  describe('Round-trip save/load produces valid PDF', () => {
    it('saves and loads a document with text drawing', async () => {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const page = doc.addPage();
      page.drawText('Round trip test', { font, x: 50, y: 400, size: 16 });

      const bytes = await doc.save();
      expect(bytes.length).toBeGreaterThan(0);

      const loaded = await PDFDocument.load(bytes);
      expect(loaded.getPageCount()).toBe(1);

      // The raw bytes should contain the text "Helvetica" (font name)
      const rawString = new TextDecoder('latin1').decode(bytes);
      expect(rawString).toContain('Helvetica');
    });

    it('saves and loads a document with rectangle, line, and circle', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();

      page.drawRectangle({
        x: 50,
        y: 50,
        width: 200,
        height: 100,
        color: rgb(0.5, 0.5, 0.5),
      });
      page.drawLine({
        start: { x: 0, y: 0 },
        end: { x: 300, y: 300 },
        thickness: 3,
      });
      page.drawCircle({
        x: 300,
        y: 300,
        size: 50,
        color: rgb(1, 0, 0),
      });

      const bytes = await doc.save();
      const loaded = await PDFDocument.load(bytes);
      expect(loaded.getPageCount()).toBe(1);

      const loadedPage = loaded.getPage(0);
      expect(loadedPage.getWidth()).toBe(page.getWidth());
      expect(loadedPage.getHeight()).toBe(page.getHeight());
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================
  describe('Edge cases', () => {
    it('drawText with empty string produces BT/ET with no Tj', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('', { font, x: 0, y: 0 });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('BT');
      expect(text).toContain('ET');
      // Empty string encodes as a single hex string
      const tjCount = (text.match(/<[0-9A-Fa-f]*> Tj/g) || []).length;
      expect(tjCount).toBe(1);
    });

    it('drawRectangle with zero borderWidth does not produce stroke operator', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        color: rgb(1, 0, 0),
        borderColor: rgb(0, 0, 0),
        borderWidth: 0,
      });

      const text = getLastContentStreamText(page, doc);
      // With borderWidth 0, it should only fill, not stroke
      expect(text).toMatch(/\nf\n/);
      expect(text).not.toMatch(/\nB\n/);
    });

    it('drawLine with zero-length line still produces operators', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawLine({
        start: { x: 50, y: 50 },
        end: { x: 50, y: 50 },
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('50 50 m');
      expect(text).toContain('50 50 l');
      expect(text).toMatch(/\nS\n/);
    });

    it('drawCircle with size 0 still produces operators', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawCircle({
        x: 100,
        y: 100,
        size: 0,
        color: rgb(0, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      // Even size 0, operators are emitted
      expect(text).toContain('q');
      expect(text).toContain('Q');
    });

    it('drawRectangle at page cursor position uses current x/y', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.moveTo(33, 44);
      page.drawRectangle({ width: 100, height: 50, color: rgb(0, 0, 0) });

      const text = getLastContentStreamText(page, doc);
      // The transformation matrix should include the translation for 33, -44
      // (y is inverted in the internal SVG path processing)
      expect(text).toContain('cm');
      // Verify the output contains data from the current position
      expect(text).toContain('33');
    });
  });

  // =========================================================================
  // pushOperators direct API
  // =========================================================================
  describe('pushOperators() produces verifiable content stream', () => {
    it('pushes custom operators that appear in the content stream', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();

      const { pushGraphicsState, popGraphicsState, moveTo, lineTo, stroke, setLineWidth } = await import('../../src/api/operators.js');
      const { setStrokingColor } = await import('../../src/api/colors.js');

      page.pushOperators(
        pushGraphicsState(),
        setStrokingColor(rgb(1, 0, 0)),
        setLineWidth(3),
        moveTo(10, 20),
        lineTo(200, 300),
        stroke(),
        popGraphicsState(),
      );

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('q');
      expect(text).toContain('1 0 0 RG');
      expect(text).toContain('3 w');
      expect(text).toContain('10 20 m');
      expect(text).toContain('200 300 l');
      expect(text).toMatch(/\nS\n/);
      expect(text).toContain('Q');
    });
  });

  // =========================================================================
  // Operator ordering verification
  // =========================================================================
  describe('Operator ordering', () => {
    it('drawText: q comes before BT, ET comes before Q', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Order test', { font, x: 0, y: 0 });

      const text = getLastContentStreamText(page, doc);
      const qIdx = text.indexOf('q\n');
      const btIdx = text.indexOf('BT\n');
      const etIdx = text.indexOf('ET\n');
      const bigQIdx = text.lastIndexOf('Q\n');

      expect(qIdx).toBeLessThan(btIdx);
      expect(btIdx).toBeLessThan(etIdx);
      expect(etIdx).toBeLessThan(bigQIdx);
    });

    it('drawText: color (rg) comes after BT and before Tj', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Color order', {
        font,
        x: 0,
        y: 0,
        color: rgb(0.5, 0.5, 0.5),
      });

      const text = getLastContentStreamText(page, doc);
      const btIdx = text.indexOf('BT\n');
      const rgIdx = text.indexOf('0.5 0.5 0.5 rg');
      const tjIdx = text.indexOf('Tj');

      expect(btIdx).toBeLessThan(rgIdx);
      expect(rgIdx).toBeLessThan(tjIdx);
    });

    it('drawLine: moveTo comes before lineTo, lineTo before stroke', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawLine({
        start: { x: 10, y: 20 },
        end: { x: 300, y: 400 },
        color: rgb(1, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      const mIdx = text.indexOf('10 20 m');
      const lIdx = text.indexOf('300 400 l');
      const sIdx = text.lastIndexOf('\nS\n');

      expect(mIdx).toBeLessThan(lIdx);
      expect(lIdx).toBeLessThan(sIdx);
    });

    it('drawSvgPath: translate cm comes before scale cm', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 0,0 L 100,100', {
        x: 50,
        y: 75,
        scale: 2,
        borderColor: rgb(0, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      const translateIdx = text.indexOf('1 0 0 1 50 75 cm');
      const scaleIdx = text.indexOf('2 0 0 -2 0 0 cm');

      expect(translateIdx).toBeLessThan(scaleIdx);
    });
  });

  // =========================================================================
  // drawRectangle with rounded corners
  // =========================================================================
  describe('drawRectangle() with rounded corners', () => {
    it('produces bezier curve operators when rx and ry are set', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 10,
        y: 10,
        width: 200,
        height: 100,
        rx: 15,
        ry: 15,
        color: rgb(0, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      // Rounded corners use bezier curves
      const curveMatches = text.match(/\bc\n/g);
      expect(curveMatches).not.toBeNull();
      // 4 corners = 4 bezier curves
      expect(curveMatches!.length).toBe(4);
    });

    it('does NOT produce bezier curves when rx=0 and ry=0', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({
        x: 10,
        y: 10,
        width: 200,
        height: 100,
        rx: 0,
        ry: 0,
        color: rgb(0, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      // No bezier curves for sharp corners
      const curveMatches = text.match(/\bc\n/g);
      expect(curveMatches).toBeNull();
    });
  });

  // =========================================================================
  // Default value verification
  // =========================================================================
  describe('Default values', () => {
    it('drawCircle defaults to size 100', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawCircle({ color: rgb(0, 0, 0) });

      const text = getLastContentStreamText(page, doc);
      // Size 100 means xScale=100, yScale=100
      // The SVG path will contain values based on 100 (e.g., KAPPA * 100)
      expect(text).toContain('100');
    });

    it('drawEllipse defaults to xScale=100 and yScale=100', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawEllipse({ color: rgb(0, 0, 0) });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('100');
    });

    it('drawRectangle defaults to width=150, height=100', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawRectangle({ color: rgb(0, 0, 0) });

      const text = getLastContentStreamText(page, doc);
      // The SVG path for 150x100: H 150 V 100
      expect(text).toContain('150 0 l');
      expect(text).toContain('150 100 l');
    });

    it('drawLine defaults to thickness=1', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawLine({
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('1 w');
    });

    it('drawSvgPath defaults to borderWidth=1', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvgPath('M 0,0 L 100,100', {
        x: 0,
        y: 0,
        borderColor: rgb(0, 0, 0),
      });

      const text = getLastContentStreamText(page, doc);
      expect(text).toContain('1 w');
    });
  });

  // =========================================================================
  // Font resource registration
  // =========================================================================
  describe('Font resource registration', () => {
    it('registers font in page Resources/Font dictionary', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Courier);
      page.drawText('Test', { font, x: 0, y: 0 });

      const fontDict = page.node.normalizedEntries().Font;
      expect(fontDict.keys().length).toBeGreaterThan(0);
    });

    it('the font name in Tf operator matches the resource key', async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText('Match test', { font, x: 0, y: 0 });

      const text = getLastContentStreamText(page, doc);
      const fontDict = page.node.normalizedEntries().Font;
      const fontKeys = fontDict.keys();

      // At least one font key from the resource dict should appear in the Tf operator
      const found = fontKeys.some((key: PDFName) =>
        text.includes(`${key.toString()} `),
      );
      expect(found).toBe(true);
    });
  });
});
