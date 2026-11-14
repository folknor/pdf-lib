import fs from 'fs';
import fontkit from 'src/fontkit.js';
import {
  BASE_SPACING,
  EncodedText,
  NO_SPACING,
  SPACE_SPACING,
  PDFArray,
  PDFContentStream,
  PDFDocument,
  StandardFonts,
} from '../../../src/index';

const kinds = { base: BASE_SPACING, space: SPACE_SPACING, none: NO_SPACING };

const text = (
  advances: number[],
  spacing: (keyof typeof kinds)[],
  attachedTo: (number | null)[],
  xOffsets = advances.map(() => 0),
) =>
  new EncodedText(
    advances.map((_, i) => i.toString(16).padStart(4, '0')),
    advances,
    advances.slice(),
    xOffsets,
    advances.map(() => 0),
    spacing.map((kind) => kinds[kind]),
    attachedTo,
  );

// Where each glyph is drawn, in thousandths of an em from the line start.
const origins = (t: EncodedText) => {
  let pen = 0;
  return t.advances.map((advance, i) => {
    const origin = pen + t.xOffsets[i]!;
    pen += advance;
    return origin;
  });
};

const contentText = (page: ReturnType<PDFDocument['addPage']>) => {
  const contents = page.node.Contents();
  let out = '';
  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) {
      const stream = contents.lookup(i);
      if (stream instanceof PDFContentStream) out += stream.getContentsString();
    }
  }
  return out;
};

describe('EncodedText.withSpacing', () => {
  it('adds character spacing to base glyphs and word spacing to spaces', () => {
    const t = text([500, 250, 500], ['base', 'space', 'base'], [null, null, null]);
    // At size 10, 1pt = 100 thousandths of an em.
    expect(t.withSpacing(1, 2, 10).advances).toEqual([600, 550, 600]);
  });

  it('gives marks no spacing and keeps attachment chains on their root', () => {
    // base, mark on base, mark on mark, next base.
    const t = text(
      [600, 0, 0, 600],
      ['base', 'none', 'none', 'base'],
      [null, 0, 1, null],
      [0, -200, -150, 0],
    );
    const before = origins(t);
    const spaced = t.withSpacing(1, 0, 10);
    const after = origins(spaced);
    expect(after[1]! - after[0]!).toBe(before[1]! - before[0]!);
    expect(after[2]! - after[0]!).toBe(before[2]! - before[0]!);
    expect(after[3]! - before[3]!).toBe(100);
  });

  it('keeps a mark drawn before its base (right-to-left order) on it', () => {
    const t = text(
      [0, 600, 600],
      ['none', 'base', 'base'],
      [1, null, null],
      [300, 0, 0],
    );
    const before = origins(t);
    const after = origins(t.withSpacing(2, 0, 10));
    expect(after[0]! - after[1]!).toBe(before[0]! - before[1]!);
  });

  it('refuses cyclic or out-of-range attachments', () => {
    expect(() => text([0, 0], ['none', 'none'], [1, 0])).toThrow();
    expect(() => text([0], ['none'], [3])).toThrow();
  });

  it('adds a cluster\'s spacing after its last glyph, counted per character', () => {
    const t = new EncodedText(
      ['0001', '0002', '0003'],
      [600, 300, 600],
      [600, 300, 600],
      [0, 0, 0],
      [0, 0, 0],
      [NO_SPACING, { characters: 3, spaces: 1 }, BASE_SPACING],
    );
    expect(t.withSpacing(1, 2, 10).advances).toEqual([600, 800, 700]);
    expect(() =>
      new EncodedText(['0001'], [1], [1], [0], [0], [{ characters: -1, spaces: 0 }]),
    ).toThrow();
  });

  it('refuses spacing at font size 0', () => {
    const t = text([500], ['base'], [null]);
    expect(() => t.withSpacing(1, 0, 0)).toThrow();
    expect(t.withSpacing(0, 0, 0)).toBe(t);
  });
});

describe('spacing in fonts', () => {
  it('measures what it draws, for standard and custom fonts', async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const fonts = [
      await doc.embedFont(StandardFonts.Helvetica),
      await doc.embedFont(fs.readFileSync('./assets/fonts/ubuntu/Ubuntu-R.ttf')),
    ];
    for (const font of fonts) {
      const spaced = font.encodeText('a b c').withSpacing(1, 3, 12);
      // Five glyphs take 1pt, the two spaces 3pt more.
      expect(font.widthOfTextAtSize('a b c', 12, {
        characterSpacing: 1,
        wordSpacing: 3,
      })).toBeCloseTo((spaced.advance * 12) / 1000, 9);
      expect(
        font.widthOfTextAtSize('a b c', 12, {
          characterSpacing: 1,
          wordSpacing: 3,
        }) - font.widthOfTextAtSize('a b c', 12),
      ).toBeCloseTo(11, 9);
      expect(
        font.widthOfTextAtSize('a b c', 12, { horizontalScaling: 50 }),
      ).toBeCloseTo(font.widthOfTextAtSize('a b c', 12) / 2, 9);
    }
  });

  it('records GPOS mark attachment and keeps marks on their bases', async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(
      fs.readFileSync('./assets/fonts/noto_sans_thai/NotoSansThai[wdth,wght].ttf'),
    );
    const t = font.encodeText('กิ่');
    expect(t.attachedTo.some((base) => base !== null)).toBe(true);
    const before = origins(t);
    const after = origins(t.withSpacing(5, 0, 10));
    // One cluster: its one character's spacing comes after its last glyph.
    expect(t.spacing.slice(0, -1).every((k) => k.characters === 0)).toBe(true);
    expect(t.spacing[t.spacing.length - 1]).toEqual({ characters: 1, spaces: 0 });
    t.attachedTo.forEach((base, i) => {
      if (base === null) return;
      let root = base;
      while (t.attachedTo[root] !== null) root = t.attachedTo[root]!;
      expect(after[i]! - after[root]!).toBeCloseTo(before[i]! - before[root]!, 9);
    });
  });

  it('drawText breaks lines with the spacing it draws and emits no Tc or Tw', async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const page = doc.addPage();
    const font = await doc.embedFont(
      fs.readFileSync('./assets/fonts/ubuntu/Ubuntu-R.ttf'),
    );
    const options = {
      characterSpacing: 2,
      wordSpacing: 6,
      horizontalScaling: 120,
    };
    const words = 'the quick brown fox jumps over the lazy dog again';
    page.drawText(words, { font, size: 12, maxWidth: 150, ...options });
    const content = contentText(page);
    expect(content).not.toMatch(/ T[cw]\n/);
    expect(content).toContain('120 Tz');
    // Re-break the same way and check every line fits.
    const lines = content.split('\n').filter((op) => op.endsWith('TJ'));
    expect(lines.length).toBeGreaterThan(1);
    const { breakTextIntoLines } = await import('../../../src/utils/index');
    const broken = breakTextIntoLines(words, [' '], 150, (s: string) =>
      font.widthOfTextAtSize(s, 12, options),
    );
    for (const line of broken) {
      expect(font.widthOfTextAtSize(line, 12, options)).toBeLessThanOrEqual(150);
    }
    expect(broken.length).toBe(lines.length);
  });
});
