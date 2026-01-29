import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import { vi } from 'vitest';
import type { PDFAttachment } from '../../src/api/PDFDocument';
import {
  AFRelationship,
  Duplex,
  EncryptedPDFError,
  NonFullScreenPageMode,
  PageSizes,
  ParseSpeeds,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFPage,
  PrintScaling,
  ReadingDirection,
  ViewerPreferences,
} from '../../src/index';

const examplePngImageBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9TxaoVBzuIdMhQnSyIijhKFYtgobQVWnUwufQLmjQkKS6OgmvBwY/FqoOLs64OroIg+AHi5uak6CIl/i8ptIjx4Lgf7+497t4BQqPCVLNrAlA1y0jFY2I2tyr2vKIfAgLoRVhipp5IL2bgOb7u4ePrXZRneZ/7cwwoeZMBPpF4jumGRbxBPLNp6Zz3iUOsJCnE58TjBl2Q+JHrsstvnIsOCzwzZGRS88QhYrHYwXIHs5KhEk8TRxRVo3wh67LCeYuzWqmx1j35C4N5bSXNdZphxLGEBJIQIaOGMiqwEKVVI8VEivZjHv4Rx58kl0yuMhg5FlCFCsnxg//B727NwtSkmxSMAd0vtv0xCvTsAs26bX8f23bzBPA/A1da219tALOfpNfbWuQIGNwGLq7bmrwHXO4Aw0+6ZEiO5KcpFArA+xl9Uw4YugX61tzeWvs4fQAy1NXyDXBwCIwVKXvd492Bzt7+PdPq7wcdn3KFLu4iBAAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAlFJREFUeNrt289r02AYB/Dvk6Sl4EDKpllTlFKsnUdBHXgUBEHwqHj2IJ72B0zwKHhxJ08i/gDxX/AiRfSkBxELXTcVxTa2s2xTsHNN8ngQbQL70RZqG/Z9b29JnvflkydP37whghG3ZaegoxzfwB5vBCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgwB5rstWPtnP0LqBX/vZNyLF6vVrpN/hucewhb4g+B2AyAwiwY7NGOXijviS9vBeYh6CEP4edBLDADCAAAQhAAAIQgAAEIAABCDAUAFF/GIN1DM+PBYCo/ohMXDQ1WPjoeUZH1mMBEEh0oqLGvsHCy0S4NzWVWotJBogbvZB+brDwQT7UWSmXy5sxyQB9HQEROdVv4HQ+vx+QmS4iXsWmCK7Usu8AhOqAXMzlcn3VgWTbugQgEYrxMkZ/gyUPgnuhe2C6/Stxvdeg2ezMJERvhOuoZ+JBrNYBRuDdBtDuXkDM25nCHLbZSv9X6A4VHU+DpwCcbvbjcetLtTaOANtuirrux08HM0euisjDEMKC7RQuq+C+pVJqpzx3NZ3+eeBza9I0rWJgyHnxg2sAJrqnaHUzFcyN60Jox13hprv8aNopZBS4GcqWWVHM+lAkN0zY7ncgkYBukRoKLPpiXVj9UFkfV4Bdl8Jf60u3IMZZAG/6iLuhkDvaSZ74VqtUx3kp3NN7gUZt8RmA43a2eEY1OCfQ04AcBpAGkAKwpkBLIG8BfQE/eNJsvG/G4VlARj0BfjDBx2ECEIAABCAAAQhAAAIQgAAE+P/tN8YvpvbTDBOlAAAAAElFTkSuQmCC';
const examplePngImage = `data:image/png;base64,${examplePngImageBase64}`;

const unencryptedPdfBytes = fs.readFileSync('assets/pdfs/normal.pdf');
const oldEncryptedPdfBytes1 = fs.readFileSync('assets/pdfs/encrypted_old.pdf');

// Had to remove this file due to DMCA complaint, so commented this line out
// along with the 2 tests that depend on it. Would be nice to find a new file
// that we could drop in here, but the tests are for non-critical functionality,
// so this solution is okay for now.
// const oldEncryptedPdfBytes2 = fs.readFileSync('pdf_specification.pdf');

const newEncryptedPdfBytes = fs.readFileSync('assets/pdfs/encrypted_new.pdf');
const invalidObjectsPdfBytes = fs.readFileSync(
  'assets/pdfs/with_invalid_objects.pdf',
);
const justMetadataPdfbytes = fs.readFileSync('assets/pdfs/just_metadata.pdf');
const normalPdfBytes = fs.readFileSync('assets/pdfs/normal.pdf');
const withViewerPrefsPdfBytes = fs.readFileSync(
  'assets/pdfs/with_viewer_prefs.pdf',
);
const hasAttachmentPdfBytes = fs.readFileSync(
  'assets/pdfs/examples/add_attachments.pdf',
);

