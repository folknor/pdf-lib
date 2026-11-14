import { parseContentStream } from '../../../src/core/content/ContentStreamParser.js';
import { PDFName } from '../../../src/core/index.js';

const parse = (s: string) => parseContentStream(new TextEncoder().encode(s));

describe('parseContentStream', () => {
  it('reads operands of every kind and their operators', () => {
    const { operations, complete } = parse(
      '/F#2320 -1.5 Tf [(a\\)b) -20 <414> ] TJ << /K true /N null >> BDC',
    );
    expect(complete).toBe(true);
    expect(operations.map((o) => o.operator)).toEqual(['Tf', 'TJ', 'BDC']);
    expect(operations[0]!.operands).toEqual([
      { type: 'name', name: PDFName.fromDecoded('F#20') },
      -1.5,
    ]);
    expect(operations[1]!.operands).toEqual([
      [
        { type: 'string', bytes: new Uint8Array([0x61, 0x29, 0x62]), hex: false },
        -20,
        { type: 'string', bytes: new Uint8Array([0x41, 0x40]), hex: true },
      ],
    ]);
    const dict = operations[2]!.operands[0] as {
      entries: Map<PDFName, unknown>;
    };
    expect(dict.entries.get(PDFName.of('K'))).toBe(true);
    expect(dict.entries.get(PDFName.of('N'))).toBe(null);
  });

  it('reads literal string escapes', () => {
    const [op] = parse('(\\101\\n(x)\\\ny) Tj').operations;
    expect(op!.operands[0]).toEqual({
      type: 'string',
      bytes: new TextEncoder().encode('A\n(x)y'),
      hex: false,
    });
  });

  it('reads an unescaped CR or CR LF in a literal string as LF', () => {
    const [op] = parse('(a\rb\r\nc\nd) Tj').operations;
    expect(op!.operands[0]).toEqual({
      type: 'string',
      bytes: new TextEncoder().encode('a\nb\nc\nd'),
      hex: false,
    });
  });

  it('frames ASCII85 inline data by its validated end marker', () => {
    const { complete } = parse(
      'BI /W 1 /H 1 /BPC 8 /CS /G /F /A85 ID z!!~> EI',
    );
    expect(complete).toBe(true);
  });

  it('frames unfiltered inline image data by its computed size', () => {
    const { operations, complete } = parse(
      'BI /W 2 /H 2 /BPC 8 /CS /RGB ID EI EI EI xyz EI Q',
    );
    expect(complete).toBe(true);
    expect(operations.map((o) => o.operator)).toEqual(['BI', 'Q']);
    expect(new TextDecoder().decode(operations[0]!.inlineImage!.data)).toBe(
      'EI EI EI xyz',
    );
  });

  it.each([
    '1.2.3 w',
    '/a ]',
    '(open',
    '<4g> Tj',
    '1 2',
    'EI',
    'BI /W 1 /Width 1 /H 1 /BPC 8 /CS /G ID x EI',
    'BI /W 1 /H 1 /BPC 8 /CS /I ID x EI',
    'BI /W 1 /H 1 /BPC 8 /CS /G ID xy',
    'BI /W 1 /H 1 /BPC 8 /CS /G /F /A85 ID !~> EI',
    'BI /W 1 /H 1 /BPC 8 /CS /G /F /A85 ID !z~> EI',
    'BI /W 1 /H 1 /BPC 8 /CS /G /F /A85 ID uuuuu~> EI',
    `${'9'.repeat(400)} w`,
    'BI /W 1 /H 1 /BPC 8 /CS /G /F /A85 ID uu~> EI',
    '/F#GG 12 Tf',
    '/F#2 12 Tf',
  ])('reports %j as incomplete', (s) => {
    expect(parse(s).complete).toBe(false);
  });
});
