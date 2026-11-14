import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFHexString, PDFName, PDFString } from '../../src/index';
import PDFSecurity, {
  type SecurityOptions,
} from '../../src/core/security/PDFSecurity';

// Remove only the trailer entry, preserving byte offsets and ciphertext.
const withoutId = (bytes: Uint8Array) => {
  const text = Buffer.from(bytes).toString('latin1');
  const id = /\/ID\s*\[\s*<[^>]*>\s*<[^>]*>\s*\]/;
  expect(text).toMatch(id);

  return new Uint8Array(
    Buffer.from(text.replace(id, (match) => ' '.repeat(match.length)), 'latin1'),
  );
};

const source = async () => {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.addPage().node.set(PDFName.of('Note'), PDFString.of('decrypted note'));
  doc.setTitle('decrypted title');

  return doc;
};

const assertDecrypted = (doc: PDFDocument) => {
  expect(doc.getTitle()).toBe('decrypted title');
  expect(doc.getPage(0).node.lookup(PDFName.of('Note'), PDFString, PDFHexString).decodeText())
    .toBe('decrypted note');
};

const legacyProfiles = [
  { algorithm: 'AES-128', v: 4, r: 4, keyBits: 128 },
  { algorithm: 'RC4-128', v: 2, r: 3, keyBits: 128 },
  { algorithm: 'RC4-40', v: 1, r: 2, keyBits: 40 },
] as const;

describe('encrypted PDFs without a trailer ID', () => {
  it('decrypts R6 with the correct password after removing its ID', async () => {
    const doc = await source();
    doc.encrypt({ userPassword: 'user', ownerPassword: 'owner' });
    const bytes = withoutId(await doc.save({ useObjectStreams: false }));
    assertDecrypted(await PDFDocument.load(bytes, { password: 'user' }));
    await expect(PDFDocument.load(bytes, { password: 'wrong' }))
      .rejects.toThrow('Password incorrect');
  });

  it('decrypts owner-only R6 with an explicit or implicit empty password', async () => {
    const doc = await source();
    doc.encrypt({ ownerPassword: 'owner' });
    const bytes = withoutId(await doc.save({ useObjectStreams: false }));
    assertDecrypted(await PDFDocument.load(bytes, { password: '' }));
    assertDecrypted(await PDFDocument.load(bytes));
  });

  for (const profile of legacyProfiles) {
    it(`decrypts ${profile.algorithm} keyed with an empty ID, like pdf.js`, async () => {
      const doc = await source();

      const options: SecurityOptions = {
        algorithm: profile.algorithm,
        userPassword: 'user',
        ownerPassword: 'owner',
      };

      // Author a legacy fixture whose key actually uses the empty ID.
      // Removing a random ID after encryption cannot produce such a file.
      const security: any = PDFSecurity.create(doc.context, options);
      security.id = new Uint8Array();
      security.encryption = security.initializeV1V2V4(profile, options);
      doc.context.security = security.encrypt();
      const bytes = withoutId(await doc.save({ useObjectStreams: false }));

      for (const password of ['user', 'owner']) {
        assertDecrypted(await PDFDocument.load(bytes, { password }));
      }

      await expect(PDFDocument.load(bytes, { password: 'wrong' }))
        .rejects.toThrow('Password incorrect');
    });

    it(`rejects ${profile.algorithm} keyed with a nonempty ID after removal, like pdf.js`, async () => {
      const doc = await source();
      doc.encrypt({ algorithm: profile.algorithm, userPassword: 'user' });
      const bytes = withoutId(await doc.save({ useObjectStreams: false }));
      await expect(PDFDocument.load(bytes, { password: 'user' }))
        .rejects.toThrow('Password incorrect');
    });
  }
});
