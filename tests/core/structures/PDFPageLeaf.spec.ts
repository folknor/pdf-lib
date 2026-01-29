import {
  PDFArray,
  PDFContext,
  PDFDict,
  PDFName,
  PDFPageLeaf,
  PDFPageTree,
  PDFRef,
} from '../../../src/index';

describe('PDFPageLeaf', () => {
  it('can be constructed directly from a Map and PDFContext', () => {
    const context = PDFContext.create();
    const dict = new Map();
    const pageTree = PDFPageLeaf.fromMapWithContext(dict, context);

    expect(pageTree).toBeInstanceOf(PDFPageLeaf);
    expect(pageTree.get(PDFName.of('Type'))).toBeUndefined();
    expect(pageTree.get(PDFName.of('Kids'))).toBeUndefined();
    expect(pageTree.get(PDFName.of('Count'))).toBeUndefined();
    expect(pageTree.get(PDFName.of('Parent'))).toBeUndefined();
  });

  it('is constructed with the correct Type and entries', () => {
    const context = PDFContext.create();
    const parentRef = PDFRef.of(1);
    const pageTree = PDFPageLeaf.withContextAndParent(context, parentRef);

    expect(pageTree).toBeInstanceOf(PDFPageLeaf);
    expect(pageTree.get(PDFName.of('Type'))).toBe(PDFName.of('Page'));
    expect(pageTree.get(PDFName.of('Parent'))).toBe(parentRef);
    expect(pageTree.get(PDFName.of('Resources'))).toBeInstanceOf(PDFDict);
    expect(pageTree.get(PDFName.of('MediaBox'))).toBeInstanceOf(PDFArray);
  });

  it('returns its Parent, Contents, Annots, BleedBox, TrimBox, Resources, MediaBox, CropBox, and Rotate entry values when they are references', () => {
    const context = PDFContext.create();

    const parent = PDFPageTree.withContext(context);
    const parentRef = context.register(parent);

    const contents = context.obj([]);
    const contentsRef = context.register(contents);

    const annots = context.obj([]);
    const annotsRef = context.register(annots);

    const bleedBox = context.obj([]);
    const bleedBoxRef = context.register(bleedBox);

    const trimBox = context.obj([]);
    const trimBoxRef = context.register(trimBox);

    const resources = context.obj({});
    const resourcesRef = context.register(resources);

    const mediaBox = context.obj([]);
    const mediaBoxRef = context.register(mediaBox);

    const cropBox = context.obj([]);
    const cropBoxRef = context.register(cropBox);

    const rotate = context.obj(270);
    const rotateRef = context.register(rotate);

    const pageLeaf = PDFPageLeaf.withContextAndParent(context, parentRef);
    const pageLeafRef = context.register(pageLeaf);

    parent.pushLeafNode(pageLeafRef);

    pageLeaf.set(PDFName.of('Contents'), contentsRef);
    pageLeaf.set(PDFName.of('Annots'), annotsRef);
    pageLeaf.set(PDFName.of('BleedBox'), bleedBoxRef);
    pageLeaf.set(PDFName.of('TrimBox'), trimBoxRef);
    pageLeaf.set(PDFName.of('Resources'), resourcesRef);
    pageLeaf.set(PDFName.of('MediaBox'), mediaBoxRef);
    pageLeaf.set(PDFName.of('CropBox'), cropBoxRef);
    pageLeaf.set(PDFName.of('Rotate'), rotateRef);

    expect(pageLeaf.Parent()).toBe(parent);
    expect(pageLeaf.Contents()).toBe(contents);
    expect(pageLeaf.Annots()).toBe(annots);
    expect(pageLeaf.BleedBox()).toBe(bleedBox);
    expect(pageLeaf.TrimBox()).toBe(trimBox);
    expect(pageLeaf.Resources()).toBe(resources);
    expect(pageLeaf.MediaBox()).toBe(mediaBox);
    expect(pageLeaf.CropBox()).toBe(cropBox);
    expect(pageLeaf.Rotate()).toBe(rotate);
  });

  it('returns its Parent, Contents, Annots, BleedBox, TrimBox, Resources, MediaBox, CropBox, and Rotate entry values when they are direct objects', () => {
    const context = PDFContext.create();

    const parent = PDFPageTree.withContext(context);
    const parentRef = context.register(parent);

    const contents = context.obj([]);

    const annots = context.obj([]);

    const bleedBox = context.obj([]);

    const trimBox = context.obj([]);

    const resources = context.obj({});

    const mediaBox = context.obj([]);

    const cropBox = context.obj([]);

    const rotate = context.obj(270);

    const pageLeaf = PDFPageLeaf.withContextAndParent(context, parentRef);
    const pageLeafRef = context.register(pageLeaf);

    parent.pushLeafNode(pageLeafRef);

    pageLeaf.set(PDFName.of('Contents'), contents);
    pageLeaf.set(PDFName.of('Annots'), annots);
    pageLeaf.set(PDFName.of('BleedBox'), bleedBox);
    pageLeaf.set(PDFName.of('TrimBox'), trimBox);
    pageLeaf.set(PDFName.of('Resources'), resources);
    pageLeaf.set(PDFName.of('MediaBox'), mediaBox);
    pageLeaf.set(PDFName.of('CropBox'), cropBox);
    pageLeaf.set(PDFName.of('Rotate'), rotate);

    expect(pageLeaf.Parent()).toBe(parent);
    expect(pageLeaf.Contents()).toBe(contents);
    expect(pageLeaf.Annots()).toBe(annots);
    expect(pageLeaf.BleedBox()).toBe(bleedBox);
    expect(pageLeaf.TrimBox()).toBe(trimBox);
    expect(pageLeaf.Resources()).toBe(resources);
    expect(pageLeaf.MediaBox()).toBe(mediaBox);
    expect(pageLeaf.CropBox()).toBe(cropBox);
    expect(pageLeaf.Rotate()).toBe(rotate);
  });

  it('returns its Resources, MediaBox, CropBox, and Rotate entry values when they are inherited', () => {
    const context = PDFContext.create();

    const resources = context.obj({});
    const resourcesRef = context.register(resources);

    const mediaBox = context.obj([]);
    const mediaBoxRef = context.register(mediaBox);

    const cropBox = context.obj([]);
    const cropBoxRef = context.register(cropBox);

    const rotate = context.obj(270);
    const rotateRef = context.register(rotate);

    const parent = PDFPageTree.withContext(context);
    const parentRef = context.register(parent);

    parent.set(PDFName.of('Resources'), resourcesRef);
    parent.set(PDFName.of('MediaBox'), mediaBoxRef);
    parent.set(PDFName.of('CropBox'), cropBoxRef);
    parent.set(PDFName.of('Rotate'), rotateRef);

    const pageLeaf = PDFPageLeaf.withContextAndParent(context, parentRef);
    const pageLeafRef = context.register(pageLeaf);

    parent.pushLeafNode(pageLeafRef);

    pageLeaf.delete(PDFName.of('Resources'));
    pageLeaf.delete(PDFName.of('MediaBox'));

    expect(pageLeaf.Parent()).toBe(parent);
    expect(pageLeaf.Resources()).toBe(resources);
    expect(pageLeaf.MediaBox()).toBe(mediaBox);
    expect(pageLeaf.CropBox()).toBe(cropBox);
    expect(pageLeaf.Rotate()).toBe(rotate);
  });

  it('returns its Resources, MediaBox, CropBox, and Rotate entry values after being normalized, when they are inherited', () => {
    const context = PDFContext.create();

    const resources = context.obj({
      Font: { Foo: PDFRef.of(2100) },
      XObject: { Foo: PDFRef.of(9000) },
    });
    const resourcesRef = context.register(resources);

    const mediaBox = context.obj([]);
    const mediaBoxRef = context.register(mediaBox);

    const cropBox = context.obj([]);
    const cropBoxRef = context.register(cropBox);

    const rotate = context.obj(270);
    const rotateRef = context.register(rotate);

    const parent = PDFPageTree.withContext(context);
    const parentRef = context.register(parent);

    parent.set(PDFName.of('Resources'), resourcesRef);
    parent.set(PDFName.of('MediaBox'), mediaBoxRef);
    parent.set(PDFName.of('CropBox'), cropBoxRef);
    parent.set(PDFName.of('Rotate'), rotateRef);

    const pageLeaf = PDFPageLeaf.withContextAndParent(context, parentRef);
    const pageLeafRef = context.register(pageLeaf);

    parent.pushLeafNode(pageLeafRef);

    pageLeaf.delete(PDFName.of('Resources'));
    pageLeaf.delete(PDFName.of('MediaBox'));

    const { Resources, Font, XObject } = pageLeaf.normalizedEntries();

    expect(pageLeaf.Parent()).toBe(parent);
    expect(pageLeaf.MediaBox()).toBe(mediaBox);
    expect(pageLeaf.CropBox()).toBe(cropBox);
    expect(pageLeaf.Rotate()).toBe(rotate);

    // Inherited Resources should be cloned to avoid mutation bugs
    // The cloned Resources should NOT be the same object as the original
    expect(pageLeaf.Resources()).not.toBe(resources);
    expect(Resources).not.toBe(resources);

    // But should have equivalent structure
    expect(Resources.get(PDFName.Font)?.toString()).toBe(
      resources.get(PDFName.Font)?.toString(),
    );
    expect(Resources.get(PDFName.XObject)?.toString()).toBe(
      resources.get(PDFName.XObject)?.toString(),
    );

    // Font and XObject should also be clones, not the same objects
    expect(Font).not.toBe(resources.get(PDFName.Font));
    expect(XObject).not.toBe(resources.get(PDFName.XObject));
  });

  it('cloning inherited resources prevents mutation of shared dictionaries', () => {
    const context = PDFContext.create();

    // Create shared resources on parent
    const sharedResources = context.obj({
      Font: { F1: PDFRef.of(100) },
    });
    const sharedResourcesRef = context.register(sharedResources);

    const parent = PDFPageTree.withContext(context);
    const parentRef = context.register(parent);
    parent.set(PDFName.of('Resources'), sharedResourcesRef);
    parent.set(PDFName.of('MediaBox'), context.obj([0, 0, 612, 792]));

    // Create two pages that inherit from the same parent
    const page1 = PDFPageLeaf.withContextAndParent(context, parentRef);
    page1.delete(PDFName.of('Resources'));
    const page1Ref = context.register(page1);
    parent.pushLeafNode(page1Ref);

    const page2 = PDFPageLeaf.withContextAndParent(context, parentRef);
    page2.delete(PDFName.of('Resources'));
    const page2Ref = context.register(page2);
    parent.pushLeafNode(page2Ref);

    // Normalize both pages (triggers resource cloning)
    const { Font: font1 } = page1.normalizedEntries();
    const { Font: font2 } = page2.normalizedEntries();

    // Add a font to page1's resources
    font1.set(PDFName.of('F2'), PDFRef.of(200));

    // Page2's resources should NOT be affected
    expect(font2.get(PDFName.of('F2'))).toBeUndefined();

    // Original shared resources should NOT be affected
    const originalFont = sharedResources.lookup(PDFName.Font, PDFDict);
    expect(originalFont.get(PDFName.of('F2'))).toBeUndefined();
  });

  it('can set its Parent', () => {
    const context = PDFContext.create();
    const parentRef = PDFRef.of(1);
    const pageTree = PDFPageLeaf.withContextAndParent(context, parentRef);
    pageTree.setParent(PDFRef.of(21));
    expect(pageTree.get(PDFName.of('Parent'))).toBe(PDFRef.of(21));
  });

  it('can add content stream refs', () => {
    const context = PDFContext.create();
    const parentRef = PDFRef.of(1);
    const pageTree = PDFPageLeaf.withContextAndParent(context, parentRef);

    pageTree.addContentStream(PDFRef.of(21));
    expect(pageTree.Contents()!.toString()).toBe('[ 21 0 R ]');
    pageTree.addContentStream(PDFRef.of(99));
    expect(pageTree.Contents()!.toString()).toBe('[ 21 0 R 99 0 R ]');
  });

  it('can set font dictionary refs', () => {
    const context = PDFContext.create();
    const parentRef = PDFRef.of(1);
    const pageTree = PDFPageLeaf.withContextAndParent(context, parentRef);

    const Font = PDFName.of('Font');
    pageTree.setFontDictionary(PDFName.of('Foo'), PDFRef.of(21));
    expect(pageTree.Resources()!.get(Font)!.toString()).toBe(
      '<<\n/Foo 21 0 R\n>>',
    );
    pageTree.setFontDictionary(PDFName.of('Bar'), PDFRef.of(99));
    expect(pageTree.Resources()!.get(Font)!.toString()).toBe(
      '<<\n/Foo 21 0 R\n/Bar 99 0 R\n>>',
    );
  });

  it('can set XObject refs', () => {
    const context = PDFContext.create();
    const parentRef = PDFRef.of(1);
    const pageTree = PDFPageLeaf.withContextAndParent(context, parentRef);

    const XObject = PDFName.of('XObject');
    pageTree.setXObject(PDFName.of('Foo'), PDFRef.of(21));
    expect(pageTree.Resources()!.get(XObject)!.toString()).toBe(
      '<<\n/Foo 21 0 R\n>>',
    );
    pageTree.setXObject(PDFName.of('Bar'), PDFRef.of(99));
    expect(pageTree.Resources()!.get(XObject)!.toString()).toBe(
      '<<\n/Foo 21 0 R\n/Bar 99 0 R\n>>',
    );
  });

  it('can set ExtGState refs and dicts', () => {
    const context = PDFContext.create();
    const parentRef = PDFRef.of(1);
    const pageTree = PDFPageLeaf.withContextAndParent(context, parentRef);

    const ExtGState = PDFName.of('ExtGState');
    pageTree.setExtGState(PDFName.of('Foo'), PDFRef.of(21));
    expect(pageTree.Resources()!.get(ExtGState)!.toString()).toBe(
      '<<\n/Foo 21 0 R\n>>',
    );
    pageTree.setExtGState(PDFName.of('Bar'), context.obj({ CA: 0.1 }));
    expect(pageTree.Resources()!.get(ExtGState)!.toString()).toBe(
      '<<\n/Foo 21 0 R\n/Bar <<\n/CA 0.1\n>>\n>>',
    );
  });

  it('can be ascended', () => {
    const context = PDFContext.create();

    const pageTree1 = PDFPageTree.withContext(context);
    const pageTree1Ref = context.register(pageTree1);

    const pageTree2 = PDFPageTree.withContext(context, pageTree1Ref);
    const pageTree2Ref = context.register(pageTree2);
    pageTree1.pushTreeNode(pageTree2Ref);

    const pageLeaf = PDFPageLeaf.withContextAndParent(context, pageTree2Ref);
    const pageLeafRef = context.register(pageLeaf);
    pageTree2.pushLeafNode(pageLeafRef);

    const visitations: (PDFPageLeaf | PDFPageTree)[] = [];
    pageLeaf.ascend((node) => {
      visitations.push(node);
    });

    expect(visitations).toEqual([pageLeaf, pageTree2, pageTree1]);
  });

  it('can be normalized with autoNormalizeCTM=false', () => {
    const context = PDFContext.create();
    const parentRef = PDFRef.of(1);
    const pageTree = PDFPageLeaf.withContextAndParent(context, parentRef);
    const stream = context.stream('foo');
    const streamRef = PDFRef.of(21);
    context.assign(streamRef, stream);
    pageTree.set(PDFName.of('Contents'), streamRef);

    expect(pageTree.Contents()).toBe(stream);
    expect(pageTree.Resources()!.toString()).toBe('<<\n>>');

    pageTree.normalize();

    expect(pageTree.Contents()!.toString()).toBe('[ 21 0 R ]');
    expect(pageTree.Resources()!.toString()).toBe(
      '<<\n/Font <<\n>>\n/XObject <<\n>>\n/ExtGState <<\n>>\n>>',
    );
  });

  it('can be normalized with autoNormalizeCTM=true', () => {
    const context = PDFContext.create();
    const map = new Map();
    const pageTree = PDFPageLeaf.fromMapWithContext(map, context);
    const stream = context.stream('foo');
    const streamRef = PDFRef.of(21);
    context.assign(streamRef, stream);
    pageTree.set(PDFName.of('Contents'), streamRef);

    expect(pageTree.Contents()).toBe(stream);
    expect(pageTree.get(PDFName.of('Resources'))).toBeUndefined();

    pageTree.normalize();

    const pushRef = context.getPushGraphicsStateContentStream();
    const popRef = context.getPopGraphicsStateContentStream();
    expect(pageTree.Contents()!.toString()).toBe(
      `[ ${pushRef} 21 0 R ${popRef} ]`,
    );
    expect(pageTree.Resources()!.toString()).toBe(
      '<<\n/Font <<\n>>\n/XObject <<\n>>\n/ExtGState <<\n>>\n>>',
    );
  });

  describe('resource reuse (getOrCreate methods)', () => {
    it('reuses font key when same ref is added multiple times', () => {
      const context = PDFContext.create();
      const parentRef = PDFRef.of(1);
      const page = PDFPageLeaf.withContextAndParent(context, parentRef);

      const fontRef = PDFRef.of(100);

      // First call creates new entry
      const key1 = page.getOrCreateFontDictionary('F', fontRef);
      expect(key1).toBeDefined();

      // Second call with same ref should return same key
      const key2 = page.getOrCreateFontDictionary('F', fontRef);
      expect(key2).toBe(key1);

      // Resources should only have one font entry
      const { Font } = page.normalizedEntries();
      expect(Font.entries().length).toBe(1);
    });

    it('creates different keys for different font refs', () => {
      const context = PDFContext.create();
      const parentRef = PDFRef.of(1);
      const page = PDFPageLeaf.withContextAndParent(context, parentRef);

      const fontRef1 = PDFRef.of(100);
      const fontRef2 = PDFRef.of(101);

      const key1 = page.getOrCreateFontDictionary('F', fontRef1);
      const key2 = page.getOrCreateFontDictionary('F', fontRef2);

      expect(key1).not.toBe(key2);

      const { Font } = page.normalizedEntries();
      expect(Font.entries().length).toBe(2);
    });

    it('reuses XObject key when same ref is added multiple times', () => {
      const context = PDFContext.create();
      const parentRef = PDFRef.of(1);
      const page = PDFPageLeaf.withContextAndParent(context, parentRef);

      const imageRef = PDFRef.of(200);

      const key1 = page.getOrCreateXObject('Im', imageRef);
      const key2 = page.getOrCreateXObject('Im', imageRef);

      expect(key2).toBe(key1);

      const { XObject } = page.normalizedEntries();
      expect(XObject.entries().length).toBe(1);
    });

    it('reuses ExtGState key when same ref is added multiple times', () => {
      const context = PDFContext.create();
      const parentRef = PDFRef.of(1);
      const page = PDFPageLeaf.withContextAndParent(context, parentRef);

      const gsRef = PDFRef.of(300);

      const key1 = page.getOrCreateExtGState('GS', gsRef);
      const key2 = page.getOrCreateExtGState('GS', gsRef);

      expect(key2).toBe(key1);

      const { ExtGState } = page.normalizedEntries();
      expect(ExtGState.entries().length).toBe(1);
    });
  });
});
