import fs from 'fs';
import {
  JpegEmbedder,
  PDFContext,
  PDFRawStream,
  PDFRef,
} from '../../../src/core';

const catUnicornJpg = fs.readFileSync('./assets/images/cat_riding_unicorn.jpg');
const minionsLaughing = fs.readFileSync('./assets/images/minions_laughing.jpg');
const cmykJpg = fs.readFileSync('./assets/images/cmyk_colorspace.jpg');

describe('JpegEmbedder', () => {
  it('can be constructed with JpegEmbedder.for(...)', async () => {
    const embedder = await JpegEmbedder.for(catUnicornJpg);
    expect(embedder).toBeInstanceOf(JpegEmbedder);
  });

  it('can embed JPEG images into PDFContexts without a predefined ref', async () => {
    const context = PDFContext.create();
    const embedder = await JpegEmbedder.for(catUnicornJpg);

    expect(context.enumerateIndirectObjects().length).toBe(0);
    const ref = await embedder.embedIntoContext(context);
    expect(context.enumerateIndirectObjects().length).toBe(1);
    expect(context.lookup(ref)).toBeInstanceOf(PDFRawStream);
  });

  it('can embed JPEG images into PDFContexts with a predefined ref', async () => {
    const context = PDFContext.create();
    const predefinedRef = PDFRef.of(9999);
    const embedder = await JpegEmbedder.for(catUnicornJpg);

    expect(context.enumerateIndirectObjects().length).toBe(0);
    const ref = await embedder.embedIntoContext(context, predefinedRef);
    expect(context.enumerateIndirectObjects().length).toBe(1);
    expect(context.lookup(predefinedRef)).toBeInstanceOf(PDFRawStream);
    expect(ref).toBe(predefinedRef);
  });

  it('can extract properties of JPEG images (1)', async () => {
    const embedder = await JpegEmbedder.for(catUnicornJpg);

    expect(embedder.bitsPerComponent).toBe(8);
    expect(embedder.height).toBe(1080);
    expect(embedder.width).toBe(1920);
    expect(embedder.colorSpace).toBe('DeviceRGB');
  });

  it('can extract properties of JPEG images (2)', async () => {
    const embedder = await JpegEmbedder.for(minionsLaughing);

    expect(embedder.bitsPerComponent).toBe(8);
    expect(embedder.height).toBe(354);
    expect(embedder.width).toBe(630);
    expect(embedder.colorSpace).toBe('DeviceRGB');
  });

  it('can extract properties of JPEG images (3)', async () => {
    const embedder = await JpegEmbedder.for(cmykJpg);

    expect(embedder.bitsPerComponent).toBe(8);
    expect(embedder.height).toBe(333);
    expect(embedder.width).toBe(500);
    expect(embedder.colorSpace).toBe('DeviceCMYK');
  });

  it('returns undefined orientation for JPEGs without EXIF data', async () => {
    const embedder = await JpegEmbedder.for(catUnicornJpg);
    // Standard test JPEG without EXIF orientation
    expect(embedder.orientation).toBeUndefined();
  });

  it('parses EXIF orientation when present', async () => {
    // Create a minimal JPEG with EXIF orientation 6 (rotate 90 CW)
    // SOI + APP1(EXIF with orientation=6) + SOF0 + SOS + EOI
    const exifJpeg = createJpegWithExifOrientation(6);
    const embedder = await JpegEmbedder.for(exifJpeg);
    expect(embedder.orientation).toBe(6);
  });
});

/**
 * Creates a minimal valid JPEG with EXIF orientation tag.
 * This is a synthetic test image - just enough structure for parsing.
 */
function createJpegWithExifOrientation(orientation: number): Uint8Array {
  const data: number[] = [];

  // SOI marker
  data.push(0xff, 0xd8);

  // APP1 marker with EXIF data
  const exifData = createExifWithOrientation(orientation);
  data.push(0xff, 0xe1); // APP1 marker
  const exifLength = exifData.length + 2;
  data.push((exifLength >> 8) & 0xff, exifLength & 0xff);
  data.push(...exifData);

  // SOF0 marker (baseline DCT)
  data.push(0xff, 0xc0);
  data.push(0x00, 0x0b); // Length = 11
  data.push(0x08); // Bits per component
  data.push(0x00, 0x01); // Height = 1
  data.push(0x00, 0x01); // Width = 1
  data.push(0x01); // Number of components
  data.push(0x01, 0x11, 0x00); // Component 1: ID=1, sampling=1x1, quant=0

  // SOS marker (Start of Scan) - minimal
  data.push(0xff, 0xda);
  data.push(0x00, 0x08); // Length = 8
  data.push(0x01); // Number of components
  data.push(0x01, 0x00); // Component 1, DC/AC table 0
  data.push(0x00, 0x3f, 0x00); // Spectral selection

  // Minimal scan data (just zeros)
  data.push(0x00);

  // EOI marker
  data.push(0xff, 0xd9);

  return new Uint8Array(data);
}

function createExifWithOrientation(orientation: number): number[] {
  const data: number[] = [];

  // EXIF header "Exif\0\0"
  data.push(0x45, 0x78, 0x69, 0x66, 0x00, 0x00);

  // TIFF header (little endian)
  data.push(0x49, 0x49); // "II" = little endian
  data.push(0x2a, 0x00); // TIFF magic number 42
  data.push(0x08, 0x00, 0x00, 0x00); // Offset to IFD0 = 8

  // IFD0 with one entry (orientation)
  data.push(0x01, 0x00); // Number of entries = 1

  // Orientation tag entry (12 bytes)
  data.push(0x12, 0x01); // Tag = 0x0112 (Orientation)
  data.push(0x03, 0x00); // Type = 3 (SHORT)
  data.push(0x01, 0x00, 0x00, 0x00); // Count = 1
  data.push(orientation & 0xff, (orientation >> 8) & 0xff, 0x00, 0x00); // Value

  // Next IFD offset = 0 (no more IFDs)
  data.push(0x00, 0x00, 0x00, 0x00);

  return data;
}
