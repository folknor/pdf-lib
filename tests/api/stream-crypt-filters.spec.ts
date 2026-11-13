import { describe, expect, it, vi } from 'vitest';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFString,
} from '../../src/index';
import type { EncryptionAlgorithm } from '../../src/core/security/PDFSecurity';
import {
  CryptFilterError,
  readCryptDeclaration,
} from '../../src/core/security/streamCrypt';
import PDFContext from '../../src/core/PDFContext';

const name = (value: string) => PDFName.of(value);

interface Fixture {
  raw: PDFDocument;
  encryptDict: PDFDict;
  /** Encrypted with /StmF. */
  plain: PDFRef;
  /** Untyped stream held by a /Filespec's /EF; encrypted with /StmF. */
  attachment: PDFRef;
  /** /Type /Metadata stream of a page, not the catalog's. */
  pageMetadata: PDFRef;
}

/**
 * An encrypted file reopened without decryption: unchanged objects keep
 * their ciphertext on a full save, so a test can rewrite the encryption
 * dictionary and put clear bodies where its crypt filter leaves them clear.
 */
const fixture = async (algorithm: EncryptionAlgorithm): Promise<Fixture> => {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const page = doc.addPage();
  const { context } = doc;
  const plain = context.register(context.stream('ordinary body'));
  const attachment = context.register(context.stream('attachment body'));
  const pageMetadata = context.register(
    context.stream('page metadata', { Type: 'Metadata', Subtype: 'XML' }),
  );
  const filespec = context.register(
    context.obj({
      Type: 'Filespec',
      F: PDFString.of('a.txt'),
      EF: { F: attachment },
    }),
  );
  doc.catalog.set(name('Plain'), plain);
  doc.catalog.set(name('Spec'), filespec);
  page.node.set(name('Metadata'), pageMetadata);
  doc.encrypt({ userPassword: 'user', ownerPassword: 'owner', algorithm });
  const raw = await PDFDocument.load(
    await doc.save({ useObjectStreams: false }),
    { ignoreEncryption: true, updateMetadata: false },
  );
  const encryptDict = raw.context.lookup(raw.context.trailerInfo.Encrypt, PDFDict);
  return { raw, encryptDict, plain, attachment, pageMetadata };
};

const open = async (bytes: Uint8Array, forIncrementalUpdate = false) =>
  PDFDocument.load(bytes, {
    password: 'user',
    updateMetadata: false,
    forIncrementalUpdate,
  });

const text = (doc: PDFDocument, ref: PDFRef) =>
  doc.context.lookup(ref, PDFRawStream).getContentsString();

describe('per-stream crypt filter selection on read', () => {
  it('decrypts embedded files with /EFF, found through /EF without /Type', async () => {
    const f = await fixture('AES-128');
    f.encryptDict.set(name('EFF'), name('Identity'));
    f.raw.context.assign(f.attachment, f.raw.context.stream('attachment body'));
    const doc = await open(await f.raw.save({ useObjectStreams: false }));
    expect(text(doc, f.attachment)).toBe('attachment body');
    expect(text(doc, f.plain)).toBe('ordinary body');
  });

  it('leaves only the catalog metadata clear under /EncryptMetadata false', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const f = await fixture('AES-256');
      f.encryptDict.set(name('EncryptMetadata'), f.raw.context.obj(false));
      const metadata = f.raw.context.register(
        f.raw.context.stream('document metadata', {
          Type: 'Metadata',
          Subtype: 'XML',
        }),
      );
      f.raw.catalog.set(name('Metadata'), metadata);
      const doc = await open(await f.raw.save({ useObjectStreams: false }));
      expect(text(doc, metadata)).toBe('document metadata');
      expect(text(doc, f.pageMetadata)).toBe('page metadata');
    } finally {
      warn.mockRestore();
    }
  });

  it('honours and removes a stream /Crypt filter', async () => {
    const f = await fixture('AES-128');
    const { context } = f.raw;
    f.encryptDict.set(name('StmF'), name('Identity'));
    const plainDict = context.lookup(f.plain, PDFRawStream).dict;
    plainDict.set(name('Filter'), context.obj(['Crypt']));
    plainDict.set(name('DecodeParms'), context.obj([{ Name: 'StdCF' }]));
    const identity = context.register(
      context.stream('identity body', { Filter: 'Crypt' }),
    );
    f.raw.catalog.set(name('Identity'), identity);
    const bytes = await f.raw.save({ useObjectStreams: false });

    const doc = await open(bytes);
    for (const [ref, body] of [
      [f.plain, 'ordinary body'],
      [identity, 'identity body'],
    ] as const) {
      const stream = doc.context.lookup(ref, PDFRawStream);
      expect(stream.getContentsString()).toBe(body);
      expect(stream.dict.has(name('Filter'))).toBe(false);
      expect(stream.dict.has(name('DecodeParms'))).toBe(false);
    }

    // A full rewrite is clear and declares no crypt filter.
    const rewritten = await PDFDocument.load(await doc.save(), {
      updateMetadata: false,
    });
    expect(text(rewritten, f.plain)).toBe('ordinary body');
  });
});

