import fs from 'fs';
import fontkit from 'src/fontkit.js';
import { showEncodedText } from '../../src/api/operators';
import { drawLinesOfText, drawTextLines } from '../../src/api/operations';
import {
  EncodedText,
  PDFArray,
  PDFContentStream,
  PDFDocument,
  rgb,
  StandardFonts,
} from '../../src/index';

const show = (text: EncodedText, size = 10, rise = 0) =>
  showEncodedText(text, size, rise).map(String);

const glyphs = (
  rows: [code: string, advance: number, width: number, x?: number, y?: number][],
) =>
  new EncodedText(
    rows.map((r) => r[0]),
    rows.map((r) => r[1]),
    rows.map((r) => r[2]),
    rows.map((r) => r[3] ?? 0),
    rows.map((r) => r[4] ?? 0),
  );

describe('showEncodedText', () => {
  it('shows unpositioned text with one Tj', () => {
    expect(show(glyphs([['0001', 500, 500], ['0002', 600, 600]]))).toEqual([
      '<00010002> Tj',
    ]);
  });

  it('wraps ActualText spans around exactly their glyphs', () => {
    const text = new EncodedText(
      ['0001', '0002', '0003'],
      [500, 400, 600],
      [500, 500, 600],
      [0, 0, 0],
      [0, 0, 0],
      undefined,
      undefined,
      [{ start: 0, end: 2, text: 'é' }],
    );

    expect(show(text)).toEqual([
      '/Span <</ActualText <FEFF00E9>>> BDC',
      '[<00010002> 100] TJ',
      'EMC',
      '[<0003>] TJ',
    ]);
    expect(() =>
      new EncodedText(['0001'], [1], [1], [0], [0], undefined, undefined, [
        { start: 0, end: 2, text: 'x' },
      ]),
    ).toThrow();
  });

  it('shows empty text as an empty Tj', () => {
    expect(show(glyphs([]))).toEqual(['<> Tj']);
  });

  it('writes kerning as TJ adjustments, merging glyphs without one', () => {
    const text = glyphs([
      ['0001', 430, 500],
      ['0002', 600, 600],
      ['0003', 600, 600],
    ]);

    // 70 thousandths narrower after the first glyph: +70 in TJ.
    expect(show(text)).toEqual(['[<0001> 70 <00020003>] TJ']);
  });

  it('draws an offset mark at its place and keeps the pen at its advance', () => {
    // Base advances 600; a zero-advance mark (PDF width 200) drawn 300 to the
    // left of the pen; then a glyph.
    const text = glyphs([
      ['0001', 600, 600],
      ['0002', 0, 200, -300],
      ['0003', 500, 500],
    ]);

    // Before the mark: -(-300) = 300. After: 200 + (-300) - 0 = -100.
    expect(show(text)).toEqual(['[<0001> 300 <0002> -100 <0003>] TJ']);
  });

  it('raises a glyph with Ts around it, scaled by the font size, and restores the rise', () => {
    const text = glyphs([
      ['0001', 600, 600],
      ['0002', 0, 0, 0, 250],
      ['0003', 500, 500],
    ]);

    expect(show(text, 20, 3)).toEqual([
      '[<0001>] TJ',
      '8 Ts',
      '[<0002>] TJ',
      '3 Ts',
      '[<0003>] TJ',
    ]);
  });

  it('ends with the adjustment that sets the final pen position', () => {
    expect(show(glyphs([['0001', 450, 500]]))).toEqual(['[<0001> 50] TJ']);
  });
});

describe('drawing operations with positioned text', () => {
  const raised = glyphs([
    ['0001', 600, 600],
    ['0002', 0, 0, 0, 100],
  ]);

  it('drawLinesOfText sets rise 0 first when glyphs change it and no rise was given', () => {
    const ops = drawLinesOfText([raised], {
      color: rgb(0, 0, 0),
      font: 'F1',
      size: 10,
      lineHeight: 12,
      rotate: { type: 'degrees', angle: 0 } as any,
      xSkew: { type: 'degrees', angle: 0 } as any,
      ySkew: { type: 'degrees', angle: 0 } as any,
      x: 0,
      y: 0,
    }).map(String);

    const firstRise = ops.findIndex((op) => op.endsWith(' Ts'));
    expect(ops[firstRise]).toBe('0 Ts');
    expect(firstRise).toBeLessThan(ops.findIndex((op) => op.endsWith('TJ')));
    expect(ops).toContain('1 Ts');
  });

  it('drawTextLines (form appearances) sets rise 0 when glyphs change it', () => {
    const ops = drawTextLines([{ encoded: raised, x: 0, y: 0 }], {
      color: rgb(0, 0, 0),
      font: 'F1',
      size: 10,
      rotate: { type: 'degrees', angle: 0 } as any,
      xSkew: { type: 'degrees', angle: 0 } as any,
      ySkew: { type: 'degrees', angle: 0 } as any,
    }).map(String);

    expect(ops.filter((op) => op.endsWith(' Ts'))).toEqual([
      '0 Ts',
      '1 Ts',
      '0 Ts',
    ]);
  });
});

const contentLines = (page: ReturnType<PDFDocument['addPage']>) => {
  const contents = page.node.Contents();
  let text = '';

  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) {
      const stream = contents.lookup(i);

      if (stream instanceof PDFContentStream) {
        text += stream.getContentsString();
      }
    }
  }

  return text.split('\n');
};

describe('drawText with kerned fonts', () => {
  it('draws Helvetica AFM kerning that widthOfTextAtSize measures', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('AV', { font, size: 10 });
    const ops = contentLines(page);
    expect(ops).toContain('[<41> 70 <56>] TJ');
  });

  it('draws Ubuntu GPOS kerning', async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const page = doc.addPage();

    const font = await doc.embedFont(
      fs.readFileSync('./assets/fonts/ubuntu/Ubuntu-R.ttf'),
    );

    page.drawText('AVA', { font, size: 10 });
    const ops = contentLines(page);
    expect(ops.some((op) => /^\[<[0-9A-F]{4}> \d/.test(op))).toBe(true);
  });
});
