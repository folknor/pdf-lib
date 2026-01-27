import {
  PDFContext,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFNull,
  PDFRef,
  PDFString,
  PDFWidgetAnnotation,
} from '../../../src/index';

describe('PDFWidgetAnnotation', () => {
  it('returns undefined for missing (DAs)', () => {
    const context = PDFContext.create();

    const parentRef = context.nextRef();
    const widget = PDFWidgetAnnotation.create(context, parentRef);
    widget.dict.set(PDFName.of('DA'), PDFNull);

    expect(widget.getDefaultAppearance()).toBe(undefined);
  });

  it('returns normal direct appearance strings (DAs)', () => {
    const context = PDFContext.create();

    const parentRef = context.nextRef();
    const widget = PDFWidgetAnnotation.create(context, parentRef);
    widget.dict.set(PDFName.of('DA'), PDFString.of('/ZaDb 10 Tf 0 g'));

    expect(widget.getDefaultAppearance()).toBe('/ZaDb 10 Tf 0 g');
  });

  it('returns hexadecimal (non-standard) direct appearance strings (DAs)', () => {
    const context = PDFContext.create();

    const parentRef = context.nextRef();
    const widget = PDFWidgetAnnotation.create(context, parentRef);
    widget.dict.set(PDFName.of('DA'), PDFHexString.fromText('/ZaDb 10 Tf 0 g'));

    expect(widget.getDefaultAppearance()).toBe('/ZaDb 10 Tf 0 g');
  });

  it('returns undefined from getNormalAppearance when no AP dict exists', () => {
    const context = PDFContext.create();
    const parentRef = context.nextRef();
    const widget = PDFWidgetAnnotation.create(context, parentRef);

    expect(widget.getNormalAppearance()).toBeUndefined();
  });

  it('returns undefined from getNormalAppearance when AP exists but N is missing', () => {
    const context = PDFContext.create();
    const parentRef = context.nextRef();
    const widget = PDFWidgetAnnotation.create(context, parentRef);
    widget.dict.set(PDFName.of('AP'), context.obj({}));

    expect(widget.getNormalAppearance()).toBeUndefined();
  });

  it('returns a PDFRef from getNormalAppearance when N is a ref', () => {
    const context = PDFContext.create();
    const parentRef = context.nextRef();
    const widget = PDFWidgetAnnotation.create(context, parentRef);

    const streamRef = context.register(context.flateStream(new Uint8Array()));
    const apDict = context.obj({ N: streamRef });
    widget.dict.set(PDFName.of('AP'), apDict);

    expect(widget.getNormalAppearance()).toBe(streamRef);
  });

  it('returns a PDFDict from getNormalAppearance when N is a dict', () => {
    const context = PDFContext.create();
    const parentRef = context.nextRef();
    const widget = PDFWidgetAnnotation.create(context, parentRef);

    const nDict = context.obj({ On: PDFRef.of(1) });
    const apDict = context.obj({});
    apDict.set(PDFName.of('N'), nDict);
    widget.dict.set(PDFName.of('AP'), apDict);

    expect(widget.getNormalAppearance()).toBeInstanceOf(PDFDict);
  });
});