describe('PDFDocument', () => {
  describe('load() method', () => {
    const origConsoleWarn = console.warn;

    beforeAll(() => {
      const ignoredWarnings = [
        'Trying to parse invalid object:',
        'Invalid object ref:',
      ];
      console.warn = vi.fn((...args) => {
        const isIgnored = ignoredWarnings.find((iw) => args[0].includes(iw));
        if (!isIgnored) origConsoleWarn(...args);
      });
    });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterAll(() => {
      console.warn = origConsoleWarn;
    });

    it('does not throw an error for unencrypted PDFs', async () => {
      const pdfDoc = await PDFDocument.load(unencryptedPdfBytes, {
        parseSpeed: ParseSpeeds.Fastest,
      });
      expect(pdfDoc).toBeInstanceOf(PDFDocument);
      expect(pdfDoc.isEncrypted).toBe(false);
    });

    it('throws an error for old encrypted PDFs (1)', async () => {
      await expect(
        PDFDocument.load(oldEncryptedPdfBytes1, {
          parseSpeed: ParseSpeeds.Fastest,
        }),
      ).rejects.toThrow(new EncryptedPDFError());
    });

    // it(`throws an error for old encrypted PDFs (2)`, async () => {
    //   await expect(
    //     PDFDocument.load(oldEncryptedPdfBytes2, {
    //       parseSpeed: ParseSpeeds.Fastest,
    //     }),
    //   ).rejects.toThrow(new EncryptedPDFError());
    // });

    it('throws an error for new encrypted PDFs', async () => {
      await expect(
        PDFDocument.load(newEncryptedPdfBytes, {
          parseSpeed: ParseSpeeds.Fastest,
        }),
      ).rejects.toThrow(new EncryptedPDFError());
    });

    it('does not throw an error for old encrypted PDFs when ignoreEncryption=true (1)', async () => {
      const pdfDoc = await PDFDocument.load(oldEncryptedPdfBytes1, {
        ignoreEncryption: true,
        parseSpeed: ParseSpeeds.Fastest,
      });
      expect(pdfDoc).toBeInstanceOf(PDFDocument);
      expect(pdfDoc.isEncrypted).toBe(true);
    });

    // it(`does not throw an error for old encrypted PDFs when ignoreEncryption=true (2)`, async () => {
    //   const pdfDoc = await PDFDocument.load(oldEncryptedPdfBytes2, {
    //     ignoreEncryption: true,
    //     parseSpeed: ParseSpeeds.Fastest,
    //   });
    //   expect(pdfDoc).toBeInstanceOf(PDFDocument);
    //   expect(pdfDoc.isEncrypted).toBe(true);
    // });

    it('does not throw an error for new encrypted PDFs when ignoreEncryption=true', async () => {
      const pdfDoc = await PDFDocument.load(newEncryptedPdfBytes, {
        ignoreEncryption: true,
        parseSpeed: ParseSpeeds.Fastest,
      });
      expect(pdfDoc).toBeInstanceOf(PDFDocument);
      expect(pdfDoc.isEncrypted).toBe(true);
    });

    it('does not throw an error for invalid PDFs when throwOnInvalidObject=false', async () => {
      await expect(
        PDFDocument.load(invalidObjectsPdfBytes, {
          ignoreEncryption: true,
          parseSpeed: ParseSpeeds.Fastest,
          throwOnInvalidObject: false,
        }),
      ).resolves.toBeInstanceOf(PDFDocument);
    });

    it('throws an error for invalid PDFs when throwOnInvalidObject=true', async () => {
      const expectedError = new Error(
        'Trying to parse invalid object: {"line":20,"column":13,"offset":126})',
      );
      await expect(
        PDFDocument.load(invalidObjectsPdfBytes, {
          ignoreEncryption: true,
          parseSpeed: ParseSpeeds.Fastest,
          throwOnInvalidObject: true,
        }),
      ).rejects.toEqual(expectedError);
    });
  });

  describe('embedFont() method', () => {
    it('serializes the same value on every save', async () => {
      const customFont = fs.readFileSync('assets/fonts/ubuntu/Ubuntu-B.ttf');
      const pdfDoc1 = await PDFDocument.create({ updateMetadata: false });
      const pdfDoc2 = await PDFDocument.create({ updateMetadata: false });

      pdfDoc1.registerFontkit(fontkit);
      pdfDoc2.registerFontkit(fontkit);

      await pdfDoc1.embedFont(customFont);
      await pdfDoc2.embedFont(customFont);

      const savedDoc1 = await pdfDoc1.save();
      const savedDoc2 = await pdfDoc2.save();

      expect(savedDoc1).toEqual(savedDoc2);
    });
  });

  describe('setLanguage() method', () => {
    it('sets the language of the document', async () => {
      const pdfDoc = await PDFDocument.create();
      expect(pdfDoc.getLanguage()).toBeUndefined();

      pdfDoc.setLanguage('fr-FR');
      expect(pdfDoc.getLanguage()).toBe('fr-FR');

      pdfDoc.setLanguage('en');
      expect(pdfDoc.getLanguage()).toBe('en');

      pdfDoc.setLanguage('');
      expect(pdfDoc.getLanguage()).toBe('');
    });
  });

  describe('getPageCount() method', () => {
    let pdfDoc: PDFDocument;
    beforeAll(async () => {
      const parseSpeed = ParseSpeeds.Fastest;
      pdfDoc = await PDFDocument.load(unencryptedPdfBytes, { parseSpeed });
    });

    it('returns the initial page count of the document', () => {
      expect(pdfDoc.getPageCount()).toBe(2);
    });

    it('returns the updated page count after adding pages', () => {
      pdfDoc.addPage();
      pdfDoc.addPage();
      expect(pdfDoc.getPageCount()).toBe(4);
    });

    it('returns the updated page count after inserting pages', () => {
      pdfDoc.insertPage(0);
      pdfDoc.insertPage(4);
      expect(pdfDoc.getPageCount()).toBe(6);
    });

    it('returns the updated page count after removing pages', () => {
      pdfDoc.removePage(5);
      pdfDoc.removePage(0);
      expect(pdfDoc.getPageCount()).toBe(4);
    });

    it('invalidates the page cache after removing a page', () => {
      const pageCount = pdfDoc.getPageCount();
      const beforePages = pdfDoc.getPages();
      expect(beforePages.length).toBe(pageCount);
      pdfDoc.removePage(0);
      const afterPages = pdfDoc.getPages();
      expect(afterPages.length).toBe(pageCount - 1);
      expect(afterPages.length).toBe(pdfDoc.getPageCount());
    });

    it('returns 0 for brand new documents', async () => {
      const newDoc = await PDFDocument.create();
      expect(newDoc.getPageCount()).toBe(0);
    });
  });

  describe('addPage() method', () => {
    it('Can insert pages in brand new documents', async () => {
      const pdfDoc = await PDFDocument.create();
      expect(pdfDoc.addPage()).toBeInstanceOf(PDFPage);
    });
  });

  describe('metadata getter methods', () => {
    it('they can retrieve the title, author, subject, producer, creator, keywords, creation date, and modification date from a new document', async () => {
      const pdfDoc = await PDFDocument.create();

      // Everything is empty or has its initial value.
      expect(pdfDoc.getTitle()).toBeUndefined();
      expect(pdfDoc.getAuthor()).toBeUndefined();
      expect(pdfDoc.getSubject()).toBeUndefined();
      expect(pdfDoc.getProducer()).toBe(
        'pdf-lib (https://github.com/Hopding/pdf-lib)',
      );
      expect(pdfDoc.getCreator()).toBe(
        'pdf-lib (https://github.com/Hopding/pdf-lib)',
      );
      expect(pdfDoc.getKeywords()).toBeUndefined();
      // Dates can not be tested since they have the current time as value.

      const title = '🥚 The Life of an Egg 🍳';
      const author = 'Humpty Dumpty';
      const subject = '📘 An Epic Tale of Woe 📖';
      const keywords = ['eggs', 'wall', 'fall', 'king', 'horses', 'men', '🥚'];
      const producer = 'PDF App 9000 🤖';
      const creator = 'PDF App 8000 🤖';

      // Milliseconds  will not get saved, so these dates do not have milliseconds.
      const creationDate = new Date('1997-08-15T01:58:37Z');
      const modificationDate = new Date('2018-12-21T07:00:11Z');

      pdfDoc.setTitle(title);
      pdfDoc.setAuthor(author);
      pdfDoc.setSubject(subject);
      pdfDoc.setKeywords(keywords);
      pdfDoc.setProducer(producer);
      pdfDoc.setCreator(creator);
      pdfDoc.setCreationDate(creationDate);
      pdfDoc.setModificationDate(modificationDate);

      expect(pdfDoc.getTitle()).toBe(title);
      expect(pdfDoc.getAuthor()).toBe(author);
      expect(pdfDoc.getSubject()).toBe(subject);
      expect(pdfDoc.getProducer()).toBe(producer);
      expect(pdfDoc.getCreator()).toBe(creator);
      expect(pdfDoc.getKeywords()).toBe(keywords.join(' '));
      expect(pdfDoc.getCreationDate()).toStrictEqual(creationDate);
      expect(pdfDoc.getModificationDate()).toStrictEqual(modificationDate);
    });

    it('they can retrieve the title, author, subject, producer, creator, and keywords from an existing document', async () => {
      const pdfDoc = await PDFDocument.load(justMetadataPdfbytes);

      expect(pdfDoc.getTitle()).toBe(
        'Title metadata (StringType=HexString, Encoding=PDFDocEncoding) with some weird chars ˘•€',
      );
      expect(pdfDoc.getAuthor()).toBe(
        'Author metadata (StringType=HexString, Encoding=UTF-16BE) with some chinese 你怎么敢',
      );
      expect(pdfDoc.getSubject()).toBe(
        'Subject metadata (StringType=LiteralString, Encoding=UTF-16BE) with some chinese 你怎么敢',
      );
      expect(pdfDoc.getProducer()).toBe(
        'pdf-lib (https://github.com/Hopding/pdf-lib)',
      );
      expect(pdfDoc.getKeywords()).toBe(
        'Keywords metadata (StringType=LiteralString, Encoding=PDFDocEncoding) with  some weird  chars ˘•€',
      );
    });

    it('preserves custom producer metadata across save and load', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.setProducer('CustomProducer/v1');
      const savedBytes = await pdfDoc.save();

      const loaded = await PDFDocument.load(savedBytes);
      expect(loaded.getProducer()).toBe('CustomProducer/v1');
    });

    it('they can retrieve the creation date and modification date from an existing document', async () => {
      const pdfDoc = await PDFDocument.load(normalPdfBytes, {
        updateMetadata: false,
      });

      expect(pdfDoc.getCreationDate()).toEqual(
        new Date('2018-01-04T01:05:06.000Z'),
      );
      expect(pdfDoc.getModificationDate()).toEqual(
        new Date('2018-01-04T01:05:06.000Z'),
      );
    });
  });

  it('preserves the original PDF version on save', async () => {
    const pdfDoc = await PDFDocument.load(normalPdfBytes, {
      updateMetadata: false,
    });
    const savedBytes = await pdfDoc.save();
    const header = new TextDecoder().decode(savedBytes.slice(0, 8));
    // normalPdfBytes is a PDF 1.6 file
    expect(header).toContain('%PDF-1.');
    // Verify the version matches the original, not hardcoded 1.7
    const originalHeader = new TextDecoder().decode(
      (normalPdfBytes as Uint8Array).slice(0, 8),
    );
    expect(header).toBe(originalHeader);
  });

  describe('ViewerPreferences', () => {
    it('defaults to an undefined ViewerPreferences dict', async () => {
      const pdfDoc = await PDFDocument.create();

      expect(
        pdfDoc.catalog.lookupMaybe(PDFName.of('ViewerPreferences'), PDFDict),
      ).toBeUndefined();
    });

    it('can get/set HideToolbar, HideMenubar, HideWindowUI, FitWindow, CenterWindow, DisplayDocTitle, NonFullScreenPageMode, Direction, PrintScaling, Duplex, PickTrayByPDFSize, PrintPageRange, NumCopies from a new document', async () => {
      const pdfDoc = await PDFDocument.create();
      const viewerPrefs = pdfDoc.catalog.getOrCreateViewerPreferences();

      // Everything is empty or has its initial value.
      expect(viewerPrefs.getHideToolbar()).toBe(false);
      expect(viewerPrefs.getHideMenubar()).toBe(false);
      expect(viewerPrefs.getHideWindowUI()).toBe(false);
      expect(viewerPrefs.getFitWindow()).toBe(false);
      expect(viewerPrefs.getCenterWindow()).toBe(false);
      expect(viewerPrefs.getDisplayDocTitle()).toBe(false);
      expect(viewerPrefs.getNonFullScreenPageMode()).toBe(
        NonFullScreenPageMode.UseNone,
      );
      expect(viewerPrefs.getReadingDirection()).toBe(ReadingDirection.L2R);
      expect(viewerPrefs.getPrintScaling()).toBe(PrintScaling.AppDefault);
      expect(viewerPrefs.getDuplex()).toBeUndefined();
      expect(viewerPrefs.getPickTrayByPDFSize()).toBeUndefined();
      expect(viewerPrefs.getPrintPageRange()).toEqual([]);
      expect(viewerPrefs.getNumCopies()).toBe(1);

      const pageRanges = [
        { start: 0, end: 0 },
        { start: 2, end: 2 },
        { start: 4, end: 6 },
      ];

      viewerPrefs.setHideToolbar(true);
      viewerPrefs.setHideMenubar(true);
      viewerPrefs.setHideWindowUI(true);
      viewerPrefs.setFitWindow(true);
      viewerPrefs.setCenterWindow(true);
      viewerPrefs.setDisplayDocTitle(true);
      viewerPrefs.setNonFullScreenPageMode(NonFullScreenPageMode.UseOutlines);
      viewerPrefs.setReadingDirection(ReadingDirection.R2L);
      viewerPrefs.setPrintScaling(PrintScaling.None);
      viewerPrefs.setDuplex(Duplex.DuplexFlipLongEdge);
      viewerPrefs.setPickTrayByPDFSize(true);
      viewerPrefs.setPrintPageRange(pageRanges);
      viewerPrefs.setNumCopies(2);

      expect(viewerPrefs.getHideToolbar()).toBe(true);
      expect(viewerPrefs.getHideMenubar()).toBe(true);
      expect(viewerPrefs.getHideWindowUI()).toBe(true);
      expect(viewerPrefs.getFitWindow()).toBe(true);
      expect(viewerPrefs.getCenterWindow()).toBe(true);
      expect(viewerPrefs.getDisplayDocTitle()).toBe(true);
      expect(viewerPrefs.getNonFullScreenPageMode()).toBe(
        NonFullScreenPageMode.UseOutlines,
      );
      expect(viewerPrefs.getReadingDirection()).toBe(ReadingDirection.R2L);
      expect(viewerPrefs.getPrintScaling()).toBe(PrintScaling.None);
      expect(viewerPrefs.getDuplex()).toBe(Duplex.DuplexFlipLongEdge);
      expect(viewerPrefs.getPickTrayByPDFSize()).toBe(true);
      expect(viewerPrefs.getPrintPageRange()).toEqual(pageRanges);
      expect(viewerPrefs.getNumCopies()).toBe(2);

      // Test setting single page range
      const pageRange = { start: 2, end: 4 };
      viewerPrefs.setPrintPageRange(pageRange);
      expect(viewerPrefs.getPrintPageRange()).toEqual([pageRange]);
    });

    it('they can be retrieved from an existing document', async () => {
      const pdfDoc = await PDFDocument.load(withViewerPrefsPdfBytes);
      const viewerPrefs = pdfDoc.catalog.getViewerPreferences()!;

      expect(viewerPrefs).toBeInstanceOf(ViewerPreferences);
      expect(viewerPrefs.getPrintScaling()).toBe(PrintScaling.None);
      expect(viewerPrefs.getDuplex()).toBe(Duplex.DuplexFlipLongEdge);
      expect(viewerPrefs.getPickTrayByPDFSize()).toBe(true);
      expect(viewerPrefs.getPrintPageRange()).toEqual([
        { start: 1, end: 1 },
        { start: 3, end: 4 },
      ]);
      expect(viewerPrefs.getNumCopies()).toBe(2);

      expect(viewerPrefs.getFitWindow()).toBe(true);
      expect(viewerPrefs.getCenterWindow()).toBe(true);
      expect(viewerPrefs.getDisplayDocTitle()).toBe(true);
      expect(viewerPrefs.getHideMenubar()).toBe(true);
      expect(viewerPrefs.getHideToolbar()).toBe(true);

      /*
       * Other presets not tested, but defined in this PDF doc (Acrobat XI v11):
       * Binding: RightEdge
       * Language: EN-NZ
       *
       * NavigationTab: PageOnly
       * PageLayout: TwoUp (facing)
       * Magnification: 50%
       * OpenToPage: 2
       *
       * PageMode: FullScreen
       */
    });
  });

  describe('setTitle() method with options', () => {
    it('does not set the ViewerPreferences dict if the option is not set', async () => {
      const pdfDoc = await PDFDocument.create();

      pdfDoc.setTitle('Testing setTitle Title');

      expect(
        pdfDoc.catalog.lookupMaybe(PDFName.of('ViewerPreferences'), PDFDict),
      ).toBeUndefined();

      expect(pdfDoc.getTitle()).toBe('Testing setTitle Title');
    });

    it('creates the ViewerPreferences dict when the option is set', async () => {
      const pdfDoc = await PDFDocument.create();

      pdfDoc.setTitle('ViewerPrefs Test Creation', {
        showInWindowTitleBar: true,
      });

      expect(
        pdfDoc.catalog.lookupMaybe(PDFName.of('ViewerPreferences'), PDFDict),
      );
    });
  });

  describe('addJavaScript() method', () => {
    it('adds the script to the catalog', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addJavaScript(
        'main',
        'console.show(); console.println("Hello World");',
      );
      await pdfDoc.flush();

      expect(pdfDoc.catalog.has(PDFName.of('Names')));
      const Names = pdfDoc.catalog.lookup(PDFName.of('Names'), PDFDict);
      expect(Names.has(PDFName.of('JavaScript')));
      const Javascript = Names.lookup(PDFName.of('JavaScript'), PDFDict);
      expect(Javascript.has(PDFName.of('Names')));
      const JSNames = Javascript.lookup(PDFName.of('Names'), PDFArray);
      expect(JSNames.lookup(0, PDFHexString).decodeText()).toEqual('main');
    });

    it('does not overwrite scripts', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addJavaScript(
        'first',
        'console.show(); console.println("First");',
      );
      pdfDoc.addJavaScript(
        'second',
        'console.show(); console.println("Second");',
      );
      await pdfDoc.flush();

      const Names = pdfDoc.catalog.lookup(PDFName.of('Names'), PDFDict);
      const Javascript = Names.lookup(PDFName.of('JavaScript'), PDFDict);
      const JSNames = Javascript.lookup(PDFName.of('Names'), PDFArray);
      expect(JSNames.lookup(0, PDFHexString).decodeText()).toEqual('first');
      expect(JSNames.lookup(2, PDFHexString).decodeText()).toEqual('second');
    });
  });

  describe('embedPng() method', () => {
    it('does not prevent the PDFDocument from being modified after embedding an image', async () => {
      const pdfDoc = await PDFDocument.create();
      const pdfPage = pdfDoc.addPage();

      const noErrorFunc = async () => {
        const embeddedImage = await pdfDoc.embedPng(examplePngImage);
        pdfPage.drawImage(embeddedImage);
        await embeddedImage.embed();

        const pdfPage2 = pdfDoc.addPage();
        pdfPage2.drawImage(embeddedImage);

        pdfDoc.setTitle('Unit Test');
      };

      await expect(noErrorFunc()).resolves.not.toThrowError();
    });
  });

  describe('save() method', () => {
    it('can called multiple times on the same PDFDocument with different changes', async () => {
      const pdfDoc = await PDFDocument.create();
      const embeddedImage = await pdfDoc.embedPng(examplePngImage);

      const noErrorFunc = async () => {
        const page1 = pdfDoc.addPage();
        page1.drawImage(embeddedImage);

        const pdfBytes1 = await pdfDoc.save();
        expect(pdfBytes1.byteLength).toBeGreaterThan(0);

        const page2 = pdfDoc.addPage();
        page2.drawImage(embeddedImage);

        pdfDoc.setTitle('Unit Test');

        const pdfBytes2 = await pdfDoc.save();
        expect(pdfBytes2.byteLength).toBeGreaterThan(0);
        expect(pdfBytes2.byteLength).not.toEqual(pdfBytes1.byteLength);

        const pdfPage3 = pdfDoc.addPage();
        pdfPage3.drawImage(embeddedImage);

        pdfDoc.setTitle('Unit Test 2. change');

        const pdfBytes3 = await pdfDoc.save();
        expect(pdfBytes3.byteLength).toBeGreaterThan(0);
        expect(pdfBytes3.byteLength).not.toEqual(pdfBytes2.byteLength);
      };

      await expect(noErrorFunc()).resolves.not.toThrowError();
    });
  });

  describe('copy() method', () => {
    let pdfDoc: PDFDocument;
    let srcDoc: PDFDocument;
    beforeAll(async () => {
      const parseSpeed = ParseSpeeds.Fastest;
      srcDoc = await PDFDocument.load(unencryptedPdfBytes, { parseSpeed });
      const title = '🥚 The Life of an Egg 🍳';
      const author = 'Humpty Dumpty';
      const subject = '📘 An Epic Tale of Woe 📖';
      const keywords = ['eggs', 'wall', 'fall', 'king', 'horses', 'men', '🥚'];
      const producer = 'PDF App 9000 🤖';
      const creator = 'PDF App 8000 🤖';

      // Milliseconds  will not get saved, so these dates do not have milliseconds.
      const creationDate = new Date('1997-08-15T01:58:37Z');
      const modificationDate = new Date('2018-12-21T07:00:11Z');

      srcDoc.setTitle(title);
      srcDoc.setAuthor(author);
      srcDoc.setSubject(subject);
      srcDoc.setKeywords(keywords);
      srcDoc.setProducer(producer);
      srcDoc.setCreator(creator);
      srcDoc.setCreationDate(creationDate);
      srcDoc.setModificationDate(modificationDate);
      pdfDoc = await srcDoc.copy();
    });

    it('Returns a pdf with the same number of pages', async () => {
      expect(pdfDoc.getPageCount()).toBe(srcDoc.getPageCount());
    });

    it('Can copy author, creationDate, creator, producer, subject, title, defaultWordBreaks', async () => {
      expect(pdfDoc.getAuthor()).toBe(srcDoc.getAuthor());
      expect(pdfDoc.getCreationDate()).toStrictEqual(srcDoc.getCreationDate());
      expect(pdfDoc.getCreator()).toBe(srcDoc.getCreator());
      expect(pdfDoc.getModificationDate()).toStrictEqual(
        srcDoc.getModificationDate(),
      );
      expect(pdfDoc.getProducer()).toBe(srcDoc.getProducer());
      expect(pdfDoc.getSubject()).toBe(srcDoc.getSubject());
      expect(pdfDoc.getTitle()).toBe(srcDoc.getTitle());
      expect(pdfDoc.defaultWordBreaks).toEqual(srcDoc.defaultWordBreaks);
    });
  });

  describe('attach() method', () => {
    it('Saves to the same value after attaching a file', async () => {
      const pdfDoc1 = await PDFDocument.create({ updateMetadata: false });
      const pdfDoc2 = await PDFDocument.create({ updateMetadata: false });

      const jpgAttachmentBytes = fs.readFileSync(
        'assets/images/cat_riding_unicorn.jpg',
      );
      const pdfAttachmentBytes = fs.readFileSync(
        'assets/pdfs/us_constitution.pdf',
      );

      await pdfDoc1.attach(jpgAttachmentBytes, 'cat_riding_unicorn.jpg', {
        mimeType: 'image/jpeg',
        description: 'Cool cat riding a unicorn! 🦄🐈🕶️',
        creationDate: new Date('2019/12/01'),
        modificationDate: new Date('2020/04/19'),
      });

      await pdfDoc1.attach(pdfAttachmentBytes, 'us_constitution.pdf', {
        mimeType: 'application/pdf',
        description: 'Constitution of the United States 🇺🇸🦅',
        creationDate: new Date('1787/09/17'),
        modificationDate: new Date('1992/05/07'),
      });

      await pdfDoc2.attach(jpgAttachmentBytes, 'cat_riding_unicorn.jpg', {
        mimeType: 'image/jpeg',
        description: 'Cool cat riding a unicorn! 🦄🐈🕶️',
        creationDate: new Date('2019/12/01'),
        modificationDate: new Date('2020/04/19'),
      });

      await pdfDoc2.attach(pdfAttachmentBytes, 'us_constitution.pdf', {
        mimeType: 'application/pdf',
        description: 'Constitution of the United States 🇺🇸🦅',
        creationDate: new Date('1787/09/17'),
        modificationDate: new Date('1992/05/07'),
      });

      const savedDoc1 = await pdfDoc1.save();
      const savedDoc2 = await pdfDoc2.save();

      expect(savedDoc1).toEqual(savedDoc2);
    });

    it('maintains lexical sort order for attachment names (Acrobat compatibility)', async () => {
      // PDF spec requires EmbeddedFiles Names array to be lexically sorted.
      // Acrobat Reader uses binary search, so unsorted names cause issues.
      const pdfDoc = await PDFDocument.create();

      // Add files in non-lexical order
      await pdfDoc.attach(Buffer.from('content3'), 'zebra.txt', {
        mimeType: 'text/plain',
      });
      await pdfDoc.attach(Buffer.from('content1'), 'alpha.txt', {
        mimeType: 'text/plain',
      });
      await pdfDoc.attach(Buffer.from('content2'), 'middle.txt', {
        mimeType: 'text/plain',
      });

      // Save and reload to ensure the sort order is persisted
      const savedBytes = await pdfDoc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);

      // Get the Names array directly from the PDF structure
      const Names = loadedDoc.catalog.lookup(PDFName.of('Names'), PDFDict);
      const EmbeddedFiles = Names.lookup(PDFName.of('EmbeddedFiles'), PDFDict);
      const EFNames = EmbeddedFiles.lookup(PDFName.of('Names'), PDFArray);

      // Extract names in order from the array (names are at even indices)
      const names: string[] = [];
      for (let i = 0; i < EFNames.size(); i += 2) {
        const nameObj = EFNames.get(i);
        if (nameObj instanceof PDFHexString) {
          names.push(nameObj.decodeText());
        }
      }

      // Verify the names are lexically sorted
      expect(names).toEqual(['alpha.txt', 'middle.txt', 'zebra.txt']);
    });

    it('inserts attachments at correct sorted position', async () => {
      const pdfDoc = await PDFDocument.create();

      // Add files that test various positions
      await pdfDoc.attach(Buffer.from('2'), '2.txt', { mimeType: 'text/plain' });
      await pdfDoc.attach(Buffer.from('1'), '1.txt', { mimeType: 'text/plain' }); // Insert at beginning
      await pdfDoc.attach(Buffer.from('10'), '10.txt', { mimeType: 'text/plain' }); // Lexically between "1" and "2"
      await pdfDoc.attach(Buffer.from('3'), '3.txt', { mimeType: 'text/plain' }); // Insert at end

      const savedBytes = await pdfDoc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);

      const Names = loadedDoc.catalog.lookup(PDFName.of('Names'), PDFDict);
      const EmbeddedFiles = Names.lookup(PDFName.of('EmbeddedFiles'), PDFDict);
      const EFNames = EmbeddedFiles.lookup(PDFName.of('Names'), PDFArray);

      const names: string[] = [];
      for (let i = 0; i < EFNames.size(); i += 2) {
        const nameObj = EFNames.get(i);
        if (nameObj instanceof PDFHexString) {
          names.push(nameObj.decodeText());
        }
      }

      // Lexical sort: "1.txt" < "10.txt" < "2.txt" < "3.txt"
      expect(names).toEqual(['1.txt', '10.txt', '2.txt', '3.txt']);
    });
  });

  describe('getAttachments() method', () => {
    it('Can read attachments from an existing pdf file', async () => {
      const pdfDoc = await PDFDocument.load(hasAttachmentPdfBytes);
      const attachments = pdfDoc.getAttachments();
      expect(attachments.length).toEqual(2);
      const jpgAttachment = attachments.find(
        (attachment) => attachment.name === 'cat_riding_unicorn.jpg',
      )!;
      const pdfAttachment = attachments.find(
        (attachment) => attachment.name === 'us_constitution.pdf',
      )!;
      expect(pdfAttachment).toBeDefined();
      expect(jpgAttachment).toBeDefined();
      expect(jpgAttachment.description).toBe(
        'Cool cat riding a unicorn! 🦄🐈🕶️',
      );
      expect(pdfAttachment.description).toBe(
        'Constitution of the United States 🇺🇸🦅',
      );
      expect(jpgAttachment.mimeType).toBe('image/jpeg');
      expect(pdfAttachment.mimeType).toBe('application/pdf');
      expect(jpgAttachment.afRelationship).not.toBeDefined();
      expect(pdfAttachment.afRelationship).not.toBeDefined();
      const jpgAttachmentBytes = fs.readFileSync(
        'assets/images/cat_riding_unicorn.jpg',
      );
      const pdfAttachmentBytes = fs.readFileSync(
        'assets/pdfs/us_constitution.pdf',
      );
      expect(jpgAttachmentBytes).toEqual(Buffer.from(jpgAttachment.data));
      expect(pdfAttachmentBytes).toEqual(Buffer.from(pdfAttachment.data));
    });

    it('Can get saved and unsaved attachments', async () => {
      const pdfDoc = await PDFDocument.load(hasAttachmentPdfBytes);
      const haiku = `Cradled in silence,
      sunlight warms the fragile shell —
      breakfast is reborn.`;
      const creationDate = new Date(Date.now() - 60 * 60 * 1000);
      const modificationDate = new Date();
      await pdfDoc.attach(Buffer.from(haiku), 'haiku.txt', {
        mimeType: 'text/plain',
        description: '🥚 Haikus are short. So is the life of an egg. 🍳',
        afRelationship: AFRelationship.Supplement,
        creationDate,
        modificationDate,
      });
      await pdfDoc.attach(examplePngImage, 'example.png', {
        mimeType: 'image/png',
        description: 'An example image',
        afRelationship: AFRelationship.Alternative,
        creationDate,
        modificationDate,
      });

      const attachments = pdfDoc.getAttachments();
      expect(attachments.length).toEqual(4);
      const jpgAttachment = attachments.find(
        (attachment) => attachment.name === 'cat_riding_unicorn.jpg',
      )!;
      const pdfAttachment = attachments.find(
        (attachment) => attachment.name === 'us_constitution.pdf',
      )!;
      const txtAttachment = attachments.find(
        (attachment) => attachment.name === 'haiku.txt',
      )!;
      const pngAttachment = attachments.find(
        (attachment) => attachment.name === 'example.png',
      )!;
      expect(pdfAttachment).toBeDefined();
      expect(jpgAttachment).toBeDefined();
      expect(txtAttachment).toBeDefined();
      expect(jpgAttachment.description).toBe(
        'Cool cat riding a unicorn! 🦄🐈🕶️',
      );
      expect(pdfAttachment.description).toBe(
        'Constitution of the United States 🇺🇸🦅',
      );
      expect(txtAttachment.description).toBe(
        '🥚 Haikus are short. So is the life of an egg. 🍳',
      );
      expect(pngAttachment.description).toBe('An example image');
      expect(jpgAttachment.mimeType).toBe('image/jpeg');
      expect(pdfAttachment.mimeType).toBe('application/pdf');
      expect(txtAttachment.mimeType).toBe('text/plain');
      expect(pngAttachment.mimeType).toBe('image/png');
      expect(jpgAttachment.afRelationship).not.toBeDefined();
      expect(pdfAttachment.afRelationship).not.toBeDefined();
      expect(txtAttachment.afRelationship).toBe(AFRelationship.Supplement);
      expect(pngAttachment.afRelationship).toBe(AFRelationship.Alternative);
      const jpgAttachmentBytes = fs.readFileSync(
        'assets/images/cat_riding_unicorn.jpg',
      );
      const pdfAttachmentBytes = fs.readFileSync(
        'assets/pdfs/us_constitution.pdf',
      );
      expect(jpgAttachmentBytes).toEqual(Buffer.from(jpgAttachment.data));
      expect(pdfAttachmentBytes).toEqual(Buffer.from(pdfAttachment.data));
      expect(new TextDecoder().decode(txtAttachment.data)).toBe(haiku);
      const expectedImageBytes = Uint8Array.from(
        atob(examplePngImageBase64),
        (c) => c.charCodeAt(0),
      );
      expect(pngAttachment.data).toEqual(expectedImageBytes);
      expect(jpgAttachment.creationDate).toBeDefined();
      expect(pdfAttachment.creationDate).toBeDefined();
      expect(txtAttachment.creationDate).toBe(creationDate);
      expect(pngAttachment.creationDate).toBe(creationDate);
      expect(jpgAttachment.modificationDate).toBeDefined();
      expect(pdfAttachment.modificationDate).toBeDefined();
      expect(txtAttachment.modificationDate).toBe(modificationDate);
      expect(pngAttachment.modificationDate).toBe(modificationDate);
    });

    describe('allow attachment data to be passed in different formats', () => {
      let pdfDoc: PDFDocument;
      const mimeType = 'text/plain';
      const description = '🥚 Haikus are short. So is the life of an egg. 🍳';
      const attachment = `Cradled in silence,
  sunlight warms the fragile shell —
  breakfast is reborn.`;
      const afRelationship = AFRelationship.Alternative;
      let attachments: PDFAttachment[];

      beforeAll(async () => {
        const parseSpeed = ParseSpeeds.Fastest;
        pdfDoc = await PDFDocument.load(unencryptedPdfBytes, { parseSpeed });
        const base64 = Buffer.from(attachment).toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;

        await pdfDoc.attach(dataUrl, 'string.txt', {
          mimeType,
          description,
          afRelationship,
        });

        await pdfDoc.attach(
          new TextEncoder().encode(attachment),
          'uint8array.txt',
          {
            mimeType,
            description,
            afRelationship,
          },
        );

        await pdfDoc.attach(Buffer.from(attachment), 'buffer.txt', {
          mimeType,
          description,
          afRelationship,
        });

        const pdfBytes = await pdfDoc.save();
        pdfDoc = await PDFDocument.load(pdfBytes);
        attachments = pdfDoc.getAttachments();
      });

      it('should attach 3 attachments', () => {
        expect(attachments).toHaveLength(3);
      });

      it('should attach data URL attachments', () => {
        const stringAttachments = attachments.filter(
          (a) => a.name === 'string.txt',
        );
        expect(stringAttachments.length).toBe(1);
        const extracted = new TextDecoder().decode(stringAttachments[0].data);
        expect(extracted).toEqual(attachment);
        expect(stringAttachments[0].mimeType).toBe(mimeType);
        expect(stringAttachments[0].afRelationship).toBe(afRelationship);
        expect(stringAttachments[0].description).toBe(description);
      });

      it('should attach Uint8Array attachments', () => {
        const stringAttachments = attachments.filter(
          (a) => a.name === 'uint8array.txt',
        );
        expect(stringAttachments.length).toBe(1);
        const extracted = new TextDecoder().decode(stringAttachments[0].data);
        expect(extracted).toEqual(attachment);
        expect(stringAttachments[0].mimeType).toBe(mimeType);
        expect(stringAttachments[0].afRelationship).toBe(afRelationship);
        expect(stringAttachments[0].description).toBe(description);
      });

      it('should attach buffer attachments', () => {
        const stringAttachments = attachments.filter(
          (a) => a.name === 'buffer.txt',
        );
        expect(stringAttachments.length).toBe(1);
        const extracted = new TextDecoder().decode(stringAttachments[0].data);
        expect(extracted).toEqual(attachment);
        expect(stringAttachments[0].mimeType).toBe(mimeType);
        expect(stringAttachments[0].afRelationship).toBe(afRelationship);
        expect(stringAttachments[0].description).toBe(description);
      });
    });
  });

  describe('detach() method', () => {
    it('removes the specified attachment', async () => {
      const pdfDoc = await PDFDocument.load(hasAttachmentPdfBytes);
      let attachments = pdfDoc.getAttachments();
      expect(attachments.length).toEqual(2);

      pdfDoc.detach('cat_riding_unicorn.jpg');
      attachments = pdfDoc.getAttachments();
      expect(attachments.length).toEqual(1);
      expect(attachments[0].name).toEqual('us_constitution.pdf');

      pdfDoc.detach('us_constitution.pdf');
      attachments = pdfDoc.getAttachments();
      expect(attachments.length).toEqual(0);
    });

    it('removes the attachment after saving', async () => {
      const pdfDoc = await PDFDocument.load(hasAttachmentPdfBytes);
      pdfDoc.attach(examplePngImage, 'example.png', {
        mimeType: 'image/png',
        description: 'An example image',
      });
      await pdfDoc.saveAsBase64();
      let attachments = pdfDoc.getAttachments();
      expect(attachments.length).toEqual(3);
      pdfDoc.detach('example.png');
      attachments = pdfDoc.getAttachments();
      expect(attachments.length).toEqual(2);
    });

    it('does nothing if the specified attachment is not found', async () => {
      const pdfDoc = await PDFDocument.load(hasAttachmentPdfBytes);
      let attachments = pdfDoc.getAttachments();
      expect(attachments.length).toEqual(2);

      pdfDoc.detach('not_existing.txt');
      attachments = pdfDoc.getAttachments();
      expect(attachments.length).toEqual(2);
    });
  });

  describe('Page operations behavioral tests', () => {
    describe('addPage()', () => {
      it('increases getPageCount() by 1 each time', async () => {
        const doc = await PDFDocument.create();
        expect(doc.getPageCount()).toBe(0);

        doc.addPage();
        expect(doc.getPageCount()).toBe(1);

        doc.addPage();
        expect(doc.getPageCount()).toBe(2);

        doc.addPage();
        expect(doc.getPageCount()).toBe(3);
      });

      it('creates a default A4 page when called with no arguments', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage();

        expect(page.getWidth()).toBeCloseTo(595.28, 1);
        expect(page.getHeight()).toBeCloseTo(841.89, 1);
      });

      it('creates a page with the specified dimensions when given [width, height]', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage([300, 500]);

        expect(page.getWidth()).toBe(300);
        expect(page.getHeight()).toBe(500);
      });

      it('creates a page with PageSizes.Letter dimensions', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage(PageSizes.Letter);

        expect(page.getWidth()).toBe(612.0);
        expect(page.getHeight()).toBe(792.0);
      });

      it('appends the page to the end of the document', async () => {
        const doc = await PDFDocument.create();
        doc.addPage([100, 200]);
        doc.addPage([300, 400]);
        doc.addPage([500, 600]);

        const pages = doc.getPages();
        expect(pages).toHaveLength(3);
        expect(pages[0].getWidth()).toBe(100);
        expect(pages[0].getHeight()).toBe(200);
        expect(pages[1].getWidth()).toBe(300);
        expect(pages[1].getHeight()).toBe(400);
        expect(pages[2].getWidth()).toBe(500);
        expect(pages[2].getHeight()).toBe(600);
      });

      it('returns the newly created PDFPage instance', async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage([250, 350]);

        expect(page).toBeInstanceOf(PDFPage);
        expect(page.getWidth()).toBe(250);
        expect(page.getHeight()).toBe(350);
      });
    });

    describe('insertPage()', () => {
      it('inserts a page at the beginning when index is 0', async () => {
        const doc = await PDFDocument.create();
        doc.addPage([100, 200]);
        doc.addPage([300, 400]);

        doc.insertPage(0, [500, 600]);

        const pages = doc.getPages();
        expect(pages).toHaveLength(3);
        expect(pages[0].getWidth()).toBe(500);
        expect(pages[0].getHeight()).toBe(600);
        expect(pages[1].getWidth()).toBe(100);
        expect(pages[1].getHeight()).toBe(200);
        expect(pages[2].getWidth()).toBe(300);
        expect(pages[2].getHeight()).toBe(400);
      });

      it('inserts a page in the middle at the specified index', async () => {
        const doc = await PDFDocument.create();
        doc.addPage([100, 200]);
        doc.addPage([300, 400]);

        doc.insertPage(1, [500, 600]);

        const pages = doc.getPages();
        expect(pages).toHaveLength(3);
        expect(pages[0].getWidth()).toBe(100);
        expect(pages[0].getHeight()).toBe(200);
        expect(pages[1].getWidth()).toBe(500);
        expect(pages[1].getHeight()).toBe(600);
        expect(pages[2].getWidth()).toBe(300);
        expect(pages[2].getHeight()).toBe(400);
      });

      it('inserts a page at the end when index equals page count', async () => {
        const doc = await PDFDocument.create();
        doc.addPage([100, 200]);
        doc.addPage([300, 400]);

        doc.insertPage(2, [500, 600]);

        const pages = doc.getPages();
        expect(pages).toHaveLength(3);
        expect(pages[2].getWidth()).toBe(500);
        expect(pages[2].getHeight()).toBe(600);
      });

      it('increases the page count by 1', async () => {
        const doc = await PDFDocument.create();
        doc.addPage();
        expect(doc.getPageCount()).toBe(1);

        doc.insertPage(0);
        expect(doc.getPageCount()).toBe(2);

        doc.insertPage(1);
        expect(doc.getPageCount()).toBe(3);
      });

      it('creates a default A4 page when no page argument is given', async () => {
        const doc = await PDFDocument.create();
        const page = doc.insertPage(0);

        expect(page.getWidth()).toBeCloseTo(595.28, 1);
        expect(page.getHeight()).toBeCloseTo(841.89, 1);
      });
    });

    describe('removePage()', () => {
      it('decreases the page count by 1', async () => {
        const doc = await PDFDocument.create();
        doc.addPage([100, 200]);
        doc.addPage([300, 400]);
        doc.addPage([500, 600]);
        expect(doc.getPageCount()).toBe(3);

        doc.removePage(1);
        expect(doc.getPageCount()).toBe(2);
      });

      it('removes the correct page (first page)', async () => {
        const doc = await PDFDocument.create();
        doc.addPage([100, 200]);
        doc.addPage([300, 400]);
        doc.addPage([500, 600]);

        doc.removePage(0);

        const pages = doc.getPages();
        expect(pages).toHaveLength(2);
        expect(pages[0].getWidth()).toBe(300);
        expect(pages[0].getHeight()).toBe(400);
        expect(pages[1].getWidth()).toBe(500);
        expect(pages[1].getHeight()).toBe(600);
      });

      it('removes the correct page (middle page)', async () => {
        const doc = await PDFDocument.create();
        doc.addPage([100, 200]);
        doc.addPage([300, 400]);
        doc.addPage([500, 600]);

        doc.removePage(1);

        const pages = doc.getPages();
        expect(pages).toHaveLength(2);
        expect(pages[0].getWidth()).toBe(100);
        expect(pages[0].getHeight()).toBe(200);
        expect(pages[1].getWidth()).toBe(500);
        expect(pages[1].getHeight()).toBe(600);
      });

      it('removes the correct page (last page)', async () => {
        const doc = await PDFDocument.create();
        doc.addPage([100, 200]);
        doc.addPage([300, 400]);
        doc.addPage([500, 600]);

        doc.removePage(2);

        const pages = doc.getPages();
        expect(pages).toHaveLength(2);
        expect(pages[0].getWidth()).toBe(100);
        expect(pages[0].getHeight()).toBe(200);
        expect(pages[1].getWidth()).toBe(300);
        expect(pages[1].getHeight()).toBe(400);
      });

      it('removes all pages one by one until the document is empty', async () => {
        const doc = await PDFDocument.create();
        doc.addPage([100, 200]);
        doc.addPage([300, 400]);

        doc.removePage(0);
        expect(doc.getPageCount()).toBe(1);
        expect(doc.getPages()[0].getWidth()).toBe(300);

        doc.removePage(0);
        expect(doc.getPageCount()).toBe(0);
        expect(doc.getPages()).toHaveLength(0);
      });

      it('throws when removing from an empty document', async () => {
        const doc = await PDFDocument.create();
        expect(() => doc.removePage(0)).toThrow();
      });

      it('throws when index is out of range', async () => {
        const doc = await PDFDocument.create();
        doc.addPage();
        doc.addPage();

        expect(() => doc.removePage(2)).toThrow();
        expect(() => doc.removePage(-1)).toThrow();
      });
    });

    describe('getPages()', () => {
      it('returns an empty array for a new document', async () => {
        const doc = await PDFDocument.create();
        const pages = doc.getPages();

        expect(pages).toHaveLength(0);
        expect(Array.isArray(pages)).toBe(true);
      });

      it('returns correct number of pages after additions', async () => {
        const doc = await PDFDocument.create();
        doc.addPage();
        doc.addPage();
        doc.addPage();

        const pages = doc.getPages();
        expect(pages).toHaveLength(3);
      });

      it('returns pages in document order', async () => {
        const doc = await PDFDocument.create();
        doc.addPage([100, 100]);
        doc.addPage([200, 200]);
        doc.addPage([300, 300]);

        const pages = doc.getPages();
        expect(pages[0].getWidth()).toBe(100);
        expect(pages[1].getWidth()).toBe(200);
        expect(pages[2].getWidth()).toBe(300);
      });

      it('reflects insertions correctly', async () => {
        const doc = await PDFDocument.create();
        doc.addPage([100, 100]);
        doc.addPage([300, 300]);
        doc.insertPage(1, [200, 200]);

        const pages = doc.getPages();
        expect(pages).toHaveLength(3);
        expect(pages[0].getWidth()).toBe(100);
        expect(pages[1].getWidth()).toBe(200);
        expect(pages[2].getWidth()).toBe(300);
      });
    });

    describe('getPage()', () => {
      it('returns the page at a specific index', async () => {
        const doc = await PDFDocument.create();
        doc.addPage([100, 200]);
        doc.addPage([300, 400]);
        doc.addPage([500, 600]);

        const page0 = doc.getPage(0);
        expect(page0.getWidth()).toBe(100);
        expect(page0.getHeight()).toBe(200);

        const page1 = doc.getPage(1);
        expect(page1.getWidth()).toBe(300);
        expect(page1.getHeight()).toBe(400);

        const page2 = doc.getPage(2);
        expect(page2.getWidth()).toBe(500);
        expect(page2.getHeight()).toBe(600);
      });

      it('returns a PDFPage instance', async () => {
        const doc = await PDFDocument.create();
        doc.addPage();

        const page = doc.getPage(0);
        expect(page).toBeInstanceOf(PDFPage);
      });

      it('throws when index is out of range', async () => {
        const doc = await PDFDocument.create();
        doc.addPage();

        expect(() => doc.getPage(1)).toThrow();
        expect(() => doc.getPage(-1)).toThrow();
      });
    });

    describe('getPageIndices()', () => {
      it('returns an empty array for a new document', async () => {
        const doc = await PDFDocument.create();
        expect(doc.getPageIndices()).toEqual([]);
      });

      it('returns [0] for a document with one page', async () => {
        const doc = await PDFDocument.create();
        doc.addPage();
        expect(doc.getPageIndices()).toEqual([0]);
      });

      it('returns [0, 1, 2] for a document with three pages', async () => {
        const doc = await PDFDocument.create();
        doc.addPage();
        doc.addPage();
        doc.addPage();
        expect(doc.getPageIndices()).toEqual([0, 1, 2]);
      });

      it('reflects removals correctly', async () => {
        const doc = await PDFDocument.create();
        doc.addPage();
        doc.addPage();
        doc.addPage();
        expect(doc.getPageIndices()).toEqual([0, 1, 2]);

        doc.removePage(1);
        expect(doc.getPageIndices()).toEqual([0, 1]);
      });

      it('reflects insertions correctly', async () => {
        const doc = await PDFDocument.create();
        doc.addPage();
        doc.insertPage(0);
        doc.addPage();
        expect(doc.getPageIndices()).toEqual([0, 1, 2]);
      });
    });

    describe('copyPages()', () => {
      it('copies pages from another document with matching dimensions', async () => {
        const srcDoc = await PDFDocument.create();
        srcDoc.addPage([111, 222]);
        srcDoc.addPage([333, 444]);
        srcDoc.addPage([555, 666]);

        const destDoc = await PDFDocument.create();
        const copiedPages = await destDoc.copyPages(srcDoc, [0, 1, 2]);

        expect(copiedPages).toHaveLength(3);
        expect(copiedPages[0].getWidth()).toBe(111);
        expect(copiedPages[0].getHeight()).toBe(222);
        expect(copiedPages[1].getWidth()).toBe(333);
        expect(copiedPages[1].getHeight()).toBe(444);
        expect(copiedPages[2].getWidth()).toBe(555);
        expect(copiedPages[2].getHeight()).toBe(666);
      });

      it('allows adding copied pages to the destination document', async () => {
        const srcDoc = await PDFDocument.create();
        srcDoc.addPage([111, 222]);
        srcDoc.addPage([333, 444]);

        const destDoc = await PDFDocument.create();
        const [page1, page2] = await destDoc.copyPages(srcDoc, [0, 1]);

        destDoc.addPage(page1);
        destDoc.addPage(page2);

        expect(destDoc.getPageCount()).toBe(2);
        expect(destDoc.getPage(0).getWidth()).toBe(111);
        expect(destDoc.getPage(0).getHeight()).toBe(222);
        expect(destDoc.getPage(1).getWidth()).toBe(333);
        expect(destDoc.getPage(1).getHeight()).toBe(444);
      });

      it('copies a subset of pages', async () => {
        const srcDoc = await PDFDocument.create();
        srcDoc.addPage([100, 100]);
        srcDoc.addPage([200, 200]);
        srcDoc.addPage([300, 300]);

        const destDoc = await PDFDocument.create();
        const copiedPages = await destDoc.copyPages(srcDoc, [0, 2]);

        expect(copiedPages).toHaveLength(2);
        expect(copiedPages[0].getWidth()).toBe(100);
        expect(copiedPages[1].getWidth()).toBe(300);
      });

      it('does not modify the source document page count', async () => {
        const srcDoc = await PDFDocument.create();
        srcDoc.addPage([100, 200]);
        srcDoc.addPage([300, 400]);

        const destDoc = await PDFDocument.create();
        await destDoc.copyPages(srcDoc, [0, 1]);

        expect(srcDoc.getPageCount()).toBe(2);
      });

      it('copied pages can be inserted at specific positions', async () => {
        const srcDoc = await PDFDocument.create();
        srcDoc.addPage([999, 888]);

        const destDoc = await PDFDocument.create();
        destDoc.addPage([100, 100]);
        destDoc.addPage([200, 200]);

        const [copiedPage] = await destDoc.copyPages(srcDoc, [0]);
        destDoc.insertPage(1, copiedPage);

        expect(destDoc.getPageCount()).toBe(3);
        expect(destDoc.getPage(0).getWidth()).toBe(100);
        expect(destDoc.getPage(1).getWidth()).toBe(999);
        expect(destDoc.getPage(1).getHeight()).toBe(888);
        expect(destDoc.getPage(2).getWidth()).toBe(200);
      });
    });
  });

  describe('registerFontkit validation', () => {
    it('throws InvalidFontkitError when passed null', async () => {
      const doc = await PDFDocument.create();
      expect(() => doc.registerFontkit(null as any)).toThrow(
        /Invalid fontkit instance/,
      );
    });

    it('throws InvalidFontkitError when passed undefined', async () => {
      const doc = await PDFDocument.create();
      expect(() => doc.registerFontkit(undefined as any)).toThrow(
        /Invalid fontkit instance/,
      );
    });

    it('throws InvalidFontkitError when passed a non-object', async () => {
      const doc = await PDFDocument.create();
      expect(() => doc.registerFontkit('not-fontkit' as any)).toThrow(
        /Invalid fontkit instance/,
      );
    });

    it('throws InvalidFontkitError when passed an object without create method', async () => {
      const doc = await PDFDocument.create();
      expect(() => doc.registerFontkit({} as any)).toThrow(
        /Invalid fontkit instance/,
      );
    });

    it('throws InvalidFontkitError when create is not a function', async () => {
      const doc = await PDFDocument.create();
      expect(() => doc.registerFontkit({ create: 'not-a-function' } as any)).toThrow(
        /Invalid fontkit instance/,
      );
    });

    it('accepts a valid fontkit instance', async () => {
      const doc = await PDFDocument.create();
      expect(() => doc.registerFontkit(fontkit)).not.toThrow();
    });
  });

  describe('Metadata round-trip tests', () => {
    it('setTitle / getTitle round-trips correctly', async () => {
      const doc = await PDFDocument.create();
      expect(doc.getTitle()).toBeUndefined();

      doc.setTitle('My Test PDF');
      expect(doc.getTitle()).toBe('My Test PDF');

      doc.setTitle('Updated Title');
      expect(doc.getTitle()).toBe('Updated Title');
    });

    it('setAuthor / getAuthor round-trips correctly', async () => {
      const doc = await PDFDocument.create();
      expect(doc.getAuthor()).toBeUndefined();

      doc.setAuthor('John Doe');
      expect(doc.getAuthor()).toBe('John Doe');

      doc.setAuthor('Jane Smith');
      expect(doc.getAuthor()).toBe('Jane Smith');
    });

    it('setAuthor handles German umlauts correctly', async () => {
      const doc = await PDFDocument.create();
      doc.addPage();

      const author = 'Hülögü Ätölü';
      doc.setAuthor(author);
      expect(doc.getAuthor()).toBe(author);

      // Verify persistence through save/load cycle
      const bytes = await doc.save();
      const loaded = await PDFDocument.load(bytes);
      expect(loaded.getAuthor()).toBe(author);
    });

    it('setSubject / getSubject round-trips correctly', async () => {
      const doc = await PDFDocument.create();
      expect(doc.getSubject()).toBeUndefined();

      doc.setSubject('Test Subject');
      expect(doc.getSubject()).toBe('Test Subject');
    });

    it('setKeywords / getKeywords round-trips correctly', async () => {
      const doc = await PDFDocument.create();
      expect(doc.getKeywords()).toBeUndefined();

      doc.setKeywords(['pdf', 'test', 'library']);
      expect(doc.getKeywords()).toBe('pdf test library');
    });

    it('setProducer / getProducer round-trips correctly', async () => {
      const doc = await PDFDocument.create();
      // Default producer is set by updateInfoDict
      expect(doc.getProducer()).toBe(
        'pdf-lib (https://github.com/Hopding/pdf-lib)',
      );

      doc.setProducer('Custom Producer v2.0');
      expect(doc.getProducer()).toBe('Custom Producer v2.0');
    });

    it('setCreator / getCreator round-trips correctly', async () => {
      const doc = await PDFDocument.create();
      // Default creator is set by updateInfoDict
      expect(doc.getCreator()).toBe(
        'pdf-lib (https://github.com/Hopding/pdf-lib)',
      );

      doc.setCreator('Custom Creator App');
      expect(doc.getCreator()).toBe('Custom Creator App');
    });

    it('setCreationDate / getCreationDate round-trips correctly', async () => {
      const doc = await PDFDocument.create();
      // Default creation date is set by updateInfoDict, so it exists
      expect(doc.getCreationDate()).toBeInstanceOf(Date);

      const customDate = new Date('2000-06-15T12:30:00Z');
      doc.setCreationDate(customDate);
      expect(doc.getCreationDate()).toEqual(customDate);
    });

    it('setModificationDate / getModificationDate round-trips correctly', async () => {
      const doc = await PDFDocument.create();
      // Default mod date is set by updateInfoDict, so it exists
      expect(doc.getModificationDate()).toBeInstanceOf(Date);

      const customDate = new Date('2020-03-25T08:15:00Z');
      doc.setModificationDate(customDate);
      expect(doc.getModificationDate()).toEqual(customDate);
    });

    it('setLanguage / getLanguage round-trips correctly', async () => {
      const doc = await PDFDocument.create();
      expect(doc.getLanguage()).toBeUndefined();

      doc.setLanguage('en-US');
      expect(doc.getLanguage()).toBe('en-US');

      doc.setLanguage('de-DE');
      expect(doc.getLanguage()).toBe('de-DE');
    });

    it('handles unicode metadata values', async () => {
      const doc = await PDFDocument.create();

      doc.setTitle('Titre du document');
      doc.setAuthor('Auteur avec accents');
      doc.setSubject('Sujet en japonais');

      expect(doc.getTitle()).toBe('Titre du document');
      expect(doc.getAuthor()).toBe('Auteur avec accents');
      expect(doc.getSubject()).toBe('Sujet en japonais');
    });
  });

  describe('Save and load round-trip tests', () => {
    it('preserves page count through save/load cycle', async () => {
      const doc = await PDFDocument.create();
      doc.addPage([100, 200]);
      doc.addPage([300, 400]);
      doc.addPage([500, 600]);

      const savedBytes = await doc.save({ addDefaultPage: false });
      const loadedDoc = await PDFDocument.load(savedBytes);

      expect(loadedDoc.getPageCount()).toBe(3);
    });

    it('preserves page dimensions through save/load cycle', async () => {
      const doc = await PDFDocument.create();
      doc.addPage([100, 200]);
      doc.addPage([300, 400]);
      doc.addPage([500, 600]);

      const savedBytes = await doc.save({ addDefaultPage: false });
      const loadedDoc = await PDFDocument.load(savedBytes);

      expect(loadedDoc.getPage(0).getWidth()).toBe(100);
      expect(loadedDoc.getPage(0).getHeight()).toBe(200);
      expect(loadedDoc.getPage(1).getWidth()).toBe(300);
      expect(loadedDoc.getPage(1).getHeight()).toBe(400);
      expect(loadedDoc.getPage(2).getWidth()).toBe(500);
      expect(loadedDoc.getPage(2).getHeight()).toBe(600);
    });

    it('preserves PageSizes.Letter dimensions through save/load cycle', async () => {
      const doc = await PDFDocument.create();
      doc.addPage(PageSizes.Letter);

      const savedBytes = await doc.save({ addDefaultPage: false });
      const loadedDoc = await PDFDocument.load(savedBytes);

      expect(loadedDoc.getPage(0).getWidth()).toBe(612.0);
      expect(loadedDoc.getPage(0).getHeight()).toBe(792.0);
    });

    it('preserves title metadata through save/load cycle', async () => {
      const doc = await PDFDocument.create();
      doc.setTitle('Persistent Title');

      const savedBytes = await doc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);

      expect(loadedDoc.getTitle()).toBe('Persistent Title');
    });

    it('preserves author metadata through save/load cycle', async () => {
      const doc = await PDFDocument.create();
      doc.setAuthor('Persistent Author');

      const savedBytes = await doc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);

      expect(loadedDoc.getAuthor()).toBe('Persistent Author');
    });

    it('preserves subject metadata through save/load cycle', async () => {
      const doc = await PDFDocument.create();
      doc.setSubject('Persistent Subject');

      const savedBytes = await doc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);

      expect(loadedDoc.getSubject()).toBe('Persistent Subject');
    });

    it('preserves keywords metadata through save/load cycle', async () => {
      const doc = await PDFDocument.create();
      doc.setKeywords(['keyword1', 'keyword2', 'keyword3']);

      const savedBytes = await doc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);

      expect(loadedDoc.getKeywords()).toBe('keyword1 keyword2 keyword3');
    });

    it('preserves producer metadata through save/load cycle', async () => {
      const doc = await PDFDocument.create();
      doc.setProducer('My Custom Producer');

      const savedBytes = await doc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);

      expect(loadedDoc.getProducer()).toBe('My Custom Producer');
    });

    it('preserves creator metadata through save/load cycle', async () => {
      const doc = await PDFDocument.create();
      doc.setCreator('My Custom Creator');

      const savedBytes = await doc.save();
      const loadedDoc = await PDFDocument.load(savedBytes);

      expect(loadedDoc.getCreator()).toBe('My Custom Creator');
    });

    it('preserves creation date through save/load cycle', async () => {
      const doc = await PDFDocument.create();
      const creationDate = new Date('2005-11-20T10:30:00Z');
      doc.setCreationDate(creationDate);

      const savedBytes = await doc.save();
      const loadedDoc = await PDFDocument.load(savedBytes, {
        updateMetadata: false,
      });

      expect(loadedDoc.getCreationDate()).toEqual(creationDate);
    });

    it('preserves modification date through save/load cycle', async () => {
      const doc = await PDFDocument.create();
      const modDate = new Date('2023-01-15T14:00:00Z');
      doc.setModificationDate(modDate);

      const savedBytes = await doc.save();
      const loadedDoc = await PDFDocument.load(savedBytes, {
        updateMetadata: false,
      });

      expect(loadedDoc.getModificationDate()).toEqual(modDate);
    });

    it('preserves all metadata fields through save/load cycle', async () => {
      const doc = await PDFDocument.create();
      const title = 'Full Round-Trip Title';
      const author = 'Full Round-Trip Author';
      const subject = 'Full Round-Trip Subject';
      const keywords = ['roundtrip', 'test', 'pdf'];
      const producer = 'Full Round-Trip Producer';
      const creator = 'Full Round-Trip Creator';
      const creationDate = new Date('1999-12-31T23:59:00Z');
      const modificationDate = new Date('2024-06-15T12:00:00Z');

      doc.setTitle(title);
      doc.setAuthor(author);
      doc.setSubject(subject);
      doc.setKeywords(keywords);
      doc.setProducer(producer);
      doc.setCreator(creator);
      doc.setCreationDate(creationDate);
      doc.setModificationDate(modificationDate);

      const savedBytes = await doc.save();
      const loaded = await PDFDocument.load(savedBytes, {
        updateMetadata: false,
      });

      expect(loaded.getTitle()).toBe(title);
      expect(loaded.getAuthor()).toBe(author);
      expect(loaded.getSubject()).toBe(subject);
      expect(loaded.getKeywords()).toBe(keywords.join(' '));
      expect(loaded.getProducer()).toBe(producer);
      expect(loaded.getCreator()).toBe(creator);
      expect(loaded.getCreationDate()).toEqual(creationDate);
      expect(loaded.getModificationDate()).toEqual(modificationDate);
    });

    it('saves and loads pages added with different PageSizes', async () => {
      const doc = await PDFDocument.create();
      doc.addPage(PageSizes.A4);
      doc.addPage(PageSizes.Letter);
      doc.addPage(PageSizes.Legal);

      const savedBytes = await doc.save({ addDefaultPage: false });
      const loaded = await PDFDocument.load(savedBytes);

      expect(loaded.getPageCount()).toBe(3);

      expect(loaded.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
      expect(loaded.getPage(0).getHeight()).toBeCloseTo(841.89, 1);

      expect(loaded.getPage(1).getWidth()).toBe(612.0);
      expect(loaded.getPage(1).getHeight()).toBe(792.0);

      expect(loaded.getPage(2).getWidth()).toBe(612.0);
      expect(loaded.getPage(2).getHeight()).toBe(1008.0);
    });

    it('handles a double save/load cycle preserving pages and metadata', async () => {
      const doc = await PDFDocument.create();
      doc.addPage([150, 250]);
      doc.setTitle('Double Cycle Title');
      doc.setAuthor('Double Cycle Author');

      const bytes1 = await doc.save({ addDefaultPage: false });
      const loaded1 = await PDFDocument.load(bytes1, {
        updateMetadata: false,
      });

      expect(loaded1.getPageCount()).toBe(1);
      expect(loaded1.getPage(0).getWidth()).toBe(150);
      expect(loaded1.getTitle()).toBe('Double Cycle Title');
      expect(loaded1.getAuthor()).toBe('Double Cycle Author');

      // Second save/load cycle
      loaded1.addPage([350, 450]);
      loaded1.setTitle('Updated Double Cycle Title');

      const bytes2 = await loaded1.save({ addDefaultPage: false });
      const loaded2 = await PDFDocument.load(bytes2, {
        updateMetadata: false,
      });

      expect(loaded2.getPageCount()).toBe(2);
      expect(loaded2.getPage(0).getWidth()).toBe(150);
      expect(loaded2.getPage(0).getHeight()).toBe(250);
      expect(loaded2.getPage(1).getWidth()).toBe(350);
      expect(loaded2.getPage(1).getHeight()).toBe(450);
      expect(loaded2.getTitle()).toBe('Updated Double Cycle Title');
      expect(loaded2.getAuthor()).toBe('Double Cycle Author');
    });
  });

  describe('Document creation options', () => {
    it('PDFDocument.create() creates an empty document with 0 pages', async () => {
      const doc = await PDFDocument.create();

      expect(doc.getPageCount()).toBe(0);
      expect(doc.getPages()).toHaveLength(0);
      expect(doc.getPageIndices()).toEqual([]);
    });

    it('PDFDocument.create() produces a document that is not encrypted', async () => {
      const doc = await PDFDocument.create();
      expect(doc.isEncrypted).toBe(false);
    });

    it('PDFDocument.create() with updateMetadata: false does not set default metadata', async () => {
      const doc = await PDFDocument.create({ updateMetadata: false });

      expect(doc.getProducer()).toBeUndefined();
      expect(doc.getCreator()).toBeUndefined();
      expect(doc.getCreationDate()).toBeUndefined();
      expect(doc.getModificationDate()).toBeUndefined();
    });

    it('PDFDocument.create() with updateMetadata: true (default) sets default producer and creator', async () => {
      const doc = await PDFDocument.create();

      expect(doc.getProducer()).toBe(
        'pdf-lib (https://github.com/Hopding/pdf-lib)',
      );
      expect(doc.getCreator()).toBe(
        'pdf-lib (https://github.com/Hopding/pdf-lib)',
      );
      expect(doc.getCreationDate()).toBeInstanceOf(Date);
      expect(doc.getModificationDate()).toBeInstanceOf(Date);
    });

    it('PDFDocument.load() loads a document from existing PDF bytes', async () => {
      const doc = await PDFDocument.create();
      doc.addPage([123, 456]);
      doc.setTitle('Load Test');

      const bytes = await doc.save({ addDefaultPage: false });
      const loaded = await PDFDocument.load(bytes);

      expect(loaded).toBeInstanceOf(PDFDocument);
      expect(loaded.getPageCount()).toBe(1);
      expect(loaded.getPage(0).getWidth()).toBe(123);
      expect(loaded.getPage(0).getHeight()).toBe(456);
      expect(loaded.getTitle()).toBe('Load Test');
    });

    it('PDFDocument.load() with updateMetadata: false preserves original dates', async () => {
      const doc = await PDFDocument.create();
      const creationDate = new Date('2010-05-20T08:00:00Z');
      const modDate = new Date('2015-10-10T16:30:00Z');
      doc.setCreationDate(creationDate);
      doc.setModificationDate(modDate);

      const bytes = await doc.save();
      const loaded = await PDFDocument.load(bytes, {
        updateMetadata: false,
      });

      expect(loaded.getCreationDate()).toEqual(creationDate);
      expect(loaded.getModificationDate()).toEqual(modDate);
    });

    it('save() with addDefaultPage: true adds a page when document is empty', async () => {
      const doc = await PDFDocument.create();
      expect(doc.getPageCount()).toBe(0);

      const bytes = await doc.save({ addDefaultPage: true });
      const loaded = await PDFDocument.load(bytes);

      expect(loaded.getPageCount()).toBe(1);
    });

    it('save() with addDefaultPage: false does not add a page when document is empty', async () => {
      const doc = await PDFDocument.create();
      expect(doc.getPageCount()).toBe(0);

      const bytes = await doc.save({ addDefaultPage: false });
      const loaded = await PDFDocument.load(bytes);

      expect(loaded.getPageCount()).toBe(0);
    });

    it('save() returns Uint8Array bytes', async () => {
      const doc = await PDFDocument.create();
      doc.addPage();

      const bytes = await doc.save();

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.byteLength).toBeGreaterThan(0);
    });

    it('saveAsBase64() returns a base64 string', async () => {
      const doc = await PDFDocument.create();
      doc.addPage();

      const base64 = await doc.saveAsBase64();

      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(0);
      // Should not have data URI prefix by default
      expect(base64.startsWith('data:')).toBe(false);
    });

    it('saveAsBase64() with dataUri: true returns a data URI', async () => {
      const doc = await PDFDocument.create();
      doc.addPage();

      const dataUri = await doc.saveAsBase64({ dataUri: true });

      expect(typeof dataUri).toBe('string');
      expect(dataUri.startsWith('data:application/pdf;base64,')).toBe(true);
    });
  });

  describe('Combined page and metadata operations', () => {
    it('can manipulate pages and metadata on the same document', async () => {
      const doc = await PDFDocument.create();

      doc.setTitle('Combined Test');
      doc.setAuthor('Test Author');
      doc.addPage([100, 200]);
      doc.addPage([300, 400]);
      doc.setSubject('Combined Subject');

      expect(doc.getPageCount()).toBe(2);
      expect(doc.getTitle()).toBe('Combined Test');
      expect(doc.getAuthor()).toBe('Test Author');
      expect(doc.getSubject()).toBe('Combined Subject');
      expect(doc.getPage(0).getWidth()).toBe(100);
      expect(doc.getPage(1).getWidth()).toBe(300);
    });

    it('page operations do not affect metadata', async () => {
      const doc = await PDFDocument.create();
      doc.setTitle('Stable Title');
      doc.setAuthor('Stable Author');

      doc.addPage([100, 200]);
      expect(doc.getTitle()).toBe('Stable Title');
      expect(doc.getAuthor()).toBe('Stable Author');

      doc.insertPage(0, [300, 400]);
      expect(doc.getTitle()).toBe('Stable Title');
      expect(doc.getAuthor()).toBe('Stable Author');

      doc.removePage(0);
      expect(doc.getTitle()).toBe('Stable Title');
      expect(doc.getAuthor()).toBe('Stable Author');
    });

    it('metadata changes do not affect page structure', async () => {
      const doc = await PDFDocument.create();
      doc.addPage([100, 200]);
      doc.addPage([300, 400]);

      doc.setTitle('New Title');
      doc.setAuthor('New Author');
      doc.setProducer('New Producer');

      expect(doc.getPageCount()).toBe(2);
      expect(doc.getPage(0).getWidth()).toBe(100);
      expect(doc.getPage(0).getHeight()).toBe(200);
      expect(doc.getPage(1).getWidth()).toBe(300);
      expect(doc.getPage(1).getHeight()).toBe(400);
    });

    it('full workflow: create, add pages, set metadata, save, load, verify', async () => {
      const doc = await PDFDocument.create();

      doc.addPage(PageSizes.A4);
      doc.addPage(PageSizes.Letter);
      doc.addPage([400, 600]);

      doc.setTitle('Workflow Test');
      doc.setAuthor('Workflow Author');
      doc.setSubject('Workflow Subject');
      doc.setKeywords(['workflow', 'test']);
      doc.setProducer('Workflow Producer');
      doc.setCreator('Workflow Creator');

      const creationDate = new Date('2022-01-01T00:00:00Z');
      const modDate = new Date('2023-06-15T12:00:00Z');
      doc.setCreationDate(creationDate);
      doc.setModificationDate(modDate);

      const bytes = await doc.save({ addDefaultPage: false });
      const loaded = await PDFDocument.load(bytes, {
        updateMetadata: false,
      });

      // Verify pages
      expect(loaded.getPageCount()).toBe(3);
      expect(loaded.getPageIndices()).toEqual([0, 1, 2]);

      expect(loaded.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
      expect(loaded.getPage(0).getHeight()).toBeCloseTo(841.89, 1);

      expect(loaded.getPage(1).getWidth()).toBe(612.0);
      expect(loaded.getPage(1).getHeight()).toBe(792.0);

      expect(loaded.getPage(2).getWidth()).toBe(400);
      expect(loaded.getPage(2).getHeight()).toBe(600);

      // Verify metadata
      expect(loaded.getTitle()).toBe('Workflow Test');
      expect(loaded.getAuthor()).toBe('Workflow Author');
      expect(loaded.getSubject()).toBe('Workflow Subject');
      expect(loaded.getKeywords()).toBe('workflow test');
      expect(loaded.getProducer()).toBe('Workflow Producer');
      expect(loaded.getCreator()).toBe('Workflow Creator');
      expect(loaded.getCreationDate()).toEqual(creationDate);
      expect(loaded.getModificationDate()).toEqual(modDate);
    });
  });
});
