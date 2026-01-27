import fontkit from '@pdf-lib/fontkit';
import { FontNames } from '@pdf-lib/standard-fonts';
import fs from 'fs';

import { CustomFontEmbedder, StandardFontEmbedder } from '../../src/core';
import { breakTextIntoLines } from '../../src/utils';
import { cleanText, lineSplit, parseDate } from '../../src/utils/strings';

const font = StandardFontEmbedder.for(FontNames.Helvetica);

const textSize = 24;

const computeTextWidth = (text: string) =>
  font.widthOfTextAtSize(text, textSize);

describe('breakTextIntoLines', () => {
  it('handles empty wordBreaks arrays', () => {
    const input = 'foobar-quxbaz';
    const expected = ['foobar-quxbaz'];
    const actual = breakTextIntoLines(input, [], 21, computeTextWidth);
    expect(actual).toEqual(expected);
  });

  it('handles trailing newlines', () => {
    const input = 'foo\n';
    const expected = ['foo'];
    const actual = breakTextIntoLines(input, [], 21, computeTextWidth);
    expect(actual).toEqual(expected);
  });

  it('handles trailing carriage returns', () => {
    const input = 'foo\r';
    const expected = ['foo'];
    const actual = breakTextIntoLines(input, [], 21, computeTextWidth);
    expect(actual).toEqual(expected);
  });

  it('preserves empty lines between consecutive newlines', () => {
    const input = 'foo\n\nbar';
    const expected = ['foo', '', 'bar'];
    const actual = breakTextIntoLines(input, [], 90000, computeTextWidth);
    expect(actual).toEqual(expected);
  });

  it('preserves multiple consecutive empty lines', () => {
    const input = 'foo\n\n\nbar';
    const expected = ['foo', '', '', 'bar'];
    const actual = breakTextIntoLines(input, [], 90000, computeTextWidth);
    expect(actual).toEqual(expected);
  });

  it('always breaks lines when EOLs are encountered', () => {
    const input = 'foo\nbar-qux\rbaz\n';
    const expected = ['foo', 'bar-qux', 'baz'];
    const actual = breakTextIntoLines(input, [], 90000, computeTextWidth);
    expect(actual).toEqual(expected);
  });

  it("breaks at the last possible 'wordBreak' before exceeding 'maxWidth' (1)", () => {
    const input =
      'Lorem Test ipsum dolor sit amet, consectetur adipiscing\nelit';
    const expected = [
      'Lorem T',
      'est ipsu',
      'm dolor s',
      'it amet, c',
      'onsectet',
      'ur adipis',
      'cing',
      'elit',
    ];
    const actual = breakTextIntoLines(
      input,
      ['', 'Test'],
      100,
      computeTextWidth,
    );
    expect(actual).toEqual(expected);
  });

  it("breaks at the last possible 'wordBreak' before exceeding 'maxWidth' (2)", () => {
    const input = 'Foo%bar%baz';
    const expected = ['Foo%', 'bar%baz'];
    const actual = breakTextIntoLines(input, ['%'], 100, computeTextWidth);
    expect(actual).toEqual(expected);
  });

  it('handles non-ascii code points and empty breaks', async () => {
    const sourceHansBytes = fs.readFileSync(
      'assets/fonts/source_hans_jp/SourceHanSerifJP-Regular.otf',
    );
    const sourceHansFont = await CustomFontEmbedder.for(
      fontkit,
      sourceHansBytes,
    );

    const input =
      '遅未亮惑職界転藤柔索名午納，問通桑転加料演載満経信回込町者訟窃。';
    const expected = [
      '遅未亮惑職',
      '界転藤柔索',
      '名午納，問',
      '通桑転加料',
      '演載満経信',
      '回込町者訟',
      '窃。',
    ];
    const actual = breakTextIntoLines(input, [''], 125, (text: string) =>
      sourceHansFont.widthOfTextAtSize(text, 24),
    );
    expect(actual).toEqual(expected);
  });
});

describe('cleanText', () => {
  it('normalizes \\r\\n to \\n', () => {
    expect(cleanText('Line 1\r\nLine 2')).toBe('Line 1\nLine 2');
  });

  it('normalizes multiple \\r\\n sequences', () => {
    expect(cleanText('A\r\nB\r\nC')).toBe('A\nB\nC');
  });

  it('preserves standalone \\n', () => {
    expect(cleanText('A\nB')).toBe('A\nB');
  });

  it('preserves standalone \\r', () => {
    expect(cleanText('A\rB')).toBe('A\rB');
  });
});

describe('lineSplit', () => {
  it('splits \\r\\n-cleaned text into the correct number of lines', () => {
    const text = cleanText('Line 1\r\nLine 2\r\nLine 3');
    expect(lineSplit(text)).toEqual(['Line 1', 'Line 2', 'Line 3']);
  });
});

describe('parseDate', () => {
  it('parses a full PDF date string', () => {
    const date = parseDate("D:20210514143134-05'00'");
    expect(date).toBeInstanceOf(Date);
    expect(date!.getUTCFullYear()).toBe(2021);
    expect(date!.getUTCMonth()).toBe(4); // May = 4 (0-indexed)
    expect(date!.getUTCDate()).toBe(14);
  });

  it('parses a date with single-digit timezone offset hour', () => {
    const date = parseDate("D:20210514143134-5'00'");
    expect(date).toBeInstanceOf(Date);
    expect(date!.getUTCFullYear()).toBe(2021);
  });

  it('parses a date with Z timezone', () => {
    const date = parseDate('D:20210514143134Z');
    expect(date).toBeInstanceOf(Date);
    expect(date!.getUTCHours()).toBe(14);
  });

  it('parses a minimal date (year only)', () => {
    const date = parseDate('D:2021');
    expect(date).toBeInstanceOf(Date);
    expect(date!.getUTCFullYear()).toBe(2021);
  });

  it('returns undefined for invalid date strings', () => {
    expect(parseDate('not a date')).toBeUndefined();
    expect(parseDate('2021')).toBeUndefined();
  });
});
