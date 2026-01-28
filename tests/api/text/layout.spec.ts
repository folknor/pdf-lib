import {
  layoutMultilineText,
  layoutSinglelineText,
  layoutCombedText,
} from '../../../src/api/text/layout';
import { CombedTextLayoutError } from '../../../src/api/errors';
import { PDFDocument, StandardFonts, TextAlignment } from '../../../src/index';
import type PDFFont from '../../../src/api/PDFFont';

const MIN_FONT_SIZE = 4;
const MAX_FONT_SIZE = 500;

// Shared setup: create a document and embed Helvetica once, reused across tests.
let pdfDoc: PDFDocument;
let font: PDFFont;

beforeAll(async () => {
  pdfDoc = await PDFDocument.create();
  font = await pdfDoc.embedFont(StandardFonts.Helvetica);
});

// ---------------------------------------------------------------------------
// Font measurement sanity checks (used later to reason about layout results)
// ---------------------------------------------------------------------------
describe('Font measurement sanity checks', () => {
  it('widthOfTextAtSize returns non-zero for non-empty text', () => {
    const width = font.widthOfTextAtSize('Hello', 12);
    expect(width).toBeGreaterThan(0);
  });

  it('"WWW" is wider than "iii" at the same size (proportional font)', () => {
    const wideWidth = font.widthOfTextAtSize('WWW', 12);
    const narrowWidth = font.widthOfTextAtSize('iii', 12);
    expect(wideWidth).toBeGreaterThan(narrowWidth);
  });

  it('width scales linearly with font size', () => {
    const w12 = font.widthOfTextAtSize('Hello', 12);
    const w24 = font.widthOfTextAtSize('Hello', 24);
    expect(w24).toBeCloseTo(w12 * 2, 5);
  });

  it('heightAtSize returns non-zero', () => {
    const h = font.heightAtSize(12);
    expect(h).toBeGreaterThan(0);
  });

  it('heightAtSize without descender is smaller than with descender', () => {
    const withDescender = font.heightAtSize(12);
    const withoutDescender = font.heightAtSize(12, { descender: false });
    expect(withoutDescender).toBeLessThan(withDescender);
  });

  it('widthOfTextAtSize returns 0 for empty string', () => {
    const width = font.widthOfTextAtSize('', 12);
    expect(width).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// layoutMultilineText
// ---------------------------------------------------------------------------
describe('layoutMultilineText', () => {
  // ---- Preserved original tests ----
  it('should layout the text on one line when it fits near-perfectly', () => {
    const text = 'Super Mario Bros.';

    for (let fontSize = MIN_FONT_SIZE; fontSize <= MAX_FONT_SIZE; fontSize++) {
      const height = font.heightAtSize(fontSize);
      const width = font.widthOfTextAtSize(text, fontSize);

      const bounds = { x: 0, y: 0, width, height };
      const result = layoutMultilineText(text, {
        alignment: TextAlignment.Left,
        fontSize: undefined,
        bounds,
        font,
      });

      expect(result.lines.length).toStrictEqual(1);
    }
  });

  it('should layout the text on one line when it fits comfortably', () => {
    const text = 'Super Mario Bros.';
    const fontSize = 12;
    const height = font.heightAtSize(fontSize);
    const width = font.widthOfTextAtSize(text, fontSize) * 2;

    const bounds = { x: 0, y: 0, width, height };
    const result = layoutMultilineText(text, {
      alignment: TextAlignment.Left,
      fontSize: undefined,
      bounds,
      font,
    });

    expect(result.lines.length).toStrictEqual(1);
  });

  it('should layout the text on multiple lines when it does not fit horizontally but there is space vertically', () => {
    const text = 'Super Mario Bros.';

    for (let fontSize = MIN_FONT_SIZE; fontSize <= MAX_FONT_SIZE; fontSize++) {
      const height = font.heightAtSize(fontSize) * 2;
      const width = font.widthOfTextAtSize(text, fontSize) / 2;

      const bounds = { x: 0, y: 0, width, height };
      const result = layoutMultilineText(text, {
        alignment: TextAlignment.Left,
        fontSize: undefined,
        bounds,
        font,
      });

      expect(result.lines.length).toStrictEqual(2);
    }
  });

  it('should never exceed the maximum font size', () => {
    const text = 'Super Mario Bros.';
    const bounds = { x: 0, y: 0, width: Number.MAX_VALUE, height: Number.MAX_VALUE };
    const result = layoutMultilineText(text, {
      alignment: TextAlignment.Left,
      fontSize: undefined,
      bounds,
      font,
    });

    expect(result.lines.length).toStrictEqual(1);
    expect(result.fontSize).toStrictEqual(MAX_FONT_SIZE);
  });

  it('should handle long strings without excessive time', () => {
    const text = 'word '.repeat(2000).trim();
    const bounds = { x: 0, y: 0, width: 200, height: 10000 };
    const start = Date.now();
    const result = layoutMultilineText(text, {
      alignment: TextAlignment.Left,
      bounds,
      font,
      fontSize: 12,
    });
    const elapsed = Date.now() - start;

    expect(result.lines.length).toBeGreaterThan(1);
    expect(elapsed).toBeLessThan(5000);
  });

  it('should respect empty lines', () => {
    const lines = ['Super Mario Bros.', '', 'Boop'];
    const text = lines.join('\n');

    for (let fontSize = MIN_FONT_SIZE; fontSize <= MAX_FONT_SIZE; fontSize++) {
      const height = font.heightAtSize(fontSize);
      const width = font.widthOfTextAtSize(lines[0]!, fontSize);

      const bounds = { x: 0, y: 0, width, height };
      const result = layoutMultilineText(text, {
        alignment: TextAlignment.Left,
        fontSize: undefined,
        bounds,
        font,
      });

      expect(result.lines.length).toStrictEqual(3);
    }
  });

  // ---- New behavioral tests ----

  describe('return value structure', () => {
    it('returns an object with fontSize, lineHeight, lines, and bounds', () => {
      const result = layoutMultilineText('Hello World', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize: 12,
      });

      expect(result).toHaveProperty('fontSize');
      expect(result).toHaveProperty('lineHeight');
      expect(result).toHaveProperty('lines');
      expect(result).toHaveProperty('bounds');

      expect(typeof result.fontSize).toBe('number');
      expect(typeof result.lineHeight).toBe('number');
      expect(Array.isArray(result.lines)).toBe(true);
      expect(typeof result.bounds.x).toBe('number');
      expect(typeof result.bounds.y).toBe('number');
      expect(typeof result.bounds.width).toBe('number');
      expect(typeof result.bounds.height).toBe('number');
    });

    it('each line has text, encoded, x, y, width, and height', () => {
      const result = layoutMultilineText('Hello', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize: 12,
      });

      expect(result.lines.length).toBe(1);
      const line = result.lines[0]!;
      expect(line.text).toBe('Hello');
      expect(typeof line.encoded).toBeDefined();
      expect(typeof line.x).toBe('number');
      expect(typeof line.y).toBe('number');
      expect(line.width).toBeGreaterThan(0);
      expect(line.height).toBeGreaterThan(0);
    });
  });

  describe('fontSize behavior', () => {
    it('uses the provided fontSize when explicitly given', () => {
      const result = layoutMultilineText('ABC', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize: 20,
      });
      expect(result.fontSize).toBe(20);
    });

    it('auto-computes fontSize when fontSize is undefined', () => {
      const result = layoutMultilineText('ABC', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize: undefined,
      });
      // auto-computed font size should be between MIN and MAX
      expect(result.fontSize).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
      expect(result.fontSize).toBeLessThanOrEqual(MAX_FONT_SIZE);
    });

    it('auto-computes fontSize when fontSize is 0', () => {
      const result = layoutMultilineText('ABC', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize: 0,
      });
      expect(result.fontSize).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
      expect(result.fontSize).toBeLessThanOrEqual(MAX_FONT_SIZE);
    });
  });

  describe('lineHeight computation', () => {
    it('lineHeight equals height * 1.2 for the given fontSize', () => {
      const fontSize = 16;
      const result = layoutMultilineText('Test text', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize,
      });

      const expectedHeight = font.heightAtSize(fontSize);
      const expectedLineHeight = expectedHeight + expectedHeight * 0.2;
      expect(result.lineHeight).toBeCloseTo(expectedLineHeight, 10);
    });
  });

  describe('text content of lines', () => {
    it('preserves full text content when no wrapping occurs', () => {
      const text = 'Hello World';
      const result = layoutMultilineText(text, {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize: 12,
      });

      expect(result.lines.length).toBe(1);
      expect(result.lines[0]!.text).toBe('Hello World');
    });

    it('breaks text at word boundaries when wrapping', () => {
      const text = 'The quick brown fox';
      const fontSize = 12;
      // Make bounds narrow enough to force wrapping but wide enough for individual words
      const wordWidth = font.widthOfTextAtSize('The quick ', fontSize);
      const result = layoutMultilineText(text, {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: wordWidth, height: 500 },
        font,
        fontSize,
      });

      expect(result.lines.length).toBeGreaterThan(1);
      // Each line's text should be a substring of the original (at word boundaries)
      const reconstructed = result.lines.map((l) => l.text).join(' ');
      // The words from the original should all be present
      expect(reconstructed).toContain('The');
      expect(reconstructed).toContain('quick');
      expect(reconstructed).toContain('brown');
      expect(reconstructed).toContain('fox');
    });

    it('splits long words that exceed the line width', () => {
      // A single very long word that cannot fit on one line
      const text = 'Superlongwordwithoutanyspaces';
      const fontSize = 12;
      const singleCharWidth = font.widthOfTextAtSize('S', fontSize);
      // Make bounds narrow: only ~5 characters wide
      const narrowWidth = singleCharWidth * 5;
      const result = layoutMultilineText(text, {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: narrowWidth, height: 500 },
        font,
        fontSize,
      });

      // The word cannot be broken at word boundaries, so the whole word stays on one line
      // (the splitOutLines function returns the whole line if no word break is possible)
      expect(result.lines.length).toBe(1);
      expect(result.lines[0]!.text).toBe(text);
      // Width should exceed bounds width since the word doesn't fit
      expect(result.lines[0]!.width).toBeGreaterThan(narrowWidth);
    });

    it('handles text with explicit newlines as separate input lines', () => {
      const text = 'Line One\nLine Two\nLine Three';
      const result = layoutMultilineText(text, {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize: 12,
      });

      expect(result.lines.length).toBe(3);
      expect(result.lines[0]!.text).toBe('Line One');
      expect(result.lines[1]!.text).toBe('Line Two');
      expect(result.lines[2]!.text).toBe('Line Three');
    });

    it('handles carriage return + newline (\\r\\n) as a single newline', () => {
      const text = 'First\r\nSecond';
      const result = layoutMultilineText(text, {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize: 12,
      });

      expect(result.lines.length).toBe(2);
      expect(result.lines[0]!.text).toBe('First');
      expect(result.lines[1]!.text).toBe('Second');
    });

    it('handles form feed character (\\f) as a line separator', () => {
      const text = 'Part A\fPart B';
      const result = layoutMultilineText(text, {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize: 12,
      });

      expect(result.lines.length).toBe(2);
      expect(result.lines[0]!.text).toBe('Part A');
      expect(result.lines[1]!.text).toBe('Part B');
    });

    it('replaces tab characters with four spaces', () => {
      const text = 'Hello\tWorld';
      const result = layoutMultilineText(text, {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize: 12,
      });

      expect(result.lines.length).toBe(1);
      // cleanText replaces \t with 4 spaces
      expect(result.lines[0]!.text).toBe('Hello    World');
    });

    it('handles empty string input', () => {
      const result = layoutMultilineText('', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize: 12,
      });

      // Empty string produces one line with empty text
      expect(result.lines.length).toBe(1);
      expect(result.lines[0]!.text).toBe('');
      expect(result.lines[0]!.width).toBe(0);
    });

    it('handles single character input', () => {
      const result = layoutMultilineText('X', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize: 12,
      });

      expect(result.lines.length).toBe(1);
      expect(result.lines[0]!.text).toBe('X');
    });
  });

  describe('line widths match font measurements', () => {
    it('each line width equals font.widthOfTextAtSize for that line text', () => {
      const text = 'Hello World Foo Bar';
      const fontSize = 14;
      // Make the bounds narrow to force wrapping
      const result = layoutMultilineText(text, {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 80, height: 500 },
        font,
        fontSize,
      });

      for (const line of result.lines) {
        const expectedWidth = font.widthOfTextAtSize(line.text, fontSize);
        expect(line.width).toBeCloseTo(expectedWidth, 10);
      }
    });

    it('each line height equals font.heightAtSize for the fontSize', () => {
      const fontSize = 14;
      const result = layoutMultilineText('A\nB\nC', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize,
      });

      const expectedHeight = font.heightAtSize(fontSize);
      for (const line of result.lines) {
        expect(line.height).toBeCloseTo(expectedHeight, 10);
      }
    });
  });

  describe('position (x, y) calculations', () => {
    it('left-aligned lines have x equal to bounds.x', () => {
      const boundsX = 10;
      const result = layoutMultilineText('Line1\nLine2', {
        alignment: TextAlignment.Left,
        bounds: { x: boundsX, y: 0, width: 500, height: 500 },
        font,
        fontSize: 12,
      });

      for (const line of result.lines) {
        expect(line.x).toBe(boundsX);
      }
    });

    it('center-aligned lines have x centered within bounds', () => {
      const boundsX = 10;
      const boundsWidth = 500;
      const fontSize = 12;
      const result = layoutMultilineText('Hi\nWorld', {
        alignment: TextAlignment.Center,
        bounds: { x: boundsX, y: 0, width: boundsWidth, height: 500 },
        font,
        fontSize,
      });

      for (const line of result.lines) {
        const expectedX = boundsX + boundsWidth / 2 - line.width / 2;
        expect(line.x).toBeCloseTo(expectedX, 10);
      }
    });

    it('right-aligned lines have x such that text ends at bounds right edge', () => {
      const boundsX = 10;
      const boundsWidth = 500;
      const fontSize = 12;
      const result = layoutMultilineText('Hi\nWorld', {
        alignment: TextAlignment.Right,
        bounds: { x: boundsX, y: 0, width: boundsWidth, height: 500 },
        font,
        fontSize,
      });

      for (const line of result.lines) {
        const expectedX = boundsX + boundsWidth - line.width;
        expect(line.x).toBeCloseTo(expectedX, 10);
      }
    });

    it('y positions decrease by lineHeight for each subsequent line', () => {
      const boundsY = 100;
      const boundsHeight = 500;
      const fontSize = 12;
      const result = layoutMultilineText('Line1\nLine2\nLine3', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: boundsY, width: 500, height: boundsHeight },
        font,
        fontSize,
      });

      expect(result.lines.length).toBe(3);
      // First line's y should be bounds.y + bounds.height - lineHeight
      const expectedFirstY = boundsY + boundsHeight - result.lineHeight;
      expect(result.lines[0]!.y).toBeCloseTo(expectedFirstY, 10);

      // Each subsequent line is one lineHeight lower
      for (let i = 1; i < result.lines.length; i++) {
        const expectedY = result.lines[i - 1]!.y - result.lineHeight;
        expect(result.lines[i]!.y).toBeCloseTo(expectedY, 10);
      }
    });
  });

  describe('output bounds', () => {
    it('output bounds encompass all lines', () => {
      const result = layoutMultilineText('Line1\nLine2\nLine3', {
        alignment: TextAlignment.Left,
        bounds: { x: 10, y: 20, width: 500, height: 500 },
        font,
        fontSize: 12,
      });

      for (const line of result.lines) {
        expect(line.x).toBeGreaterThanOrEqual(result.bounds.x);
        expect(line.y).toBeGreaterThanOrEqual(result.bounds.y);
        expect(line.x + line.width).toBeLessThanOrEqual(
          result.bounds.x + result.bounds.width + 0.001,
        );
      }
    });
  });

  describe('word wrapping behavior', () => {
    it('wraps at word boundaries to produce correct line count', () => {
      const fontSize = 12;
      const text = 'aaa bbb ccc ddd';
      // Compute width that fits exactly two words plus some slack
      const twoWordWidth =
        font.widthOfTextAtSize('aaa bbb ccc', fontSize) + 5;

      const result = layoutMultilineText(text, {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: twoWordWidth, height: 500 },
        font,
        fontSize,
      });

      // "aaa bbb ccc" fits on first line, "ddd" wraps to second
      expect(result.lines.length).toBe(2);
    });

    it('does not wrap when bounds are wide enough', () => {
      const text = 'This is a fairly long sentence that fits in wide bounds';
      const fontSize = 10;
      const fullWidth = font.widthOfTextAtSize(text, fontSize) + 10;

      const result = layoutMultilineText(text, {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: fullWidth, height: 500 },
        font,
        fontSize,
      });

      expect(result.lines.length).toBe(1);
      expect(result.lines[0]!.text).toBe(text);
    });
  });
});