describe('per-stream crypt filter selection on increments', () => {
  const effIdentity = async () => {
    const f = await fixture('AES-128');
    f.encryptDict.set(name('EFF'), name('Identity'));
    f.raw.context.assign(f.attachment, f.raw.context.stream('attachment body'));
    return { f, bytes: await f.raw.save({ useObjectStreams: false }) };
  };

  it('writes new embedded files under /EFF', async () => {
    const { f, bytes } = await effIdentity();
    const doc = await open(bytes, true);
    const body = doc.context.register(doc.context.stream('new attachment'));
    doc.catalog.set(
      name('Spec2'),
      doc.context.register(
        doc.context.obj({ Type: 'Filespec', F: PDFString.of('b'), EF: { F: body } }),
      ),
    );
    const committed = await doc.commit();
    expect(new TextDecoder('latin1').decode(committed)).toContain(
      'new attachment',
    );
    const reopened = await open(committed);
    expect(text(reopened, body)).toBe('new attachment');
    expect(text(reopened, f.plain)).toBe('ordinary body');
  });

  it('refuses to make a stream it does not rewrite an embedded file', async () => {
    const { f, bytes } = await effIdentity();
    const doc = await open(bytes, true);
    doc.catalog.set(
      name('Spec2'),
      doc.context.register(
        doc.context.obj({
          Type: 'Filespec',
          F: PDFString.of('b'),
          EF: { F: f.plain },
        }),
      ),
    );
    await expect(doc.saveIncremental(doc.takeSnapshot())).rejects.toThrow(
      /which crypt filter applies/,
    );
  });

  it('refuses a new stream naming /Crypt through a reference', async () => {
    const { bytes } = await effIdentity();
    const doc = await open(bytes, true);
    const cryptName = doc.context.register(name('Crypt'));
    doc.catalog.set(
      name('Fresh'),
      doc.context.register(
        doc.context.stream('fresh body', { Filter: [cryptName] }),
      ),
    );
    await expect(doc.saveIncremental(doc.takeSnapshot())).rejects.toThrow(
      /own \/Crypt filter/,
    );
  });

  it('refuses to change an object a /Crypt declaration on disk goes through', async () => {
    const f = await fixture('AES-128');
    const { context } = f.raw;
    f.encryptDict.set(name('StmF'), name('Identity'));
    const parms = context.register(context.obj({ Name: 'StdCF' }));
    const plainDict = context.lookup(f.plain, PDFRawStream).dict;
    plainDict.set(name('Filter'), name('Crypt'));
    plainDict.set(name('DecodeParms'), parms);
    f.raw.catalog.set(name('Parms'), parms);
    const doc = await open(await f.raw.save({ useObjectStreams: false }), true);
    expect(text(doc, f.plain)).toBe('ordinary body');
    doc.context.lookup(parms, PDFDict).set(name('Name'), name('Identity'));
    await expect(doc.saveIncremental(doc.takeSnapshot())).rejects.toThrow(
      /declares its crypt filter/,
    );
  });
});

describe('readCryptDeclaration', () => {
  const context = PDFContext.create();
  const dict = (value: Record<string, unknown>) =>
    context.obj(value as never) as PDFDict;

  it('keeps the remaining filters and their parameters aligned', () => {
    const declaration = readCryptDeclaration(
      dict({
        Filter: ['Crypt', 'FlateDecode'],
        DecodeParms: [{ Name: 'X' }, { Predictor: 12 }],
      }),
      context,
      false,
    )!;
    expect(declaration.name).toBe(name('X'));
    expect(declaration.remainingFilter).toBe(name('FlateDecode'));
    expect(declaration.remainingParms).toBeInstanceOf(PDFDict);
  });

  it('accepts a one-filter array with a parameter dictionary', () => {
    const declaration = readCryptDeclaration(
      dict({ Filter: ['Crypt'], DecodeParms: { Name: 'X' } }),
      context,
      false,
    )!;
    expect(declaration.name).toBe(name('X'));
    expect(declaration.remainingFilter).toBeUndefined();
  });

  it('reads an indirect null /Name as /Identity', () => {
    const nullRef = context.register(context.obj(null));
    expect(
      readCryptDeclaration(
        dict({ Filter: 'Crypt', DecodeParms: { Name: nullRef } }),
        context,
        false,
      )!.name,
    ).toBe(name('Identity'));
  });

  it('rejects a /Crypt filter that is not first', () => {
    expect(() =>
      readCryptDeclaration(
        dict({ Filter: ['FlateDecode', 'Crypt'] }),
        context,
        false,
      ),
    ).toThrow(CryptFilterError);
  });

  it('rejects unresolved declarations when strict', () => {
    const missing = PDFRef.of(9999);
    expect(() =>
      readCryptDeclaration(
        dict({ Filter: 'Crypt', DecodeParms: missing }),
        context,
        true,
      ),
    ).toThrow(CryptFilterError);
    expect(
      readCryptDeclaration(dict({ Filter: missing }), context, false),
    ).toBeUndefined();
  });

  it('defaults to /Identity', () => {
    const declaration = readCryptDeclaration(
      dict({ Filter: PDFArray.withContext(context) }),
      context,
      false,
    );
    expect(declaration).toBeUndefined();
    expect(
      readCryptDeclaration(dict({ Filter: 'Crypt' }), context, false)!.name,
    ).toBe(name('Identity'));
  });
});
