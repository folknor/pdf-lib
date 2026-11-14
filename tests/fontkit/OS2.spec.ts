import OS2 from '../../src/fontkit/tables/OS2.js';
import { DecodeStream } from '../../src/vendors/restructure/index.js';

describe('OS/2 version 0 metrics', () => {
  const bytes = () => {
    const buffer = new Uint8Array(78);
    const view = new DataView(buffer.buffer);
    view.setUint16(0, 0);
    view.setUint16(66, 0xffff); // usLastCharIndex, the end of the legacy layout
    view.setInt16(68, 1500);
    view.setInt16(70, -500);
    view.setInt16(72, -20);
    view.setUint16(74, 40000);
    view.setUint16(76, 35000);
    return buffer;
  };

  it('decodes signed typo and unsigned win metrics in the 78-byte layout', () => {
    const stream = new DecodeStream(bytes());
    const table = OS2.decode(stream, undefined, 78);

    expect(table).toMatchObject({
      version: 0,
      usLastCharIndex: 0xffff,
      typoAscender: 1500,
      typoDescender: -500,
      typoLineGap: -20,
      winAscent: 40000,
      winDescent: 35000,
    });
    expect(stream.pos).toBe(78);
  });

  it('leaves metrics undefined in the 68-byte layout without reading the next table', () => {
    // Keep trailing bytes in the font stream: the table length is the boundary.
    for (const buffer of [bytes().subarray(0, 68), bytes()]) {
      const stream = new DecodeStream(buffer);
      const table = OS2.decode(stream, undefined, 68);

      expect(table.usLastCharIndex).toBe(0xffff);
      expect(table.typoAscender).toBeUndefined();
      expect(table.typoDescender).toBeUndefined();
      expect(table.typoLineGap).toBeUndefined();
      expect(table.winAscent).toBeUndefined();
      expect(table.winDescent).toBeUndefined();
      expect(stream.pos).toBe(68);
    }
  });
});