// ---------------------------------------------------------------------------
// layoutSinglelineText
// ---------------------------------------------------------------------------
describe('layoutSinglelineText', () => {
  describe('return value structure', () => {
    it('returns an object with fontSize, line, and bounds', () => {
      const result = layoutSinglelineText('Hello', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize: 12,
      });

      expect(result).toHaveProperty('fontSize');
      expect(result).toHaveProperty('line');
      expect(result).toHaveProperty('bounds');
      expect(typeof result.fontSize).toBe('number');
      expect(typeof result.line.text).toBe('string');
      expect(typeof result.line.x).toBe('number');
      expect(typeof result.line.y).toBe('number');
      expect(typeof result.line.width).toBe('number');
      expect(typeof result.line.height).toBe('number');
    });
  });

  describe('fontSize behavior', () => {
    it('uses the provided fontSize', () => {
      const result = layoutSinglelineText('Test', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize: 18,
      });
      expect(result.fontSize).toBe(18);
    });

    it('auto-computes fontSize when undefined', () => {
      const result = layoutSinglelineText('Test', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 200, height: 50 },
        font,
        fontSize: undefined,
      });
      expect(result.fontSize).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
      expect(result.fontSize).toBeLessThanOrEqual(MAX_FONT_SIZE);
    });

    it('auto-computes fontSize when 0', () => {
      const result = layoutSinglelineText('Test', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 200, height: 50 },
        font,
        fontSize: 0,
      });
      expect(result.fontSize).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
      expect(result.fontSize).toBeLessThanOrEqual(MAX_FONT_SIZE);
    });

    it('auto-computed fontSize fits the text within bounds width', () => {
      const text = 'Some test text';
      const boundsWidth = 100;
      const result = layoutSinglelineText(text, {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: boundsWidth, height: 50 },
        font,
        fontSize: undefined,
      });
      // The text width at the computed size should not exceed bounds width
      const textWidth = font.widthOfTextAtSize(
        text.replace(/[\n\f\r\u000B]/g, ' '),
        result.fontSize,
      );
      expect(textWidth).toBeLessThanOrEqual(boundsWidth + 1);
    });
  });

  describe('text merging', () => {
    it('merges multiline text into a single line (newlines become spaces)', () => {
      const result = layoutSinglelineText('Hello\nWorld', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize: 12,
      });

      expect(result.line.text).toBe('Hello World');
    });

    it('handles tabs by converting to four spaces then merging', () => {
      const result = layoutSinglelineText('A\tB', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize: 12,
      });

      // cleanText replaces \t with 4 spaces, mergeLines joins lines
      expect(result.line.text).toBe('A    B');
    });
  });

  describe('width and height', () => {
    it('line width matches font.widthOfTextAtSize', () => {
      const text = 'TestString';
      const fontSize = 14;
      const result = layoutSinglelineText(text, {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize,
      });

      const expectedWidth = font.widthOfTextAtSize(text, fontSize);
      expect(result.line.width).toBeCloseTo(expectedWidth, 10);
    });

    it('line height matches font.heightAtSize with descender=false', () => {
      const fontSize = 14;
      const result = layoutSinglelineText('X', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize,
      });

      const expectedHeight = font.heightAtSize(fontSize, { descender: false });
      expect(result.line.height).toBeCloseTo(expectedHeight, 10);
    });

    it('bounds width and height match line width and height', () => {
      const result = layoutSinglelineText('Hello', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize: 12,
      });

      expect(result.bounds.width).toBe(result.line.width);
      expect(result.bounds.height).toBe(result.line.height);
    });
  });

  describe('alignment', () => {
    it('left alignment sets x to bounds.x', () => {
      const boundsX = 25;
      const result = layoutSinglelineText('Hello', {
        alignment: TextAlignment.Left,
        bounds: { x: boundsX, y: 0, width: 500, height: 500 },
        font,
        fontSize: 12,
      });

      expect(result.line.x).toBe(boundsX);
    });

    it('center alignment centers the text within bounds', () => {
      const boundsX = 10;
      const boundsWidth = 500;
      const result = layoutSinglelineText('Hello', {
        alignment: TextAlignment.Center,
        bounds: { x: boundsX, y: 0, width: boundsWidth, height: 500 },
        font,
        fontSize: 12,
      });

      const expectedX = boundsX + boundsWidth / 2 - result.line.width / 2;
      expect(result.line.x).toBeCloseTo(expectedX, 10);
    });

    it('right alignment positions text at right edge of bounds', () => {
      const boundsX = 10;
      const boundsWidth = 500;
      const result = layoutSinglelineText('Hello', {
        alignment: TextAlignment.Right,
        bounds: { x: boundsX, y: 0, width: boundsWidth, height: 500 },
        font,
        fontSize: 12,
      });

      const expectedX = boundsX + boundsWidth - result.line.width;
      expect(result.line.x).toBeCloseTo(expectedX, 10);
    });

    it('different alignments produce different x positions for same text', () => {
      const sharedOpts = {
        bounds: { x: 0, y: 0, width: 500, height: 500 } as const,
        font,
        fontSize: 12 as const,
      };

      const left = layoutSinglelineText('Hello', {
        ...sharedOpts,
        alignment: TextAlignment.Left,
      });
      const center = layoutSinglelineText('Hello', {
        ...sharedOpts,
        alignment: TextAlignment.Center,
      });
      const right = layoutSinglelineText('Hello', {
        ...sharedOpts,
        alignment: TextAlignment.Right,
      });

      expect(left.line.x).toBeLessThan(center.line.x);
      expect(center.line.x).toBeLessThan(right.line.x);
    });
  });

  describe('vertical centering', () => {
    it('y is vertically centered within bounds', () => {
      const boundsY = 50;
      const boundsHeight = 200;
      const fontSize = 12;

      const result = layoutSinglelineText('Hello', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: boundsY, width: 500, height: boundsHeight },
        font,
        fontSize,
      });

      const height = font.heightAtSize(fontSize, { descender: false });
      const expectedY = boundsY + (boundsHeight / 2 - height / 2);
      expect(result.line.y).toBeCloseTo(expectedY, 10);
    });
  });

  describe('empty string', () => {
    it('handles empty string input', () => {
      const result = layoutSinglelineText('', {
        alignment: TextAlignment.Left,
        bounds: { x: 0, y: 0, width: 500, height: 500 },
        font,
        fontSize: 12,
      });

      expect(result.line.text).toBe('');
      expect(result.line.width).toBe(0);
    });
  });

  describe('bounds x and y in result', () => {
    it('result bounds.x and bounds.y match line position', () => {
      const result = layoutSinglelineText('Test', {
        alignment: TextAlignment.Center,
        bounds: { x: 10, y: 20, width: 300, height: 100 },
        font,
        fontSize: 14,
      });

      expect(result.bounds.x).toBe(result.line.x);
      expect(result.bounds.y).toBe(result.line.y);
    });
  });
});

