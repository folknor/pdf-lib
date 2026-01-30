import {
  analyzePageResources,
  filterResources,
  type UsedResources,
} from '../../../src/core/utils/ContentStreamResourceAnalyzer.js';
import {
  PDFContext,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
} from '../../../src/core/index.js';
import PDFPageLeaf from '../../../src/core/structures/PDFPageLeaf.js';
import { zlibSync } from 'fflate';

describe('ContentStreamResourceAnalyzer', () => {
  describe('analyzePageResources', () => {
    it('returns empty sets for page with no content streams', () => {
      const context = PDFContext.create();
      const pageRef = context.nextRef();
      const page = PDFPageLeaf.withContextAndParent(context, pageRef);

      const result = analyzePageResources(page, context);

      expect(result).toBeDefined();
      expect(result!.Font.size).toBe(0);
      expect(result!.XObject.size).toBe(0);
      expect(result!.ExtGState.size).toBe(0);
    });

    it('extracts font references from Tf operator', () => {
      const context = PDFContext.create();
      const pageRef = context.nextRef();
      const page = PDFPageLeaf.withContextAndParent(context, pageRef);

      // Create content stream with font reference
      const contentData = new TextEncoder().encode(
        'BT /F1 12 Tf (Hello) Tj ET',
      );
      const contentStream = PDFRawStream.of(context.obj({}), contentData);
      const contentRef = context.register(contentStream);
      page.set(PDFName.Contents, contentRef);

      const result = analyzePageResources(page, context);

      expect(result).toBeDefined();
      expect(result!.Font.has('F1')).toBe(true);
    });

    it('extracts XObject references from Do operator', () => {
      const context = PDFContext.create();
      const pageRef = context.nextRef();
      const page = PDFPageLeaf.withContextAndParent(context, pageRef);

      // Create content stream with XObject reference
      const contentData = new TextEncoder().encode('q /Im1 Do Q');
      const contentStream = PDFRawStream.of(context.obj({}), contentData);
      const contentRef = context.register(contentStream);
      page.set(PDFName.Contents, contentRef);

      const result = analyzePageResources(page, context);

      expect(result).toBeDefined();
      expect(result!.XObject.has('Im1')).toBe(true);
    });

    it('extracts ExtGState references from gs operator', () => {
      const context = PDFContext.create();
      const pageRef = context.nextRef();
      const page = PDFPageLeaf.withContextAndParent(context, pageRef);

      // Create content stream with ExtGState reference
      const contentData = new TextEncoder().encode('/GS1 gs');
      const contentStream = PDFRawStream.of(context.obj({}), contentData);
      const contentRef = context.register(contentStream);
      page.set(PDFName.Contents, contentRef);

      const result = analyzePageResources(page, context);

      expect(result).toBeDefined();
      expect(result!.ExtGState.has('GS1')).toBe(true);
    });

    it('extracts ColorSpace references from cs/CS operators', () => {
      const context = PDFContext.create();
      const pageRef = context.nextRef();
      const page = PDFPageLeaf.withContextAndParent(context, pageRef);

      // Create content stream with colorspace references
      const contentData = new TextEncoder().encode('/CS1 cs /CS2 CS');
      const contentStream = PDFRawStream.of(context.obj({}), contentData);
      const contentRef = context.register(contentStream);
      page.set(PDFName.Contents, contentRef);

      const result = analyzePageResources(page, context);

      expect(result).toBeDefined();
      expect(result!.ColorSpace.has('CS1')).toBe(true);
      expect(result!.ColorSpace.has('CS2')).toBe(true);
    });

    it('extracts multiple resource types from complex content stream', () => {
      const context = PDFContext.create();
      const pageRef = context.nextRef();
      const page = PDFPageLeaf.withContextAndParent(context, pageRef);

      // Create content stream with multiple resource types
      const contentData = new TextEncoder().encode(`
        q
        /GS1 gs
        BT
        /F1 12 Tf (Hello) Tj
        /F2 14 Tf (World) Tj
        ET
        /Im1 Do
        /Im2 Do
        Q
      `);
      const contentStream = PDFRawStream.of(context.obj({}), contentData);
      const contentRef = context.register(contentStream);
      page.set(PDFName.Contents, contentRef);

      const result = analyzePageResources(page, context);

      expect(result).toBeDefined();
      expect(result!.Font.has('F1')).toBe(true);
      expect(result!.Font.has('F2')).toBe(true);
      expect(result!.XObject.has('Im1')).toBe(true);
      expect(result!.XObject.has('Im2')).toBe(true);
      expect(result!.ExtGState.has('GS1')).toBe(true);
    });

    it('handles compressed content streams', () => {
      const context = PDFContext.create();
      const pageRef = context.nextRef();
      const page = PDFPageLeaf.withContextAndParent(context, pageRef);

      // Create compressed content stream
      const contentText = 'BT /F1 12 Tf (Hello) Tj ET';
      const compressedData = zlibSync(new TextEncoder().encode(contentText));
      const streamDict = context.obj({});
      streamDict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
      const contentStream = PDFRawStream.of(streamDict, compressedData);
      const contentRef = context.register(contentStream);
      page.set(PDFName.Contents, contentRef);

      const result = analyzePageResources(page, context);

      expect(result).toBeDefined();
      expect(result!.Font.has('F1')).toBe(true);
    });

    it('handles multiple content streams in array', () => {
      const context = PDFContext.create();
      const pageRef = context.nextRef();
      const page = PDFPageLeaf.withContextAndParent(context, pageRef);

      // Create two content streams
      const stream1Data = new TextEncoder().encode('BT /F1 12 Tf ET');
      const stream1 = PDFRawStream.of(context.obj({}), stream1Data);
      const ref1 = context.register(stream1);

      const stream2Data = new TextEncoder().encode('/Im1 Do');
      const stream2 = PDFRawStream.of(context.obj({}), stream2Data);
      const ref2 = context.register(stream2);

      page.set(PDFName.Contents, context.obj([ref1, ref2]));

      const result = analyzePageResources(page, context);

      expect(result).toBeDefined();
      expect(result!.Font.has('F1')).toBe(true);
      expect(result!.XObject.has('Im1')).toBe(true);
    });
  });

  describe('filterResources', () => {
    it('filters resources to only include used ones', () => {
      const context = PDFContext.create();

      // Create a resources dict with multiple fonts
      const fontDict = context.obj({});
      fontDict.set(PDFName.of('F1'), PDFRef.of(100));
      fontDict.set(PDFName.of('F2'), PDFRef.of(101));
      fontDict.set(PDFName.of('F3'), PDFRef.of(102));

      const xobjectDict = context.obj({});
      xobjectDict.set(PDFName.of('Im1'), PDFRef.of(200));
      xobjectDict.set(PDFName.of('Im2'), PDFRef.of(201));

      const resources = context.obj({});
      resources.set(PDFName.Font, fontDict);
      resources.set(PDFName.XObject, xobjectDict);

      // Only F1 and Im1 are used
      const used: UsedResources = {
        Font: new Set(['F1']),
        XObject: new Set(['Im1']),
        ExtGState: new Set(),
        ColorSpace: new Set(),
        Pattern: new Set(),
        Shading: new Set(),
        Properties: new Set(),
      };

      const filtered = filterResources(resources, used, context);

      // Check that filtered resources only include used ones
      const filteredFont = filtered.lookup(PDFName.Font, PDFDict);
      expect(filteredFont.get(PDFName.of('F1'))).toBeDefined();
      expect(filteredFont.get(PDFName.of('F2'))).toBeUndefined();
      expect(filteredFont.get(PDFName.of('F3'))).toBeUndefined();

      const filteredXObject = filtered.lookup(PDFName.XObject, PDFDict);
      expect(filteredXObject.get(PDFName.of('Im1'))).toBeDefined();
      expect(filteredXObject.get(PDFName.of('Im2'))).toBeUndefined();
    });

    it('excludes empty resource categories', () => {
      const context = PDFContext.create();

      const fontDict = context.obj({});
      fontDict.set(PDFName.of('F1'), PDFRef.of(100));

      const resources = context.obj({});
      resources.set(PDFName.Font, fontDict);

      // No fonts are used
      const used: UsedResources = {
        Font: new Set(),
        XObject: new Set(),
        ExtGState: new Set(),
        ColorSpace: new Set(),
        Pattern: new Set(),
        Shading: new Set(),
        Properties: new Set(),
      };

      const filtered = filterResources(resources, used, context);

      expect(filtered.get(PDFName.Font)).toBeUndefined();
    });

    it('preserves ProcSet entry', () => {
      const context = PDFContext.create();

      const procSet = context.obj(['PDF', 'Text', 'ImageC']);
      const resources = context.obj({});
      resources.set(PDFName.of('ProcSet'), procSet);

      const used: UsedResources = {
        Font: new Set(),
        XObject: new Set(),
        ExtGState: new Set(),
        ColorSpace: new Set(),
        Pattern: new Set(),
        Shading: new Set(),
        Properties: new Set(),
      };

      const filtered = filterResources(resources, used, context);

      expect(filtered.get(PDFName.of('ProcSet'))).toBeDefined();
    });
  });
});
