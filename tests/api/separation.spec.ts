import {
  cmyk,
  grayscale,
  PDFArray,
  PDFContentStream,
  PDFDict,
  PDFDocument,
  PDFHeader,
  PDFName,
  type PDFPage,
  PDFSeparation,
  rgb,
  separation,
} from '../../src/index';

const contentOf = (page: PDFPage): string => {
  const contents = page.node.Contents() as PDFArray;
  let text = '';

  for (let i = 0; i < contents.size(); i++) {
    const stream = contents.lookup(i);

    if (stream instanceof PDFContentStream) text += stream.getContentsString();
  }

  return text;
};

const colorSpacesOf = (page: PDFPage): PDFDict =>
  page.node.Resources()!.lookup(PDFName.ColorSpace, PDFDict);

describe('Separation colour spaces', () => {
  it('writes [/Separation name alternate tintTransform] from no ink to the alternate', async () => {
    const doc = await PDFDocument.create();
    const spot = doc.embedSeparation('PANTONE 123 C', cmyk(0, 0.22, 0.83, 0));
    expect(spot).toBeInstanceOf(PDFSeparation);
    const array = doc.context.lookup(spot.ref, PDFArray);
    expect(array.toString()).toBe(
      '[ /Separation /PANTONE#20123#20C /DeviceCMYK <<\n/FunctionType 2\n/Domain [ 0 1 ]\n/C0 [ 0 0 0 0 ]\n/C1 [ 0 0.22 0.83 0 ]\n/N 1\n>> ]',
    );
  });

  it('maps tint 0 to paper white for RGB and gray alternates', async () => {
    const doc = await PDFDocument.create();
    const rgbSpot = doc.embedSeparation('Brand', rgb(1, 0.5, 0));
    const graySpot = doc.embedSeparation('Varnish', grayscale(0.2));
    expect(doc.context.lookup(rgbSpot.ref, PDFArray).toString()).toContain(
      '/C0 [ 1 1 1 ]',
    );
    expect(doc.context.lookup(graySpot.ref, PDFArray).toString()).toContain(
      '/C0 [ 1 ]',
    );
  });

  it('returns one definition per colourant name and refuses a conflicting one', async () => {
    const doc = await PDFDocument.create();
    const a = doc.embedSeparation('Brand', rgb(1, 0, 0));
    expect(doc.embedSeparation('Brand', rgb(1, 0, 0))).toBe(a);
    expect(() => doc.embedSeparation('Brand', rgb(0, 1, 0))).toThrow(
      /different alternate/,
    );
  });

  it('snapshots the alternate colour', async () => {
    const doc = await PDFDocument.create();
    const alternate = rgb(1, 0, 0);
    const spot = doc.embedSeparation('Brand', alternate);
    alternate.green = 1;
    expect(spot.alternateComponents).toEqual([1, 0, 0]);
    expect(doc.context.lookup(spot.ref, PDFArray).toString()).toContain(
      '/C1 [ 1 0 0 ]',
    );
  });

  it('writes a non-ASCII colourant name as escaped UTF-8 bytes', async () => {
    const doc = await PDFDocument.create();
    const spot = doc.embedSeparation('Grün', cmyk(1, 0, 1, 0));
    const array = doc.context.lookup(spot.ref, PDFArray);
    expect(array.get(1).toString()).toBe('/Gr#C3#BCn');
    expect(() => doc.embedSeparation('', cmyk(0, 0, 0, 1))).toThrow();
    expect(() => doc.embedSeparation('a\0b', cmyk(0, 0, 0, 1))).toThrow();
    expect(() => doc.embedSeparation('\uD800', cmyk(0, 0, 0, 1))).toThrow(
      /surrogate/,
    );
    expect(doc.embedSeparation('\u{1F600}', cmyk(0, 0, 0, 1)).name).toBe(
      '\u{1F600}',
    );
  });

  it('refuses documents older than PDF 1.3', async () => {
    const doc = await PDFDocument.create();
    doc.context.header = PDFHeader.forVersion(1, 2);
    expect(() => doc.embedSeparation('Brand', rgb(1, 0, 0))).toThrow(/1\.3/);
  });

  it('refuses a raised header when an increment would still declare 1.2', async () => {
    const old = await PDFDocument.create();
    old.context.header = PDFHeader.forVersion(1, 2);
    const bytes = await old.save({ useObjectStreams: false });
    const doc = await PDFDocument.load(bytes, { forIncrementalUpdate: true });
    doc.context.header = PDFHeader.forVersion(1, 7);
    expect(() => doc.embedSeparation('Brand', rgb(1, 0, 0))).toThrow(/1\.3/);
    doc.catalog.set(PDFName.of('Version'), PDFName.of('1.4'));
    expect(doc.embedSeparation('Brand', rgb(1, 0, 0))).toBeInstanceOf(
      PDFSeparation,
    );
  });

  it('selects the colour space before the tint, for fill and stroke', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const spot = doc.embedSeparation('Brand', rgb(1, 0, 0));
    page.drawText('x', { color: separation(spot, 0.5) });
    page.drawRectangle({
      color: separation(spot, 0.5),
      borderColor: separation(spot, 0.25),
      borderWidth: 1,
    });
    page.drawLine({
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
      color: separation(spot, 0.25),
    });
    const key = colorSpacesOf(page).keys()[0]!.toString();
    const text = contentOf(page);
    expect(text).toContain(`BT\n${key} cs\n0.5 scn\n`);
    expect(text.split(`${key} cs\n0.5 scn\n`).length - 1).toBe(2);
    expect(text.split(`${key} CS\n0.25 SCN\n`).length - 1).toBe(2);
  });

  it('registers the space once per page and on every page it is used on', async () => {
    const doc = await PDFDocument.create();
    const spot = doc.embedSeparation('Brand', rgb(1, 0, 0));
    const p1 = doc.addPage();
    const p2 = doc.addPage();
    p1.drawCircle({ color: separation(spot, 1) });
    p1.drawEllipse({ color: separation(spot, 1) });
    p2.setFontColor(separation(spot, 1));
    p2.drawText('y');
    expect(colorSpacesOf(p1).keys().length).toBe(1);
    expect(colorSpacesOf(p1).values()[0]).toBe(spot.ref);
    expect(colorSpacesOf(p2).values()[0]).toBe(spot.ref);
  });

  it('refuses a colourant from another document and a tint out of range', async () => {
    const doc = await PDFDocument.create();
    const other = await PDFDocument.create();
    const page = doc.addPage();
    const foreign = other.embedSeparation('Brand', rgb(1, 0, 0));
    expect(() => page.drawRectangle({ color: separation(foreign, 1) })).toThrow(
      /different PDFDocument/,
    );
    const spot = doc.embedSeparation('Brand', rgb(1, 0, 0));
    expect(() => separation(spot, 1.5)).toThrow();
    expect(() =>
      page.drawRectangle({
        color: { type: separation(spot, 1).type, separation: spot, tint: 2 },
      }),
    ).toThrow(RangeError);
  });

  it('does not write into an inherited ColorSpace dictionary', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const shared = doc.context.obj({ Existing: PDFName.of('DeviceRGB') });
    const resources = doc.context.obj({ ColorSpace: shared });
    page.node.delete(PDFName.Resources);
    doc.catalog.Pages().set(PDFName.Resources, resources);
    // Re-normalize from the inherited state.
    // The test resets a private flag.
    (page.node as any).normalized = false;
    const spot = doc.embedSeparation('Brand', rgb(1, 0, 0));
    page.drawRectangle({ color: separation(spot, 1) });
    expect(shared.keys().length).toBe(1);
    expect(colorSpacesOf(page).keys().length).toBe(2);
  });

  it('survives save and reload', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const spot = doc.embedSeparation('PANTONE 123 C', rgb(1, 0.8, 0));
    page.drawRectangle({ color: separation(spot, 0.5) });
    const reloaded = await PDFDocument.load(await doc.save());
    const cs = colorSpacesOf(reloaded.getPage(0));
    const array = reloaded.context.lookup(cs.values()[0], PDFArray);
    expect(array.get(0)).toBe(PDFName.of('Separation'));
    expect(array.get(1)).toBe(PDFName.of('PANTONE 123 C'));
  });
});