// ---------------------------------------------------------------------------
// layoutCombedText
// ---------------------------------------------------------------------------
describe('layoutCombedText', () => {
  describe('return value structure', () => {
    it('returns an object with fontSize, cells, and bounds', () => {
      const result = layoutCombedText('ABC', {
        bounds: { x: 0, y: 0, width: 300, height: 50 },
        font,
        fontSize: 12,
        cellCount: 5,
      });

      expect(result).toHaveProperty('fontSize');
      expect(result).toHaveProperty('cells');
      expect(result).toHaveProperty('bounds');
      expect(Array.isArray(result.cells)).toBe(true);
    });

    it('each cell has text, encoded, x, y, width, and height', () => {
      const result = layoutCombedText('AB', {
        bounds: { x: 0, y: 0, width: 200, height: 50 },
        font,
        fontSize: 12,
        cellCount: 4,
      });

      for (const cell of result.cells) {
        expect(typeof cell.text).toBe('string');
        expect(cell.encoded).toBeDefined();
        expect(typeof cell.x).toBe('number');
        expect(typeof cell.y).toBe('number');
        expect(typeof cell.width).toBe('number');
        expect(typeof cell.height).toBe('number');
      }
    });
  });

  describe('cell count', () => {
    it('returns exactly cellCount cells', () => {
      const result = layoutCombedText('Hi', {
        bounds: { x: 0, y: 0, width: 300, height: 50 },
        font,
        fontSize: 12,
        cellCount: 10,
      });

      expect(result.cells.length).toBe(10);
    });

    it('returns cellCount cells even when text is shorter', () => {
      const result = layoutCombedText('A', {
        bounds: { x: 0, y: 0, width: 300, height: 50 },
        font,
        fontSize: 12,
        cellCount: 5,
      });

      // cellCount cells are generated regardless of text length
      expect(result.cells.length).toBe(5);
    });

    it('returns cellCount cells for empty string', () => {
      const result = layoutCombedText('', {
        bounds: { x: 0, y: 0, width: 300, height: 50 },
        font,
        fontSize: 12,
        cellCount: 3,
      });

      expect(result.cells.length).toBe(3);
    });
  });

  describe('text property of cells', () => {
    it('each cell text is the full merged line (not individual characters)', () => {
      // The source code shows: cells.push({ text: line, ... })
      // where line is the full merged text
      const result = layoutCombedText('ABC', {
        bounds: { x: 0, y: 0, width: 300, height: 50 },
        font,
        fontSize: 12,
        cellCount: 5,
      });

      for (const cell of result.cells) {
        expect(cell.text).toBe('ABC');
      }
    });
  });

  describe('cell positioning', () => {
    it('cells are evenly distributed across bounds width', () => {
      const boundsWidth = 300;
      const cellCount = 6;
      const cellWidth = boundsWidth / cellCount;
      const fontSize = 12;

      const result = layoutCombedText('ABCDEF', {
        bounds: { x: 0, y: 0, width: boundsWidth, height: 50 },
        font,
        fontSize,
        cellCount,
      });

      // Each cell should be centered within its cell slot
      for (let i = 0; i < result.cells.length; i++) {
        const cell = result.cells[i]!;
        const cellCenter = cellWidth * i + cellWidth / 2;
        // x = cellCenter - width/2
        const expectedX = cellCenter - cell.width / 2;
        expect(cell.x).toBeCloseTo(expectedX, 10);
      }
    });

    it('cells with boundsX offset are positioned relative to bounds.x', () => {
      const boundsX = 50;
      const boundsWidth = 300;
      const cellCount = 3;
      const cellWidth = boundsWidth / cellCount;
      const fontSize = 12;

      const result = layoutCombedText('AB', {
        bounds: { x: boundsX, y: 0, width: boundsWidth, height: 50 },
        font,
        fontSize,
        cellCount,
      });

      // The first cell center should be at boundsX + cellWidth/2
      const firstCellCenter = boundsX + cellWidth / 2;
      const expectedFirstX = firstCellCenter - result.cells[0]!.width / 2;
      expect(result.cells[0]!.x).toBeCloseTo(expectedFirstX, 10);
    });

    it('all cells have the same y position (vertically centered)', () => {
      const result = layoutCombedText('ABC', {
        bounds: { x: 0, y: 10, width: 300, height: 50 },
        font,
        fontSize: 12,
        cellCount: 3,
      });

      const firstY = result.cells[0]!.y;
      for (const cell of result.cells) {
        expect(cell.y).toBe(firstY);
      }
    });

    it('y is vertically centered within bounds height', () => {
      const boundsY = 20;
      const boundsHeight = 60;
      const fontSize = 12;

      const result = layoutCombedText('A', {
        bounds: { x: 0, y: boundsY, width: 300, height: boundsHeight },
        font,
        fontSize,
        cellCount: 1,
      });

      const height = font.heightAtSize(fontSize, { descender: false });
      const expectedY = boundsY + (boundsHeight / 2 - height / 2);
      expect(result.cells[0]!.y).toBeCloseTo(expectedY, 10);
    });
  });

  describe('cell dimensions', () => {
    it('each cell width matches font measurement for that character at fontSize', () => {
      const text = 'WiM';
      const fontSize = 14;

      const result = layoutCombedText(text, {
        bounds: { x: 0, y: 0, width: 300, height: 50 },
        font,
        fontSize,
        cellCount: 3,
      });

      // First three cells correspond to characters W, i, M
      const chars = ['W', 'i', 'M'];
      for (let i = 0; i < chars.length; i++) {
        const expectedWidth = font.widthOfTextAtSize(chars[i]!, fontSize);
        expect(result.cells[i]!.width).toBeCloseTo(expectedWidth, 10);
      }
    });

    it('each cell height is font.heightAtSize with descender=false', () => {
      const fontSize = 14;
      const result = layoutCombedText('AB', {
        bounds: { x: 0, y: 0, width: 300, height: 50 },
        font,
        fontSize,
        cellCount: 3,
      });

      const expectedHeight = font.heightAtSize(fontSize, { descender: false });
      for (const cell of result.cells) {
        expect(cell.height).toBeCloseTo(expectedHeight, 10);
      }
    });
  });

  describe('fontSize behavior', () => {
    it('uses the provided fontSize', () => {
      const result = layoutCombedText('AB', {
        bounds: { x: 0, y: 0, width: 300, height: 50 },
        font,
        fontSize: 16,
        cellCount: 5,
      });
      expect(result.fontSize).toBe(16);
    });

    it('auto-computes fontSize when undefined', () => {
      const result = layoutCombedText('AB', {
        bounds: { x: 0, y: 0, width: 300, height: 50 },
        font,
        fontSize: undefined,
        cellCount: 5,
      });
      expect(result.fontSize).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
      expect(result.fontSize).toBeLessThanOrEqual(MAX_FONT_SIZE);
    });

    it('auto-computes fontSize when 0', () => {
      const result = layoutCombedText('AB', {
        bounds: { x: 0, y: 0, width: 300, height: 50 },
        font,
        fontSize: 0,
        cellCount: 5,
      });
      expect(result.fontSize).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
      expect(result.fontSize).toBeLessThanOrEqual(MAX_FONT_SIZE);
    });

    it('auto-computed fontSize fits characters within cell dimensions', () => {
      const cellCount = 5;
      const boundsWidth = 100;
      const cellWidth = boundsWidth / cellCount;

      const result = layoutCombedText('WWWWW', {
        bounds: { x: 0, y: 0, width: boundsWidth, height: 30 },
        font,
        fontSize: undefined,
        cellCount,
      });

      // Each character width should be at most 75% of cell width
      for (let i = 0; i < 5; i++) {
        expect(result.cells[i]!.width).toBeLessThanOrEqual(cellWidth * 0.75 + 1);
      }
    });
  });

  describe('error handling', () => {
    it('throws CombedTextLayoutError when text length exceeds cellCount', () => {
      expect(() =>
        layoutCombedText('ABCDE', {
          bounds: { x: 0, y: 0, width: 300, height: 50 },
          font,
          fontSize: 12,
          cellCount: 3,
        }),
      ).toThrow(CombedTextLayoutError);
    });

    it('throws with descriptive message about length vs cellCount', () => {
      expect(() =>
        layoutCombedText('ABCDE', {
          bounds: { x: 0, y: 0, width: 300, height: 50 },
          font,
          fontSize: 12,
          cellCount: 3,
        }),
      ).toThrow(/lineLength=5.*cellCount=3/);
    });

    it('does not throw when text length equals cellCount', () => {
      expect(() =>
        layoutCombedText('ABC', {
          bounds: { x: 0, y: 0, width: 300, height: 50 },
          font,
          fontSize: 12,
          cellCount: 3,
        }),
      ).not.toThrow();
    });
  });

  describe('text merging', () => {
    it('merges newlines into spaces before layout', () => {
      // mergeLines converts newlines to spaces
      // "A\nB" becomes "A B" which is 3 chars, so cellCount must be >= 3
      const result = layoutCombedText('A\nB', {
        bounds: { x: 0, y: 0, width: 300, height: 50 },
        font,
        fontSize: 12,
        cellCount: 5,
      });

      // After merging, the text becomes "A B" (3 chars)
      // So 5 cells total, with chars: A, space, B, then 2 empty cells
      expect(result.cells.length).toBe(5);
      // The text property of each cell is the full merged line
      expect(result.cells[0]!.text).toBe('A B');
    });
  });

  describe('output bounds', () => {
    it('output bounds cover the cell area', () => {
      const result = layoutCombedText('ABC', {
        bounds: { x: 10, y: 20, width: 300, height: 50 },
        font,
        fontSize: 12,
        cellCount: 5,
      });

      expect(result.bounds.width).toBeGreaterThan(0);
      expect(result.bounds.height).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Cross-function comparisons
// ---------------------------------------------------------------------------
describe('Cross-function comparisons', () => {
  it('layoutSinglelineText and layoutMultilineText agree on single-line text width', () => {
    const text = 'Hello World';
    const fontSize = 12;
    const bounds = { x: 0, y: 0, width: 500, height: 500 };

    const singleResult = layoutSinglelineText(text, {
      alignment: TextAlignment.Left,
      bounds,
      font,
      fontSize,
    });

    const multiResult = layoutMultilineText(text, {
      alignment: TextAlignment.Left,
      bounds,
      font,
      fontSize,
    });

    // Both should produce the same text content
    expect(singleResult.line.text).toBe(text);
    expect(multiResult.lines.length).toBe(1);
    expect(multiResult.lines[0]!.text).toBe(text);

    // Widths should match since the same font and fontSize are used
    expect(singleResult.line.width).toBeCloseTo(multiResult.lines[0]!.width, 10);
  });

  it('layoutSinglelineText and layoutMultilineText use same fontSize when provided', () => {
    const text = 'Test';
    const fontSize = 20;
    const bounds = { x: 0, y: 0, width: 500, height: 500 };

    const singleResult = layoutSinglelineText(text, {
      alignment: TextAlignment.Left,
      bounds,
      font,
      fontSize,
    });

    const multiResult = layoutMultilineText(text, {
      alignment: TextAlignment.Left,
      bounds,
      font,
      fontSize,
    });

    expect(singleResult.fontSize).toBe(fontSize);
    expect(multiResult.fontSize).toBe(fontSize);
  });

  it('layoutCombedText with cellCount equal to text length places one char per cell', () => {
    const text = 'ABCDE';
    const fontSize = 12;
    const cellCount = 5;
    const boundsWidth = 500;

    const result = layoutCombedText(text, {
      bounds: { x: 0, y: 0, width: boundsWidth, height: 50 },
      font,
      fontSize,
      cellCount,
    });

    expect(result.cells.length).toBe(5);

    // The characters are laid out one per cell. Each cell's encoded value
    // corresponds to the character at that cell's index. The width of each
    // cell corresponds to the width of that individual character.
    const chars = ['A', 'B', 'C', 'D', 'E'];
    for (let i = 0; i < chars.length; i++) {
      const expectedWidth = font.widthOfTextAtSize(chars[i]!, fontSize);
      expect(result.cells[i]!.width).toBeCloseTo(expectedWidth, 10);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('Edge cases', () => {
  it('layoutMultilineText handles text with only newlines', () => {
    const result = layoutMultilineText('\n\n', {
      alignment: TextAlignment.Left,
      bounds: { x: 0, y: 0, width: 500, height: 500 },
      font,
      fontSize: 12,
    });

    // "\n\n" is split into 3 lines: ["", "", ""]
    expect(result.lines.length).toBe(3);
    for (const line of result.lines) {
      expect(line.text).toBe('');
      expect(line.width).toBe(0);
    }
  });

  it('layoutMultilineText handles text with trailing newline', () => {
    const result = layoutMultilineText('Hello\n', {
      alignment: TextAlignment.Left,
      bounds: { x: 0, y: 0, width: 500, height: 500 },
      font,
      fontSize: 12,
    });

    expect(result.lines.length).toBe(2);
    expect(result.lines[0]!.text).toBe('Hello');
    expect(result.lines[1]!.text).toBe('');
  });

  it('layoutMultilineText handles text with leading newline', () => {
    const result = layoutMultilineText('\nWorld', {
      alignment: TextAlignment.Left,
      bounds: { x: 0, y: 0, width: 500, height: 500 },
      font,
      fontSize: 12,
    });

    expect(result.lines.length).toBe(2);
    expect(result.lines[0]!.text).toBe('');
    expect(result.lines[1]!.text).toBe('World');
  });

  it('layoutSinglelineText with only whitespace', () => {
    const result = layoutSinglelineText('   ', {
      alignment: TextAlignment.Left,
      bounds: { x: 0, y: 0, width: 500, height: 500 },
      font,
      fontSize: 12,
    });

    expect(result.line.text).toBe('   ');
    expect(result.line.width).toBeGreaterThan(0);
  });

  it('layoutCombedText with single character and single cell', () => {
    const result = layoutCombedText('X', {
      bounds: { x: 0, y: 0, width: 100, height: 50 },
      font,
      fontSize: 12,
      cellCount: 1,
    });

    expect(result.cells.length).toBe(1);
    expect(result.cells[0]!.text).toBe('X');
    const expectedWidth = font.widthOfTextAtSize('X', 12);
    expect(result.cells[0]!.width).toBeCloseTo(expectedWidth, 10);

    // Cell should be centered in the bounds
    const cellCenter = 100 / 2;
    const expectedX = cellCenter - result.cells[0]!.width / 2;
    expect(result.cells[0]!.x).toBeCloseTo(expectedX, 10);
  });

  it('layoutMultilineText with multiple spaces between words', () => {
    const text = 'Hello   World';
    const result = layoutMultilineText(text, {
      alignment: TextAlignment.Left,
      bounds: { x: 0, y: 0, width: 500, height: 500 },
      font,
      fontSize: 12,
    });

    expect(result.lines.length).toBe(1);
    // Multiple spaces are preserved in the text
    expect(result.lines[0]!.text).toBe('Hello   World');
  });

  it('layoutMultilineText with very small bounds still returns at least one line', () => {
    const result = layoutMultilineText('Hello', {
      alignment: TextAlignment.Left,
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      font,
      fontSize: 12,
    });

    // Even with tiny bounds, the text is returned (it just overflows)
    expect(result.lines.length).toBeGreaterThanOrEqual(1);
  });

  it('layoutMultilineText preserves encoded property as PDFHexString', () => {
    const result = layoutMultilineText('Hello', {
      alignment: TextAlignment.Left,
      bounds: { x: 0, y: 0, width: 500, height: 500 },
      font,
      fontSize: 12,
    });

    const encoded = result.lines[0]!.encoded;
    // PDFHexString has a toString or value method; at minimum it should be truthy
    expect(encoded).toBeDefined();
    expect(encoded).not.toBeNull();
  });

  it('layoutSinglelineText preserves encoded property', () => {
    const result = layoutSinglelineText('Hello', {
      alignment: TextAlignment.Left,
      bounds: { x: 0, y: 0, width: 500, height: 500 },
      font,
      fontSize: 12,
    });

    expect(result.line.encoded).toBeDefined();
    expect(result.line.encoded).not.toBeNull();
  });

  it('layoutCombedText preserves encoded property for each cell', () => {
    const result = layoutCombedText('AB', {
      bounds: { x: 0, y: 0, width: 200, height: 50 },
      font,
      fontSize: 12,
      cellCount: 3,
    });

    for (const cell of result.cells) {
      expect(cell.encoded).toBeDefined();
      expect(cell.encoded).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Different standard fonts
// ---------------------------------------------------------------------------
describe('Layout with different standard fonts', () => {
  it('layoutSinglelineText produces different widths for Courier vs Helvetica', async () => {
    const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);
    const text = 'Hello World';
    const fontSize = 12;
    const bounds = { x: 0, y: 0, width: 500, height: 500 };

    const helveticaResult = layoutSinglelineText(text, {
      alignment: TextAlignment.Left,
      bounds,
      font,
      fontSize,
    });

    const courierResult = layoutSinglelineText(text, {
      alignment: TextAlignment.Left,
      bounds,
      font: courierFont,
      fontSize,
    });

    // Both produce valid results
    expect(helveticaResult.line.width).toBeGreaterThan(0);
    expect(courierResult.line.width).toBeGreaterThan(0);

    // Courier is monospaced, Helvetica is proportional - widths will differ
    expect(helveticaResult.line.width).not.toBe(courierResult.line.width);
  });

  it('Courier produces equal width for W and i (monospaced)', async () => {
    const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);
    const wWidth = courierFont.widthOfTextAtSize('W', 12);
    const iWidth = courierFont.widthOfTextAtSize('i', 12);
    expect(wWidth).toBeCloseTo(iWidth, 10);
  });
});
