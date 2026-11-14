import fs from 'fs';

import {
  PDFContext,
  PDFName,
  PDFRef,
  PDFStreamWriter,
} from '../../../src/index';

const expectedPdfBytes = new Uint8Array(
  fs.readFileSync('./tests/core/writers/data/stream-writer-1.pdf'),
);

const contentStreamText = `
  BT
    /F1 24 Tf
    100 100 Td
    (Hello World and stuff!) Tj
  ET
`;

describe('PDFStreamWriter', () => {
  it('serializes PDFContext objects using Indirect Objects, Object Streams, and XRef Streams', async () => {
    const context = PDFContext.create();

    const contentStream = context.flateStream(contentStreamText);
    const contentStreamRef = PDFRef.of(9000);
    context.assign(contentStreamRef, contentStream);

    const fontDict = context.obj({
      Type: 'Font',
      Subtype: 'Type1',
      Name: 'F1',
      BaseFont: 'Helvetica',
      Encoding: 'MacRomanEncoding',
    });
    const fontDictRef = context.register(fontDict);

    const page = context.obj({
      Type: 'Page',
      MediaBox: [0, 0, 612, 792],
      Contents: contentStreamRef,
      Resources: { Font: { F1: fontDictRef } },
    });
    const pageRef = context.register(page);

    const pages = context.obj({
      Type: 'Pages',
      Kids: [pageRef],
      Count: 1,
    });
    const pagesRef = context.register(pages);
    page.set(PDFName.of('Parent'), pagesRef);

    const catalog = context.obj({
      Type: 'Catalog',
      Pages: pagesRef,
    });
    context.trailerInfo.Root = context.register(catalog);

    const buffer = await PDFStreamWriter.forContext(
      context,
      Infinity,
      false,
      2,
    ).serializeToBuffer();

    // The revision ID is new on every write; the remaining bytes stay exact.
    const text = Buffer.from(buffer).toString('latin1');
    expect(text).toMatch(/\/ID \[ <[0-9a-f]{32}> <[0-9a-f]{32}> \]/);
    const withoutID = Buffer.from(text.replace(/\/ID \[[^\]]*\]\n/, ''), 'latin1');
    expect(new Uint8Array(withoutID)).toEqual(expectedPdfBytes);
  });

  it('keeps /Sig and /DocTimeStamp dicts out of object streams', async () => {
    const context = PDFContext.create();
    const pagesRef = context.register(
      context.obj({ Type: 'Pages', Kids: [], Count: 0 }),
    );
    context.trailerInfo.Root = context.register(
      context.obj({ Type: 'Catalog', Pages: pagesRef }),
    );
    const sigRef = context.register(
      context.obj({ Type: 'Sig', Filter: 'Adobe.PPKLite' }),
    );
    const tsRef = context.register(
      context.obj({ Type: 'DocTimeStamp', Filter: 'Adobe.PPKLite' }),
    );
    const plainRef = context.register(context.obj({ Foo: 'Bar' }));

    const buffer = await PDFStreamWriter.forContext(
      context,
      Infinity,
      false,
    ).serializeToBuffer();
    const text = new TextDecoder('latin1').decode(buffer);

    expect(text).toContain(`\n${sigRef.objectNumber} 0 obj\n<<\n/Type /Sig`);
    expect(text).toContain(
      `\n${tsRef.objectNumber} 0 obj\n<<\n/Type /DocTimeStamp`,
    );
    // Ordinary dicts still go into an object stream.
    expect(text).not.toContain(`\n${plainRef.objectNumber} 0 obj`);
    expect(text).toContain('/Foo /Bar');
  });
});
