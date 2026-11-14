import { afterEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument, PDFName, type PDFWarning } from '../../src/index';

const MARK = 'MARKXXXXXXXXXXXX'; // with its slash, as long as BIG
const BIG = '90071992547409930'; // above Number.MAX_SAFE_INTEGER

/**
 * A valid file whose catalog holds `[1 BIG]`: the parser reads BIG once as
 * the lookahead for a `1 BIG R` reference, then again as the number.
 */
const fileWithOversizedNumber = async () => {
  const doc = await PDFDocument.create();
  doc.catalog.set(
    PDFName.of('Big'),
    doc.context.obj([1, PDFName.of(MARK)]),
  );
  const bytes = await doc.save({ useObjectStreams: false });
  const text = asText(bytes);
  expect(text).toContain(`/${MARK}`);
  return asBytes(text.replace(`/${MARK}`, BIG));
};

/** One char per byte, both ways (TextDecoder 'latin1' is windows-1252). */
const asText = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => String.fromCharCode(b)).join('');
const asBytes = (text: string) =>
  Uint8Array.from(text, (c) => c.charCodeAt(0));

describe('warning handler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('receives load warnings once each, and the console gets none', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const warnings: PDFWarning[] = [];
    const doc = await PDFDocument.load(await fileWithOversizedNumber(), {
      onWarning: (w) => warnings.push(w),
    });
    expect(warnings).toEqual([
      {
        code: 'number-too-large',
        message: `Parsed number that is too large for some PDF readers: ${BIG}, not capping.`,
      },
    ]);
    expect(consoleWarn).not.toHaveBeenCalled();
    // Saving re-reads nothing into the handler.
    await doc.save();
    expect(warnings).toHaveLength(1);
  });

  it('defaults to console.warn', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await PDFDocument.load(await fileWithOversizedNumber(), {
      capNumbers: true,
    });
    expect(consoleWarn).toHaveBeenCalledExactlyOnceWith(
      `Parsed number that is too large for some PDF readers: ${BIG}, using Number.MAX_SAFE_INTEGER instead.`,
    );
  });

  it('propagates a throwing handler from load', async () => {
    const bytes = await fileWithOversizedNumber();
    await expect(
      PDFDocument.load(bytes, {
        onWarning: () => {
          throw new Error('handler');
        },
      }),
    ).rejects.toThrow('handler');
  });

  it('receives warnings of later operations, also on copies', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const warnings: PDFWarning[] = [];
    const onWarning = (w: PDFWarning) => warnings.push(w);
    const doc = await PDFDocument.create({ onWarning });
    doc.addPage();
    doc.getForm().createTextField('a').enableCombing();
    expect(warnings.map((w) => w.code)).toEqual(['comb-without-max-length']);

    const copy = await doc.copy();
    copy.getForm().createTextField('b').enableCombing();
    expect(warnings).toHaveLength(2);
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('receives the /Perms inconsistency of a decrypting load', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.encrypt({ userPassword: 'u', ownerPassword: 'o' });
    const text = asText(await doc.save());
    // Change one digit of /P, keeping every offset: /Perms then disagrees.
    const tampered = text.replace(/\/P -(\d)/, (_, d) => `/P -${d === '1' ? '2' : '1'}`);
    expect(tampered).not.toEqual(text);
    const warnings: PDFWarning[] = [];
    await PDFDocument.load(
      asBytes(tampered),
      { password: 'u', onWarning: (w) => warnings.push(w) },
    );
    expect(warnings.map((w) => w.code)).toEqual([
      'encryption-perms-inconsistent',
    ]);
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('rejects a handler that is not a function', async () => {
    await expect(
      PDFDocument.create({ onWarning: 'no' as unknown as () => void }),
    ).rejects.toThrow();
  });
});
