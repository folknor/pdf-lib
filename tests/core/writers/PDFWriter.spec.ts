import pako from 'pako';
import {
  mergeIntoTypedArray,
  PDFContext,
  PDFDocument,
  PDFName,
  PDFRef,
  PDFWriter,
  typedArrayFor,
} from '../../../src/index';

const contentStreamText = `
  BT
    /F1 24 Tf
    100 100 Td
    (Hello World and stuff!) Tj
  ET
`;

const encodedContentStream = pako.deflate(typedArrayFor(contentStreamText));

const pdfBytes = mergeIntoTypedArray(
  `%PDF-1.7
%

9000 0 obj
<<
/Filter /FlateDecode
/Length 67
>>
stream
`,
  encodedContentStream,
  `
endstream
endobj

9001 0 obj
<<
/Type /Font
/Subtype /Type1
/Name /F1
/BaseFont /Helvetica
/Encoding /MacRomanEncoding
>>
endobj

9002 0 obj
<<
/Type /Page
/MediaBox [ 0 0 612 792 ]
/Contents 9000 0 R
/Resources <<
/Font <<
/F1 9001 0 R
>>
>>
/Parent 9003 0 R
>>
endobj

9003 0 obj
<<
/Type /Pages
/Kids [ 9002 0 R ]
/Count 1
>>
endobj

9004 0 obj
<<
/Type /Catalog
/Pages 9003 0 R
>>
endobj

xref
0 1
0000000000 65535 f 
9000 5
0000000016 00000 n 
0000000158 00000 n 
0000000270 00000 n 
0000000411 00000 n 
0000000477 00000 n 

trailer
<<
/Size 9005
/Root 9004 0 R
>>

startxref
533
%%EOF`,
);

describe('PDFWriter', () => {
  it('serializes PDFContext objects using Indirect Objects and a Cross Reference table', async () => {
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

    const buffer = await PDFWriter.forContext(
      context,
      Infinity,
    ).serializeToBuffer();

    expect(buffer.length).toBe(pdfBytes.length);
    expect(buffer).toEqual(pdfBytes);
  });

  describe('compress option', () => {
    it('compresses uncompressed streams when compress=true', async () => {
      const context = PDFContext.create();

      // Create an uncompressed stream (no Filter)
      const uncompressedContent = 'Hello World! '.repeat(100); // Repeating content compresses well
      const stream = context.stream(uncompressedContent);
      const streamRef = context.register(stream);

      // Verify stream has no Filter initially
      expect(stream.dict.get(PDFName.of('Filter'))).toBeUndefined();

      const catalog = context.obj({ Type: 'Catalog', Test: streamRef });
      context.trailerInfo.Root = context.register(catalog);

      // Save with compression
      const compressedBuffer = await PDFWriter.forContext(
        context,
        Infinity,
        true, // compress=true
      ).serializeToBuffer();

      // The stream should now have FlateDecode filter
      expect(stream.dict.get(PDFName.of('Filter'))).toEqual(
        PDFName.of('FlateDecode'),
      );

      // Save without compression (new context to compare sizes)
      const context2 = PDFContext.create();
      const stream2 = context2.stream(uncompressedContent);
      const streamRef2 = context2.register(stream2);
      const catalog2 = context2.obj({ Type: 'Catalog', Test: streamRef2 });
      context2.trailerInfo.Root = context2.register(catalog2);

      const uncompressedBuffer = await PDFWriter.forContext(
        context2,
        Infinity,
        false, // compress=false
      ).serializeToBuffer();

      // Compressed should be smaller
      expect(compressedBuffer.length).toBeLessThan(uncompressedBuffer.length);
    });

    it('skips streams that already have a Filter', async () => {
      const context = PDFContext.create();

      // Create an already-compressed stream using flateStream
      const content = 'Already compressed content';
      const stream = context.flateStream(content);
      const streamRef = context.register(stream);

      // Get original compressed contents
      const originalContents = stream.getContents();

      const catalog = context.obj({ Type: 'Catalog', Test: streamRef });
      context.trailerInfo.Root = context.register(catalog);

      // Save with compression
      await PDFWriter.forContext(context, Infinity, true).serializeToBuffer();

      // Contents should not have changed (already compressed)
      expect(stream.getContents()).toEqual(originalContents);
    });

    it('skips small streams where compression overhead exceeds benefit', async () => {
      const context = PDFContext.create();

      // Create a tiny uncompressed stream (less than 50 bytes)
      const tinyContent = 'tiny';
      const stream = context.stream(tinyContent);
      const streamRef = context.register(stream);

      const catalog = context.obj({ Type: 'Catalog', Test: streamRef });
      context.trailerInfo.Root = context.register(catalog);

      // Save with compression
      await PDFWriter.forContext(context, Infinity, true).serializeToBuffer();

      // Small stream should not have Filter added
      expect(stream.dict.get(PDFName.of('Filter'))).toBeUndefined();
    });
  });
});
