import fontkit from 'src/fontkit.js';
import fs from 'fs';
import { vi } from 'vitest';
import type { PDFAttachment } from '../../src/api/PDFDocument';
import {
  AFRelationship,
  decodePDFRawStream,
  Duplex,
  EncryptedPDFError,
  NonFullScreenPageMode,
  PageSizes,
  ParseSpeeds,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHeader,
  PDFHexString,
  PDFName,
  PDFNull,
  PDFNumber,
  PDFPage,
  PDFRawStream,
  type PDFRef,
  PDFString,
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
  describe('load() copyStreams option', () => {
    const rawStreamsOf = (pdfDoc: PDFDocument) =>
      pdfDoc.context
        .enumerateIndirectObjects()
        .map(([, object]) => object)
        .filter((object): object is PDFRawStream => object instanceof PDFRawStream);

    // A Node Buffer, whose own slice() is a view: the default must still copy.
    it('copies stream bytes out of a Buffer input by default', async () => {
      const input = Buffer.from(normalPdfBytes);
      const pdfDoc = await PDFDocument.load(input, { updateMetadata: false });
      const streams = rawStreamsOf(pdfDoc);
      expect(streams.length).toBeGreaterThan(0);

      for (const stream of streams) {
        expect(stream.getContents().buffer).not.toBe(input.buffer);
      }
    });

    it('reads stream bodies as views into the input with copyStreams false', async () => {
      const input = new Uint8Array(normalPdfBytes);

      const pdfDoc = await PDFDocument.load(input, {
        updateMetadata: false,
        copyStreams: false,
      });

      const streams = rawStreamsOf(pdfDoc);
      expect(streams.length).toBeGreaterThan(0);

      for (const stream of streams) {
        expect(stream.getContents().buffer).toBe(input.buffer);
      }
    });

    it('saves the same bytes either way', async () => {
      for (const bytes of [normalPdfBytes, invalidObjectsPdfBytes]) {
        const copied = await PDFDocument.load(new Uint8Array(bytes), {
          updateMetadata: false,
          parseSpeed: ParseSpeeds.Fastest,
        });

        const viewed = await PDFDocument.load(new Uint8Array(bytes), {
          updateMetadata: false,
          parseSpeed: ParseSpeeds.Fastest,
          copyStreams: false,
        });

        // Everything up to the trailer /ID, whose second half is fresh per save.
        const upToId = (out: Uint8Array) =>
          Buffer.from(out.subarray(0, Buffer.from(out).lastIndexOf('/ID [')));

        const a = upToId(await copied.save());
        expect(a.length).toBeGreaterThan(0);
        expect(Buffer.compare(a, upToId(await viewed.save()))).toBe(0);
      }
    });

    it('rejects a non-boolean copyStreams', async () => {
      await expect(
        PDFDocument.load(normalPdfBytes, {
          copyStreams: 'no' as unknown as boolean,
        }),
      ).rejects.toThrow();
    });
  });

  describe('load() method', () => {
    const origConsoleWarn = console.warn;

    beforeAll(() => {
      const ignoredWarnings = ['Invalid object '];
      console.warn = vi.fn((...args) => {
        const isIgnored = ignoredWarnings.some((iw) => args[0].includes(iw));

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

    it('encrypts with AES-256 by default, whatever the header says', async () => {
      const pdfDoc = await PDFDocument.create({ updateMetadata: false });
      pdfDoc.context.header = PDFHeader.forVersion(1, 3);
      pdfDoc.addPage([300, 200]).drawRectangle({ x: 1, y: 2, width: 3 });
      pdfDoc.encrypt({ userPassword: 'user', ownerPassword: 'owner' });
      const bytes = await pdfDoc.save({ useObjectStreams: false });

      expect(new TextDecoder().decode(bytes.subarray(0, 8))).toBe('%PDF-1.7');

      const raw = await PDFDocument.load(bytes, {
        ignoreEncryption: true,
        updateMetadata: false,
      });

      const encryptDict = raw.context.lookup(
        raw.context.trailerInfo.Encrypt,
        PDFDict,
      );

      expect(encryptDict.get(PDFName.of('V'))).toEqual(PDFNumber.of(5));
      expect(encryptDict.get(PDFName.of('R'))).toEqual(PDFNumber.of(6));

      for (const password of ['user', 'owner']) {
        const reopened = await PDFDocument.load(bytes, {
          password,
          updateMetadata: false,
        });

        const contents = reopened.getPage(0).node.Contents();

        const stream = (
          contents instanceof PDFArray ? contents.lookup(0) : contents
        ) as PDFRawStream;

        const text = new TextDecoder().decode(
          decodePDFRawStream(stream).decode(),
        );

        expect(text).toContain('1 0 0 1 1 102 cm');
      }
    });

    describe('string encryption', () => {
      const algorithms = ['AES-256', 'AES-128', 'RC4-128', 'RC4-40'] as const;
      const secret = 'A (secret) title \\ with é';

      const encryptedDoc = async (algorithm: (typeof algorithms)[number]) => {
        const pdfDoc = await PDFDocument.create({ updateMetadata: false });
        const page = pdfDoc.addPage([300, 200]);
        page.node.set(PDFName.of('Note'), PDFString.of('page leaf string'));
        pdfDoc.setTitle(secret);
        pdfDoc.encrypt({ userPassword: 'user', ownerPassword: 'o', algorithm });

        return pdfDoc;
      };

      for (const algorithm of algorithms) {
        it(`round trips top-level strings under ${algorithm}`, async () => {
          const pdfDoc = await encryptedDoc(algorithm);
          const bytes = await pdfDoc.save({ useObjectStreams: false });
          expect(new TextDecoder('latin1').decode(bytes)).not.toContain(
            'page leaf string',
          );

          const reopened = await PDFDocument.load(bytes, {
            password: 'user',
            updateMetadata: false,
          });

          expect(reopened.getTitle()).toBe(secret);
          const note = reopened.getPage(0).node.get(PDFName.of('Note'));
          expect(note).toBeInstanceOf(PDFHexString);
          expect((note as PDFHexString).decodeText()).toBe('page leaf string');
        });
      }

      for (const algorithm of algorithms) {
        it(`round trips with object streams under ${algorithm}`, async () => {
          const pdfDoc = await encryptedDoc(algorithm);
          const bytes = await pdfDoc.save();
          expect(new TextDecoder('latin1').decode(bytes)).not.toContain(
            'page leaf string',
          );

          const raw = await PDFDocument.load(bytes, {
            ignoreEncryption: true,
            updateMetadata: false,
          });

          const reopened = await PDFDocument.load(bytes, {
            password: 'user',
            updateMetadata: false,
          });

          // The cross-reference stream is read in clear, so its trailer
          // entries survive the decrypting parse.
          const { trailerInfo } = reopened.context;
          expect(trailerInfo.Info).toBe(raw.context.trailerInfo.Info);
          expect(String(trailerInfo.ID)).toBe(
            String(raw.context.trailerInfo.ID),
          );
          expect(reopened.getTitle()).toBe(secret);
          const note = reopened.getPage(0).node.get(PDFName.of('Note'));
          expect((note as PDFHexString).decodeText()).toBe('page leaf string');
          // So is the encryption dictionary.
          const encryptRef = raw.context.trailerInfo.Encrypt;
          const O = PDFName.of('O');
          expect(
            String(reopened.context.lookup(encryptRef, PDFDict).get(O)),
          ).toBe(String(raw.context.lookup(encryptRef, PDFDict).get(O)));
        });
      }

      it('leaves the document unchanged, so a second save reads back', async () => {
        const pdfDoc = await encryptedDoc('AES-128');
        pdfDoc.getPage(0).drawRectangle({ x: 1, y: 2, width: 3 });
        await pdfDoc.save({ useObjectStreams: false });
        expect(pdfDoc.getTitle()).toBe(secret);
        const bytes = await pdfDoc.save({ useObjectStreams: false });

        const reopened = await PDFDocument.load(bytes, {
          password: 'user',
          updateMetadata: false,
        });

        expect(reopened.getTitle()).toBe(secret);
        const contents = reopened.getPage(0).node.Contents();

        const stream = (
          contents instanceof PDFArray ? contents.lookup(0) : contents
        ) as PDFRawStream;

        const text = new TextDecoder().decode(
          decodePDFRawStream(stream).decode(),
        );

        expect(text).toContain('1 0 0 1 1 102 cm');
      });

      it('leaves signature /Contents in clear', async () => {
        const pdfDoc = await encryptedDoc('RC4-128');

        const sig = pdfDoc.context.obj({
          Type: 'Sig',
          Contents: PDFHexString.of('0badc0de'),
          Name: PDFString.of('signer'),
        });

        const sigRef = pdfDoc.context.register(sig);
        const bytes = await pdfDoc.save({ useObjectStreams: false });
        expect(new TextDecoder('latin1').decode(bytes)).toContain('<0badc0de>');

        const reopened = await PDFDocument.load(bytes, {
          password: 'user',
          updateMetadata: false,
        });

        const read = reopened.context.lookup(sigRef, PDFDict);
        expect(read.get(PDFName.of('Contents'))).toEqual(
          PDFHexString.of('0badc0de'),
        );
        expect(read.get(PDFName.of('Name'))).toBeInstanceOf(PDFHexString);
        expect(
          (read.get(PDFName.of('Name')) as PDFHexString).decodeText(),
        ).toBe('signer');
      });
    });

    it.each(['StrF', 'StmF'] as const)(
      'decrypts separate string and stream filters with /%s /Identity',
      async (identityFilter) => {
        const title = 'Separate crypt filter title';
        const contents = 'Stream content with a different crypt filter';
        const pdfDoc = await PDFDocument.create({ updateMetadata: false });
        pdfDoc.addPage();
        pdfDoc.setTitle(title);

        const streamRef = pdfDoc.context.register(
          pdfDoc.context.stream(contents),
        );

        pdfDoc.catalog.set(PDFName.of('TestStream'), streamRef);
        pdfDoc.encrypt({ userPassword: 'user', ownerPassword: 'owner' });

        // Preserve the ciphertext while constructing a file with mixed filters.
        // Replace only the bytes that the Identity filter leaves in clear.
        const raw = await PDFDocument.load(
          await pdfDoc.save({ useObjectStreams: false }),
          { ignoreEncryption: true, updateMetadata: false },
        );

        // Bypass the keyless-save check to author a ciphertext fixture.
        raw.context.baselineEncryption = undefined;

        const encryptDict = raw.context.lookup(
          raw.context.trailerInfo.Encrypt,
          PDFDict,
        );

        encryptDict.set(PDFName.of(identityFilter), PDFName.of('Identity'));

        if (identityFilter === 'StrF') {
          raw.setTitle(title);
        } else {
          raw.context.assign(streamRef, raw.context.stream(contents));
        }

        const bytes = await raw.save({ useObjectStreams: false });

        const reopened = await PDFDocument.load(bytes, {
          password: 'user',
          updateMetadata: false,
        });

        expect(reopened.getTitle()).toBe(title);

        const stream = reopened.catalog.lookup(
          PDFName.of('TestStream'),
          PDFRawStream,
        );

        expect(stream.getContentsString()).toBe(contents);
      },
    );

    it('decrypts when the crypt filters are indirect objects', async () => {
      const secret = 'Indirect crypt filter secret';
      const pdfDoc = await PDFDocument.create({ updateMetadata: false });
      pdfDoc.addPage([300, 200]);
      pdfDoc.setTitle(secret);
      // A nonempty user password, so the ignoreEncryption load below stays
      // keyless rather than opening with the empty password.
      pdfDoc.encrypt({ userPassword: 'user', ownerPassword: 'owner-secret' });

      // Some producers (e.g. iText 2.x) write /CF and each crypt filter as
      // indirect objects instead of inline dictionaries.
      // No object streams: a keyless load cannot read their members, so the
      // Info dictionary must be a top-level object to survive the edit.
      const original = await pdfDoc.save({ useObjectStreams: false });

      const encrypted = await PDFDocument.load(original, {
        ignoreEncryption: true,
        updateMetadata: false,
      });

      const { context } = encrypted;
      // Bypass the keyless-save check to author a ciphertext fixture.
      context.baselineEncryption = undefined;
      const encryptDict = context.lookup(context.trailerInfo.Encrypt, PDFDict);
      const cf = encryptDict.lookup(PDFName.of('CF'), PDFDict);
      const stdCf = cf.lookup(PDFName.of('StdCF'), PDFDict);
      cf.set(PDFName.of('StdCF'), context.register(stdCf));
      encryptDict.set(PDFName.of('CF'), context.register(cf));
      const bytes = await encrypted.save({ useObjectStreams: false });

      const reopened = await PDFDocument.load(bytes, {
        password: 'user',
        updateMetadata: false,
      });

      expect(reopened.getTitle()).toBe(secret);
    });

    describe('omitted password', () => {
      const algorithms = ['AES-256', 'AES-128', 'RC4-128', 'RC4-40'] as const;
      const title = 'Restricted title';

      const encryptedBytes = async (
        algorithm: (typeof algorithms)[number],
        userPassword: string,
      ) => {
        const pdfDoc = await PDFDocument.create({ updateMetadata: false });
        pdfDoc.addPage([300, 200]);
        pdfDoc.setTitle(title);
        pdfDoc.encrypt({ userPassword, ownerPassword: 'owner', algorithm });

        return pdfDoc.save({ useObjectStreams: false });
      };

      for (const algorithm of algorithms) {
        for (const ignoreEncryption of [false, true]) {
          it(`opens a ${algorithm} owner-only file with the empty user password (ignoreEncryption=${ignoreEncryption})`, async () => {
            const bytes = await encryptedBytes(algorithm, '');

            const pdfDoc = await PDFDocument.load(bytes, {
              ignoreEncryption,
              updateMetadata: false,
            });

            expect(pdfDoc.isEncrypted).toBe(false);
            expect(pdfDoc.context.isDecrypted).toBe(true);
            expect(pdfDoc.getTitle()).toBe(title);

            pdfDoc.setSubject('edited');
            const saved = await pdfDoc.save({ useObjectStreams: false });

            const reread = await PDFDocument.load(saved, {
              updateMetadata: false,
            });

            expect(reread.getSubject()).toBe('edited');

            const target = await PDFDocument.create();
            const [page] = await target.copyPages(pdfDoc, [0]);
            target.addPage(page);
          });
        }
      }

      it('increments an owner-only file under its own encryption', async () => {
        const bytes = await encryptedBytes('AES-256', '');

        const pdfDoc = await PDFDocument.load(bytes, {
          forIncrementalUpdate: true,
          updateMetadata: false,
        });

        pdfDoc.setSubject('incremented');
        const saved = await pdfDoc.commit();
        const reread = await PDFDocument.load(saved, { updateMetadata: false });
        expect(reread.getTitle()).toBe(title);
        expect(reread.getSubject()).toBe('incremented');
        // Still encrypted: it was decrypted on load, not read in clear.
        expect(reread.context.baselineEncryption).toBeDefined();
        expect(reread.context.baselineEncryption).not.toBe('keyless');
        await expect(
          PDFDocument.load(saved, { password: 'wrong', updateMetadata: false }),
        ).rejects.toThrow('Password incorrect');
      });

      it('still refuses a file with a nonempty user password', async () => {
        const bytes = await encryptedBytes('AES-256', 'user');
        await expect(
          PDFDocument.load(bytes, { updateMetadata: false }),
        ).rejects.toThrow(EncryptedPDFError);

        const keyless = await PDFDocument.load(bytes, {
          ignoreEncryption: true,
          updateMetadata: false,
        });

        expect(keyless.isEncrypted).toBe(true);
        expect(keyless.context.baselineEncryption).toBe('keyless');
      });

      it('throws on a wrong explicit password even with ignoreEncryption', async () => {
        const bytes = await encryptedBytes('AES-256', '');
        await expect(
          PDFDocument.load(bytes, {
            password: 'wrong',
            ignoreEncryption: true,
            updateMetadata: false,
          }),
        ).rejects.toThrow('Password incorrect');
      });
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
    it('serializes the same font content apart from revision IDs', async () => {
      const customFont = fs.readFileSync('assets/fonts/ubuntu/Ubuntu-B.ttf');
      const pdfDoc1 = await PDFDocument.create({ updateMetadata: false });
      const pdfDoc2 = await PDFDocument.create({ updateMetadata: false });

      pdfDoc1.registerFontkit(fontkit);
      pdfDoc2.registerFontkit(fontkit);

      await pdfDoc1.embedFont(customFont);
      await pdfDoc2.embedFont(customFont);

      const savedDoc1 = await pdfDoc1.save();
      const savedDoc2 = await pdfDoc2.save();

      const withoutID = (bytes: Uint8Array) =>
        Buffer.from(bytes).toString('latin1').replace(/\/ID \[[^\]]*\]/g, '');

      expect(withoutID(savedDoc1)).toEqual(withoutID(savedDoc2));
    });

    it('ignores postscriptName for a single, non-variable font', async () => {
      const customFont = fs.readFileSync('assets/fonts/ubuntu/Ubuntu-B.ttf');
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);

      const font = await pdfDoc.embedFont(customFont, {
        postscriptName: 'No-Such-Face',
      });

      const subset = await pdfDoc.embedFont(customFont, {
        subset: true,
        postscriptName: 'No-Such-Face',
      });

      expect(font.name).toContain('Ubuntu');
      expect(subset.name).toContain('Ubuntu');
      await expect(pdfDoc.save()).resolves.toBeInstanceOf(Uint8Array);
    });

    it('rejects a non-string postscriptName', async () => {
      const customFont = fs.readFileSync('assets/fonts/ubuntu/Ubuntu-B.ttf');
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);
      await expect(
        pdfDoc.embedFont(customFont, { postscriptName: 42 as any }),
      ).rejects.toThrow();
    });

    it('selects a face from a font collection by postscriptName', async () => {
      // No .ttc fixture exists, so register a fake collection format whose
      // faces are real TTF fonts. Its magic bytes match nothing real.
      const regular = fontkit.create(
        fs.readFileSync('assets/fonts/ubuntu/Ubuntu-R.ttf'),
      );

      const bold = fontkit.create(
        fs.readFileSync('assets/fonts/ubuntu/Ubuntu-B.ttf'),
      );

      const getFont = vi.fn((name: string) =>
        [regular, bold].find((f) => f.postscriptName === name) ?? null,
      );

      class FakeCollection {
        static probe(buffer: Uint8Array) {
          return buffer[0] === 0xfe && buffer[1] === 0xed;
        }
        get fonts() {
          return [regular, bold];
        }
        getFont = getFont;
      }

      fontkit.registerFormat(FakeCollection as any);

      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);

      const font = await pdfDoc.embedFont(Uint8Array.of(0xfe, 0xed, 0, 0), {
        postscriptName: bold.postscriptName!,
      });

      expect(getFont).toHaveBeenCalledWith(bold.postscriptName);
      expect(font.name).toContain(bold.postscriptName);
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

    it('sorts JavaScript name tree entries lexically', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addJavaScript('zebra', 'console.println("z");');
      pdfDoc.addJavaScript('alpha', 'console.println("a");');
      pdfDoc.addJavaScript('middle', 'console.println("m");');
      await pdfDoc.flush();

      const Names = pdfDoc.catalog.lookup(PDFName.of('Names'), PDFDict);
      const Javascript = Names.lookup(PDFName.of('JavaScript'), PDFDict);
      const JSNames = Javascript.lookup(PDFName.of('Names'), PDFArray);

      const names = [0, 2, 4].map((idx) =>
        JSNames.lookup(idx, PDFHexString).decodeText(),
      );

      expect(names).toEqual(['alpha', 'middle', 'zebra']);
    });

    it('adds into an existing Kids JavaScript tree, keeping its structure', async () => {
      const pdfDoc = await PDFDocument.create();
      const ctx = pdfDoc.context;
      const a = PDFHexString.fromText('a');
      const leafRef = ctx.register(ctx.obj({ Names: [a, ctx.obj({})], Limits: [a, a] }));
      pdfDoc.catalog.set(PDFName.of('Names'), ctx.obj({ JavaScript: { Kids: [leafRef] } }));

      pdfDoc.addJavaScript('newScript', 'console.println("x");');
      await pdfDoc.flush();

      const Javascript = pdfDoc.catalog
        .lookup(PDFName.of('Names'), PDFDict)
        .lookup(PDFName.of('JavaScript'), PDFDict);

      expect(Javascript.has(PDFName.of('Names'))).toBe(false);
      const leaf = Javascript.lookup(PDFName.of('Kids'), PDFArray).lookup(0, PDFDict);
      const keys = leaf.lookup(PDFName.of('Names'), PDFArray);
      expect(keys.lookup(2, PDFHexString).decodeText()).toBe('newScript');
    });

    it('refuses a JavaScript tree it cannot edit safely, when called', async () => {
      const pdfDoc = await PDFDocument.create();
      const leafRef = pdfDoc.context.register(pdfDoc.context.obj({ Names: [] }));
      pdfDoc.catalog.set(
        PDFName.of('Names'),
        pdfDoc.context.obj({ JavaScript: { Kids: [leafRef] } }),
      );
      expect(() => pdfDoc.addJavaScript('s', 'x')).toThrow(/empty/);
    });

    it('refuses a name already used by a pending or saved script', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addJavaScript('main', 'a');
      expect(() => pdfDoc.addJavaScript('main', 'b')).toThrow(/already has/);
      await pdfDoc.save();
      expect(() => pdfDoc.addJavaScript('main', 'c')).toThrow(/already has/);

      // A saved key written as a literal string is the same name.
      const other = await PDFDocument.create();
      other.catalog.set(
        PDFName.of('Names'),
        other.context.obj({ JavaScript: { Names: [PDFString.of('main'), PDFNull] } }),
      );
      expect(() => other.addJavaScript('main', 'x')).toThrow(/already has/);
    });

    it('refuses at save a script whose name a saved one took after the call', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addJavaScript('main', 'a');
      pdfDoc.catalog.set(
        PDFName.of('Names'),
        pdfDoc.context.obj({ JavaScript: { Names: [PDFHexString.fromText('main'), PDFNull] } }),
      );
      await expect(pdfDoc.save()).rejects.toThrow(/already has/);
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

    it("applies the document's maxDecodedStreamSize", async () => {
      const base = await PDFDocument.create();
      const bytes = await base.save({ useObjectStreams: false });
      const capped = await PDFDocument.load(bytes, { maxDecodedStreamSize: 16 });
      await expect(capped.embedPng(examplePngImage)).rejects.toThrow(
        'exceeds the maximum of 16 bytes',
      );
      const uncapped = await PDFDocument.load(bytes);
      await expect(uncapped.embedPng(examplePngImage)).resolves.toBeDefined();
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

    it('compresses uncompressed streams when compress=true', async () => {
      // Create a PDF with some content that can be compressed
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();

      // Draw lots of text to create content streams worth compressing
      for (let i = 0; i < 50; i++) {
        page.drawText(`Line ${i}: This is some text content that will be compressed.`, {
          x: 50,
          y: 750 - i * 14,
          size: 10,
        });
      }

      // Save without compression
      const uncompressedBytes = await pdfDoc.save({ compress: false });

      // Save with compression
      const compressedBytes = await pdfDoc.save({ compress: true });

      // Compressed version should be smaller (or at least not larger)
      // Note: The difference may not be huge since content streams are already
      // compressed by default, but other streams may benefit
      expect(compressedBytes.length).toBeLessThanOrEqual(uncompressedBytes.length);

      // Both should produce valid PDFs that can be loaded
      const loadedUncompressed = await PDFDocument.load(uncompressedBytes);
      const loadedCompressed = await PDFDocument.load(compressedBytes);

      expect(loadedUncompressed.getPageCount()).toBe(1);
      expect(loadedCompressed.getPageCount()).toBe(1);
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
    it('saves the same attachment content apart from revision IDs', async () => {
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

      const withoutID = (bytes: Uint8Array) =>
        Buffer.from(bytes).toString('latin1').replace(/\/ID \[[^\]]*\]/g, '');

      expect(withoutID(savedDoc1)).toEqual(withoutID(savedDoc2));
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

    it('adds into a Kids EmbeddedFiles tree, keeping its structure, and survives a reload', async () => {
      const pdfDoc = await PDFDocument.create();
      await pdfDoc.attach(new Uint8Array([9]), 'm.txt');
      await pdfDoc.flush();
      // Move the flat tree under a Kids root.
      const ctx = pdfDoc.context;

      const ef = pdfDoc.catalog
        .lookup(PDFName.of('Names'), PDFDict)
        .lookup(PDFName.of('EmbeddedFiles'), PDFDict);

      const m = PDFHexString.fromText('m.txt');

      const leafRef = ctx.register(
        ctx.obj({ Names: ef.lookup(PDFName.of('Names'), PDFArray), Limits: [m, m] }),
      );

      pdfDoc.catalog.set(PDFName.of('Names'), ctx.obj({ EmbeddedFiles: { Kids: [leafRef] } }));

      await pdfDoc.attach(new Uint8Array([1, 2, 3]), 'new.txt');
      await pdfDoc.attach(new Uint8Array([4]), 'z.txt');
      const reloaded = await PDFDocument.load(await pdfDoc.save());

      const EmbeddedFiles = reloaded.catalog
        .lookup(PDFName.of('Names'), PDFDict)
        .lookup(PDFName.of('EmbeddedFiles'), PDFDict);

      expect(EmbeddedFiles.has(PDFName.of('Kids'))).toBe(true);
      expect(EmbeddedFiles.has(PDFName.of('Names'))).toBe(false);
      expect(reloaded.getAttachments().map((a) => [a.name, [...a.data]])).toEqual([
        ['m.txt', [9]],
        ['new.txt', [1, 2, 3]],
        ['z.txt', [4]],
      ]);
      expect(reloaded.catalog.lookup(PDFName.of('AF'), PDFArray).size()).toBe(3);
    });

    it('refuses, when called, an attachments tree or /AF it cannot edit safely', async () => {
      const pdfDoc = await PDFDocument.create();
      const leafRef = pdfDoc.context.register(pdfDoc.context.obj({ Names: [] }));
      pdfDoc.catalog.set(
        PDFName.of('Names'),
        pdfDoc.context.obj({ EmbeddedFiles: { Kids: [leafRef] } }),
      );
      await expect(pdfDoc.attach(new Uint8Array([1]), 'a.txt')).rejects.toThrow(/empty/);

      const other = await PDFDocument.create();
      other.catalog.set(PDFName.of('AF'), other.context.obj({}));
      await expect(other.attach(new Uint8Array([1]), 'a.txt')).rejects.toThrow(/AF/);
    });

    it('refuses a name already used by a pending or saved attachment', async () => {
      const pdfDoc = await PDFDocument.create();
      await pdfDoc.attach(new Uint8Array([1]), 'a.txt');
      await expect(pdfDoc.attach(new Uint8Array([2]), 'a.txt')).rejects.toThrow(/already has/);
      await pdfDoc.save();
      await expect(pdfDoc.attach(new Uint8Array([3]), 'a.txt')).rejects.toThrow(/already has/);
      // A lone surrogate does not survive decoding; the key bytes still match.
      await pdfDoc.attach(new Uint8Array([4]), '\ud800');
      await pdfDoc.save();
      await expect(pdfDoc.attach(new Uint8Array([5]), '\ud800')).rejects.toThrow(/already has/);

      // detach() then attach() replaces it.
      pdfDoc.detach('a.txt');
      await pdfDoc.attach(new Uint8Array([6]), 'a.txt');
      await pdfDoc.save();
      const a = pdfDoc.getAttachments().filter((x) => x.name === 'a.txt');
      expect(a.map((x) => [...x.data])).toEqual([[6]]);
    });

    it('refuses at save, leaving nothing behind, when the tree broke after attach()', async () => {
      const pdfDoc = await PDFDocument.create();
      await pdfDoc.attach(new Uint8Array([1]), 'a.txt');
      const leafRef = pdfDoc.context.register(pdfDoc.context.obj({ Names: [] }));
      pdfDoc.catalog.set(
        PDFName.of('Names'),
        pdfDoc.context.obj({ EmbeddedFiles: { Kids: [leafRef] } }),
      );
      await expect(pdfDoc.save()).rejects.toThrow(/empty/);
      expect(pdfDoc.catalog.has(PDFName.of('AF'))).toBe(false);

      const filespecs = pdfDoc.context
        .enumerateIndirectObjects()
        .filter(([, o]) => o instanceof PDFDict && o.has(PDFName.of('EF')));

      expect(filespecs).toHaveLength(0);
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
      // Unsaved attachments report copies of the dates given.
      expect(txtAttachment.creationDate).toEqual(creationDate);
      expect(pngAttachment.creationDate).toEqual(creationDate);
      expect(jpgAttachment.modificationDate).toBeDefined();
      expect(pdfAttachment.modificationDate).toBeDefined();
      expect(txtAttachment.modificationDate).toEqual(modificationDate);
      expect(pngAttachment.modificationDate).toEqual(modificationDate);
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

    const threeAttachments = async () => {
      const pdfDoc = await PDFDocument.create();

      for (const name of ['a.txt', 'b.txt', 'c.txt']) {
        await pdfDoc.attach(new Uint8Array([1, 2, 3]), name);
      }

      await pdfDoc.save();

      const ef = pdfDoc.catalog
        .lookup(PDFName.of('Names'), PDFDict)
        .lookup(PDFName.of('EmbeddedFiles'), PDFDict);

      const names = ef.lookup(PDFName.of('Names'), PDFArray);

      const spec = (key: string) => {
        for (let i = 0; i < names.size(); i += 2) {
          if ((names.get(i) as PDFHexString).decodeText() === key) {
            return names.get(i + 1) as any;
          }
        }

        throw new Error(key);
      };

      const streamOf = (ref: any) =>
        pdfDoc.context
          .lookup(ref, PDFDict)
          .lookup(PDFName.of('EF'), PDFDict)
          .get(PDFName.of('F')) as any;

      return { pdfDoc, ef, names, spec, streamOf };
    };

    it('unlinks every /AF occurrence, drops root /Limits and deletes the objects, copy-on-write', async () => {
      const { pdfDoc, ef, names, spec, streamOf } = await threeAttachments();
      const ctx = pdfDoc.context;
      const c = spec('c.txt');
      const stream = streamOf(c);
      const AF = pdfDoc.catalog.lookup(PDFName.of('AF'), PDFArray);
      AF.push(c);
      ef.set(
        PDFName.of('Limits'),
        ctx.obj([PDFHexString.fromText('a.txt'), PDFHexString.fromText('c.txt')]),
      );

      pdfDoc.detach('c.txt');

      // The old containers, which another structure may share, are intact.
      expect(names.size()).toBe(6);
      expect(AF.size()).toBe(4);

      const newEf = pdfDoc.catalog
        .lookup(PDFName.of('Names'), PDFDict)
        .lookup(PDFName.of('EmbeddedFiles'), PDFDict);

      expect(newEf.lookup(PDFName.of('Names'), PDFArray).size()).toBe(4);
      // A root may not carry /Limits (ISO 32000-1 7.9.6).
      expect(newEf.has(PDFName.of('Limits'))).toBe(false);
      const newAF = pdfDoc.catalog.lookup(PDFName.of('AF'), PDFArray);
      expect(newAF.asArray()).not.toContain(c);
      expect(newAF.size()).toBe(2);
      expect(ctx.lookup(c)).toBeUndefined();
      expect(ctx.lookup(stream)).toBeUndefined();
    });

    it('keeps objects another structure still refers to', async () => {
      const { pdfDoc, names, spec, streamOf } = await threeAttachments();
      const ctx = pdfDoc.context;
      const a = spec('a.txt');
      const b = spec('b.txt');
      // b.txt is also a file-attachment annotation; a.txt also has a second key.
      ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'FileAttachment', FS: b }));
      names.push(PDFHexString.fromText('z.txt'));
      names.push(a);

      pdfDoc.detach('a.txt');
      pdfDoc.detach('b.txt');
      expect(ctx.lookup(a)).toBeInstanceOf(PDFDict);
      expect(ctx.lookup(streamOf(a))).toBeDefined();
      expect(ctx.lookup(b)).toBeInstanceOf(PDFDict);
      expect(pdfDoc.getAttachments().map((f) => f.name)).toEqual([
        'c.txt',
        'z.txt',
      ]);

      const stream = streamOf(a);
      pdfDoc.detach('z.txt');
      expect(ctx.lookup(a)).toBeUndefined();
      expect(ctx.lookup(stream)).toBeUndefined();
    });

    it('collects indirect /EF dicts and cycles, and ignores unreadable attachments', async () => {
      const { pdfDoc, spec } = await threeAttachments();
      const ctx = pdfDoc.context;
      const a = spec('a.txt');
      const specDict = ctx.lookup(a, PDFDict);
      const efRef = ctx.register(specDict.lookup(PDFName.of('EF'), PDFDict));
      specDict.set(PDFName.of('EF'), efRef);
      const streamRef = ctx.lookup(efRef, PDFDict).get(PDFName.of('F')) as any;
      ctx.lookup(streamRef, PDFRawStream).dict.set(PDFName.of('Back'), a);

      // b.txt cannot be decoded.
      const bStream = ctx.lookup(
        ctx
          .lookup(spec('b.txt'), PDFDict)
          .lookup(PDFName.of('EF'), PDFDict)
          .get(PDFName.of('F')) as any,
        PDFRawStream,
      );

      bStream.dict.set(PDFName.of('Filter'), PDFName.of('LZWDecode'));
      bStream.dict.set(PDFName.of('DecodeParms'), ctx.obj({ Predictor: 99 }));

      pdfDoc.detach('a.txt');
      expect(ctx.lookup(a)).toBeUndefined();
      expect(ctx.lookup(efRef)).toBeUndefined();
      expect(ctx.lookup(streamRef)).toBeUndefined();
      // Listing still works; only reading b.txt's bytes throws.
      const listed = pdfDoc.getAttachments();
      expect(listed.map((x) => x.name)).toEqual(['b.txt', 'c.txt']);
      expect(() => listed[0]!.data).toThrow();
      expect(listed[1]!.data).toBeInstanceOf(Uint8Array);
    });

    it('detaches from a Kids tree, pruning emptied leaves and keeping shared nodes', async () => {
      const pdfDoc = await PDFDocument.create();
      const ctx = pdfDoc.context;

      for (const n of ['a.txt', 'b.txt', 'c.txt']) {
        await pdfDoc.attach(new TextEncoder().encode(n), n);
      }

      await pdfDoc.flush();

      const names = pdfDoc.catalog
        .lookup(PDFName.of('Names'), PDFDict)
        .lookup(PDFName.of('EmbeddedFiles'), PDFDict)
        .lookup(PDFName.of('Names'), PDFArray);

      const k = (i: number) => names.get(i);

      const leaf1 = ctx.register(
        ctx.obj({ Names: [k(0), names.get(1), k(2), names.get(3)], Limits: [k(0), k(2)] }),
      );

      const leaf2 = ctx.register(ctx.obj({ Names: [k(4), names.get(5)], Limits: [k(4), k(4)] }));
      const aRef = names.get(1) as PDFRef;
      const cRef = names.get(5) as PDFRef;
      pdfDoc.catalog.set(
        PDFName.of('Names'),
        ctx.obj({ EmbeddedFiles: { Kids: [leaf1, leaf2] } }),
      );
      // Another structure shares leaf1.
      const holder = ctx.register(ctx.obj({ Kids: [leaf1] }));

      pdfDoc.detach('c.txt');
      pdfDoc.detach('a.txt');

      expect(pdfDoc.getAttachments().map((x) => x.name)).toEqual(['b.txt']);
      expect(ctx.lookup(cRef)).toBeUndefined();
      expect(ctx.lookup(leaf2)).toBeUndefined();
      // leaf1 is still another tree's kid: unchanged, and a.txt kept for it.
      expect(ctx.lookup(leaf1, PDFDict).lookup(PDFName.of('Names'), PDFArray).size()).toBe(4);
      expect(ctx.lookup(aRef)).toBeInstanceOf(PDFDict);
      expect(ctx.lookup(holder)).toBeDefined();
      const AF = pdfDoc.catalog.lookup(PDFName.of('AF'), PDFArray);
      expect(AF.size()).toBe(1);
    });

    it('keeps listed data readable after detach deletes an indirect /Filter', async () => {
      const { pdfDoc, spec, streamOf } = await threeAttachments();
      const ctx = pdfDoc.context;
      const s = ctx.lookup(streamOf(spec('a.txt')), PDFRawStream);
      s.dict.set(PDFName.of('Filter'), ctx.register(PDFName.of('FlateDecode')));
      const listed = pdfDoc.getAttachments();
      pdfDoc.detach('a.txt');
      expect([...listed[0]!.data]).toEqual([1, 2, 3]);
    });

    it('refuses to detach when /AF is malformed, changing nothing', async () => {
      const { pdfDoc } = await threeAttachments();
      pdfDoc.catalog.set(PDFName.of('AF'), pdfDoc.context.obj({}));
      expect(() => pdfDoc.detach('a.txt')).toThrow(/AF/);
      expect(pdfDoc.getAttachments()).toHaveLength(3);
      expect(() => pdfDoc.detach('absent.txt')).not.toThrow();
    });

    it('refuses to detach from a tree it cannot edit, changing nothing', async () => {
      const pdfDoc = await PDFDocument.create();
      const ctx = pdfDoc.context;
      const a = PDFHexString.fromText('a.txt');
      const stale = ctx.register(ctx.obj({ Names: [a, ctx.obj({})], Limits: [a, PDFHexString.fromText('b')] }));
      pdfDoc.catalog.set(PDFName.of('Names'), ctx.obj({ EmbeddedFiles: { Kids: [stale] } }));
      expect(() => pdfDoc.detach('a.txt')).toThrow(/Limits/);
      expect(ctx.lookup(stale, PDFDict).lookup(PDFName.of('Names'), PDFArray).size()).toBe(2);
      expect(() => pdfDoc.detach('absent.txt')).not.toThrow();
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

      it('renames form fields when renameFields option is provided', async () => {
        // Create source document with a form field
        const srcDoc = await PDFDocument.create();
        const srcPage = srcDoc.addPage([500, 500]);
        const srcForm = srcDoc.getForm();
        const srcField = srcForm.createTextField('myField');
        srcField.setText('Hello');
        srcField.addToPage(srcPage, { x: 50, y: 400, width: 200, height: 30 });

        // Copy pages with a rename function
        const destDoc = await PDFDocument.create();

        const [copiedPage] = await destDoc.copyPages(srcDoc, [0], {
          renameFields: (name) => `doc1_${name}`,
        });

        destDoc.addPage(copiedPage);

        // The field should have been renamed
        const destForm = destDoc.getForm();
        const fields = destForm.getFields();

        expect(fields.length).toBe(1);
        expect(fields[0].getName()).toBe('doc1_myField');
      });

      it('allows copying from multiple sources without field name conflicts', async () => {
        // Create first source document
        const src1 = await PDFDocument.create();
        const page1 = src1.addPage([500, 500]);
        const form1 = src1.getForm();
        const field1 = form1.createTextField('sharedName');
        field1.setText('From doc 1');
        field1.addToPage(page1, { x: 50, y: 400, width: 200, height: 30 });

        // Create second source document with same field name
        const src2 = await PDFDocument.create();
        const page2 = src2.addPage([500, 500]);
        const form2 = src2.getForm();
        const field2 = form2.createTextField('sharedName');
        field2.setText('From doc 2');
        field2.addToPage(page2, { x: 50, y: 400, width: 200, height: 30 });

        // Copy both to destination with unique prefixes
        const destDoc = await PDFDocument.create();

        const [copiedPage1] = await destDoc.copyPages(src1, [0], {
          renameFields: (name) => `src1_${name}`,
        });

        destDoc.addPage(copiedPage1);

        const [copiedPage2] = await destDoc.copyPages(src2, [0], {
          renameFields: (name) => `src2_${name}`,
        });

        destDoc.addPage(copiedPage2);

        // Both fields should exist with different names
        const destForm = destDoc.getForm();
        const fields = destForm.getFields();

        expect(fields.length).toBe(2);
        const fieldNames = fields.map((f) => f.getName()).sort();
        expect(fieldNames).toEqual(['src1_sharedName', 'src2_sharedName']);
      });

      it('preserves field names when renameFields is not provided', async () => {
        // Create source document with a form field
        const srcDoc = await PDFDocument.create();
        const srcPage = srcDoc.addPage([500, 500]);
        const srcForm = srcDoc.getForm();
        const srcField = srcForm.createTextField('originalName');
        srcField.setText('Test');
        srcField.addToPage(srcPage, { x: 50, y: 400, width: 200, height: 30 });

        // Copy pages without rename option
        const destDoc = await PDFDocument.create();
        const [copiedPage] = await destDoc.copyPages(srcDoc, [0]);
        destDoc.addPage(copiedPage);

        // The field should keep its original name
        const destForm = destDoc.getForm();
        const fields = destForm.getFields();

        expect(fields.length).toBe(1);
        expect(fields[0].getName()).toBe('originalName');
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
