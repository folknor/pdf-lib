import {
  PDFDocument,
  PDFFont,
  PDFHexString,
  StandardFonts,
} from '../../src/index';

describe('PDFFont', () => {
  describe('embedding standard fonts', () => {
    it('can embed Helvetica and returns a PDFFont instance', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      expect(font).toBeInstanceOf(PDFFont);
    });

    it('can embed Courier and returns a PDFFont instance', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Courier);
      expect(font).toBeInstanceOf(PDFFont);
    });

    it('can embed TimesRoman and returns a PDFFont instance', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.TimesRoman);
      expect(font).toBeInstanceOf(PDFFont);
    });

    it('can embed HelveticaBold and returns a PDFFont instance', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.HelveticaBold);
      expect(font).toBeInstanceOf(PDFFont);
    });

    it('can embed CourierBoldOblique and returns a PDFFont instance', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.CourierBoldOblique);
      expect(font).toBeInstanceOf(PDFFont);
    });
  });

  describe('name property', () => {
    it('returns "Helvetica" for a Helvetica font', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      expect(font.name).toBe('Helvetica');
    });

    it('returns "Courier" for a Courier font', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Courier);
      expect(font.name).toBe('Courier');
    });

    it('returns "Times-Roman" for a TimesRoman font', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.TimesRoman);
      expect(font.name).toBe('Times-Roman');
    });

    it('returns "Helvetica-Bold" for a HelveticaBold font', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.HelveticaBold);
      expect(font.name).toBe('Helvetica-Bold');
    });
  });

  describe('widthOfTextAtSize()', () => {
    it('returns a number greater than 0 for non-empty text', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const width = font.widthOfTextAtSize('Hello World', 12);
      expect(width).toBeGreaterThan(0);
    });

    it('returns 0 for an empty string', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const width = font.widthOfTextAtSize('', 12);
      expect(width).toBe(0);
    });

    it('scales linearly with font size (size 24 = 2x size 12)', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const text = 'Test string';
      const widthAt12 = font.widthOfTextAtSize(text, 12);
      const widthAt24 = font.widthOfTextAtSize(text, 24);
      expect(widthAt24).toBeCloseTo(widthAt12 * 2, 5);
    });

    it('scales linearly with font size (size 36 = 3x size 12)', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const text = 'Scaling test';
      const widthAt12 = font.widthOfTextAtSize(text, 12);
      const widthAt36 = font.widthOfTextAtSize(text, 36);
      expect(widthAt36).toBeCloseTo(widthAt12 * 3, 5);
    });

    it('proportional font (Helvetica): "W" is wider than "i"', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const widthW = font.widthOfTextAtSize('W', 12);
      const widthI = font.widthOfTextAtSize('i', 12);
      expect(widthW).toBeGreaterThan(widthI);
    });

    it('monospaced font (Courier): all characters have the same width', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Courier);
      const widthW = font.widthOfTextAtSize('W', 12);
      const widthI = font.widthOfTextAtSize('i', 12);
      const widthM = font.widthOfTextAtSize('M', 12);
      const widthA = font.widthOfTextAtSize('a', 12);
      expect(widthW).toBeCloseTo(widthI, 5);
      expect(widthW).toBeCloseTo(widthM, 5);
      expect(widthW).toBeCloseTo(widthA, 5);
    });

    it('multi-character string is wider than a single character', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const singleWidth = font.widthOfTextAtSize('A', 12);
      const multiWidth = font.widthOfTextAtSize('ABC', 12);
      expect(multiWidth).toBeGreaterThan(singleWidth);
    });

    it('returns different widths for different text with proportional fonts', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const widthNarrow = font.widthOfTextAtSize('iiii', 12);
      const widthWide = font.widthOfTextAtSize('WWWW', 12);
      expect(widthWide).toBeGreaterThan(widthNarrow);
    });
  });

  describe('heightAtSize()', () => {
    it('returns a number greater than 0', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const height = font.heightAtSize(12);
      expect(height).toBeGreaterThan(0);
    });

    it('scales linearly with font size (2x)', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const heightAt12 = font.heightAtSize(12);
      const heightAt24 = font.heightAtSize(24);
      expect(heightAt24).toBeCloseTo(heightAt12 * 2, 5);
    });

    it('scales linearly with font size (3x)', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const heightAt10 = font.heightAtSize(10);
      const heightAt30 = font.heightAtSize(30);
      expect(heightAt30).toBeCloseTo(heightAt10 * 3, 5);
    });

    it('with descender=false returns smaller height than descender=true (default)', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const heightWithDescender = font.heightAtSize(12);
      const heightWithoutDescender = font.heightAtSize(12, {
        descender: false,
      });
      expect(heightWithoutDescender).toBeLessThan(heightWithDescender);
    });

    it('default options include descender (same as descender=true)', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const heightDefault = font.heightAtSize(12);
      const heightExplicitDescender = font.heightAtSize(12, {
        descender: true,
      });
      expect(heightDefault).toBe(heightExplicitDescender);
    });

    it('returns consistent results across different standard fonts', async () => {
      const doc = await PDFDocument.create();
      const helvetica = doc.embedStandardFont(StandardFonts.Helvetica);
      const courier = doc.embedStandardFont(StandardFonts.Courier);
      const times = doc.embedStandardFont(StandardFonts.TimesRoman);

      // All fonts should return a positive height at the same size
      expect(helvetica.heightAtSize(12)).toBeGreaterThan(0);
      expect(courier.heightAtSize(12)).toBeGreaterThan(0);
      expect(times.heightAtSize(12)).toBeGreaterThan(0);
    });
  });

  describe('sizeAtHeight()', () => {
    it('returns a positive font size for a given height', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const size = font.sizeAtHeight(20);
      expect(size).toBeGreaterThan(0);
    });

    it('round-trip: heightAtSize(sizeAtHeight(h)) approximately equals h', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const targetHeight = 24;
      const computedSize = font.sizeAtHeight(targetHeight);
      const recoveredHeight = font.heightAtSize(computedSize);
      expect(recoveredHeight).toBeCloseTo(targetHeight, 1);
    });

    it('round-trip works for small heights', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const targetHeight = 8;
      const computedSize = font.sizeAtHeight(targetHeight);
      const recoveredHeight = font.heightAtSize(computedSize);
      expect(recoveredHeight).toBeCloseTo(targetHeight, 1);
    });

    it('round-trip works for large heights', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const targetHeight = 100;
      const computedSize = font.sizeAtHeight(targetHeight);
      const recoveredHeight = font.heightAtSize(computedSize);
      expect(recoveredHeight).toBeCloseTo(targetHeight, 1);
    });

    it('larger height input produces larger font size', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const smallSize = font.sizeAtHeight(10);
      const largeSize = font.sizeAtHeight(50);
      expect(largeSize).toBeGreaterThan(smallSize);
    });
  });

  describe('getCharacterSet()', () => {
    it('returns an array of numbers (Unicode code points)', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const charSet = font.getCharacterSet();
      expect(Array.isArray(charSet)).toBe(true);
      expect(charSet.length).toBeGreaterThan(0);
      for (const codePoint of charSet) {
        expect(typeof codePoint).toBe('number');
      }
    });

    it('character set length is greater than 0', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const charSet = font.getCharacterSet();
      expect(charSet.length).toBeGreaterThan(0);
    });

    it('includes basic ASCII letter "A" (code point 65)', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const charSet = font.getCharacterSet();
      expect(charSet).toContain(65); // 'A'
    });

    it('includes basic ASCII digit "0" (code point 48)', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const charSet = font.getCharacterSet();
      expect(charSet).toContain(48); // '0'
    });

    it('includes space (code point 32)', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const charSet = font.getCharacterSet();
      expect(charSet).toContain(32); // ' '
    });

    it('includes common lowercase letters', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const charSet = font.getCharacterSet();
      expect(charSet).toContain(97); // 'a'
      expect(charSet).toContain(122); // 'z'
    });

    it('Courier also has a non-empty character set with ASCII', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Courier);
      const charSet = font.getCharacterSet();
      expect(charSet.length).toBeGreaterThan(0);
      expect(charSet).toContain(65); // 'A'
    });

    it('TimesRoman also has a non-empty character set with ASCII', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.TimesRoman);
      const charSet = font.getCharacterSet();
      expect(charSet.length).toBeGreaterThan(0);
      expect(charSet).toContain(65); // 'A'
    });
  });

  describe('encodeText()', () => {
    it('returns a PDFHexString for non-empty text', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const encoded = font.encodeText('Hello');
      expect(encoded).toBeInstanceOf(PDFHexString);
    });

    it('returns a non-empty hex string for non-empty text', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const encoded = font.encodeText('ABC');
      expect(encoded.asString().length).toBeGreaterThan(0);
    });

    it('returns a PDFHexString for a single character', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const encoded = font.encodeText('A');
      expect(encoded).toBeInstanceOf(PDFHexString);
      expect(encoded.asString().length).toBeGreaterThan(0);
    });

    it('encodes different text to different hex strings', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const encodedA = font.encodeText('A');
      const encodedB = font.encodeText('B');
      expect(encodedA.toString()).not.toBe(encodedB.toString());
    });

    it('returns consistent results for the same text', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      const encoded1 = font.encodeText('Test');
      const encoded2 = font.encodeText('Test');
      expect(encoded1.toString()).toBe(encoded2.toString());
    });
  });

  describe('embed()', () => {
    it('can be called without error', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      await expect(font.embed()).resolves.not.toThrowError();
    });

    it('font is usable after embedding', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      await font.embed();

      // Font should still function correctly after embed
      const width = font.widthOfTextAtSize('Hello', 12);
      expect(width).toBeGreaterThan(0);

      const height = font.heightAtSize(12);
      expect(height).toBeGreaterThan(0);

      const encoded = font.encodeText('Hello');
      expect(encoded).toBeInstanceOf(PDFHexString);
    });

    it('can be called multiple times without error', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      await expect(font.embed()).resolves.not.toThrowError();
      await expect(font.embed()).resolves.not.toThrowError();
    });

    it('second call is a no-op when font is not modified', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      await font.embed();
      // After embed, modified=false, so the second embed should be a no-op
      await expect(font.embed()).resolves.not.toThrowError();
    });

    it('re-embeds after encodeText marks font as modified', async () => {
      const doc = await PDFDocument.create();
      const font = doc.embedStandardFont(StandardFonts.Helvetica);
      await font.embed();
      // encodeText sets modified=true
      font.encodeText('New text');
      await expect(font.embed()).resolves.not.toThrowError();
    });
  });
});
