import fs from 'node:fs';
import fontkit from '../../src/fontkit.js';
import { decomposeSaraAm } from '../../src/fontkit/layout/ThaiSaraAm.js';
import UnicodeLayoutEngine from '../../src/fontkit/layout/UnicodeLayoutEngine.js';

const all = () => true;

describe('SARA AM decomposition', () => {
  it('moves the nikhahit before preceding above-base marks', () => {
    // DO DEK, MAI CHATTAWA, SARA AM
    expect(decomposeSaraAm([0x0e14, 0x0e4b, 0x0e33], all)).toEqual([
      0x0e14, 0x0e4d, 0x0e4b, 0x0e32,
    ]);
    // MAI HAN-AKAT then SARA AM, no base
    expect(decomposeSaraAm([0x0e31, 0x0e33], all)).toEqual([0x0e4d, 0x0e31, 0x0e32]);
    // two words
    expect(decomposeSaraAm([0x0e19, 0x0e49, 0x0e33, 0x0e19, 0x0e49, 0x0e33], all)).toEqual([
      0x0e19, 0x0e4d, 0x0e49, 0x0e32, 0x0e19, 0x0e4d, 0x0e49, 0x0e32,
    ]);
  });

  it('handles Lao the same way', () => {
    expect(decomposeSaraAm([0x0eab, 0x0eb1, 0x0eb3], all)).toEqual([
      0x0eab, 0x0ecd, 0x0eb1, 0x0eb2,
    ]);
  });

  it('leaves a typed nikhahit, a variation sequence and unmapped components alone', () => {
    expect(decomposeSaraAm([0x0e14, 0x0e4b, 0x0e4d], all)).toEqual([0x0e14, 0x0e4b, 0x0e4d]);
    expect(decomposeSaraAm([0x0e19, 0x0e33, 0xfe00], all)).toEqual([0x0e19, 0x0e33, 0xfe00]);
    expect(decomposeSaraAm([0x0e19, 0x0e33], (cp) => cp !== 0x0e4d)).toEqual([0x0e19, 0x0e33]);
    // A joiner stops the backward scan.
    expect(decomposeSaraAm([0x0e19, 0x0e49, 0x200d, 0x0e33], all)).toEqual([
      0x0e19, 0x0e49, 0x200d, 0x0e4d, 0x0e32,
    ]);
  });

  // Noto Sans Thai decomposes SARA AM itself but keeps the nikhahit after the
  // tone; only in the reordered sequence does GSUB pick the small tone mark
  // that sits above the nikhahit, and that substitution reaches the PDF.
  it('lets Noto Sans Thai select its stacked tone mark', () => {
    const font: any = fontkit.create(
      fs.readFileSync('./assets/fonts/noto_sans_thai/NotoSansThai[wdth,wght].ttf'),
    );
    const names = (s: string) => font.layout(s).glyphs.map((g: any) => g.name);
    expect(names('น้ำ')).toEqual(['uni0E19', 'uni0E4D', 'uni0E49.small', 'uni0E32']);
    expect(names('ป้ำ')).toEqual([
      'uni0E1B',
      'uni0E4D.narrow',
      'uni0E49.small',
      'uni0E32',
    ]);
  });
});

describe('fallback mark classes', () => {
  it('places NIKHAHIT above right', () => {
    const engine = new UnicodeLayoutEngine(null);
    expect(engine.getCombiningClass(0x0e4d)).toBe('Above_Right');
  });
});
