import fs from "fs";
import { describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFRef, PDFString } from "../../src/index";

const algorithms = ["AES-256", "AES-128", "RC4-128", "RC4-40"] as const;
const latin1 = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

const encryptedBytes = async (algorithm: (typeof algorithms)[number]) => {
  const pdfDoc = await PDFDocument.create({ updateMetadata: false });
  const page = pdfDoc.addPage([300, 200]);
  page.node.set(PDFName.of("Note"), PDFString.of("original note"));
  pdfDoc.encrypt({ userPassword: "user", ownerPassword: "o", algorithm });

  return pdfDoc.save({ useObjectStreams: false });
};

const noteOf = (doc: PDFDocument, key: string) =>
  (doc.getPage(0).node.get(PDFName.of(key)) as PDFHexString | PDFString).decodeText();

describe("decrypted literal strings", () => {
  for (const algorithm of algorithms) {
    it(`preserves plaintext bytes through load and re-save (${algorithm})`, async () => {
      const plaintext = "a\\nb(unbalanced\rCR\r\nCRLF)extra)";
      const expectedBytes = Uint8Array.from(plaintext, (char) => char.charCodeAt(0));
      const source = await PDFDocument.create({ updateMetadata: false });
      source.addPage();
      source.setTitle(plaintext);
      source.context
        .lookup(source.context.trailerInfo.Info, PDFDict)
        .set(PDFName.of("Title"), PDFHexString.fromBytes(expectedBytes));
      source.encrypt({ userPassword: "user", ownerPassword: "owner", algorithm });
      const encrypted = await source.save({ useObjectStreams: false });

      // Writers emit encrypted strings as hex. Rewrite only the ciphertext's
      // representation to exercise encrypted literal input with valid xrefs.
      const ciphertextDoc = await PDFDocument.load(encrypted, {
        ignoreEncryption: true,
        updateMetadata: false,
      });

      // Bypass the keyless-save check to author a ciphertext fixture.
      ciphertextDoc.context.baselineEncryption = undefined;

      const info = ciphertextDoc.context.lookup(ciphertextDoc.context.trailerInfo.Info, PDFDict);

      const ciphertext = info.lookup(PDFName.of("Title"), PDFHexString).asBytes();

      const literal = Array.from(
        ciphertext,
        (byte) => `\\${byte.toString(8).padStart(3, "0")}`,
      ).join("");

      info.set(PDFName.of("Title"), PDFString.of(literal));
      const literalInput = await ciphertextDoc.save({ useObjectStreams: false });

      const loaded = await PDFDocument.load(literalInput, {
        password: "user",
        updateMetadata: false,
      });

      const assertPlaintext = (doc: PDFDocument) => {
        const title = doc.context
          .lookup(doc.context.trailerInfo.Info, PDFDict)
          .lookup(PDFName.of("Title"), PDFString, PDFHexString);

        expect(title.asBytes()).toEqual(expectedBytes);
        expect(title.decodeText()).toBe(plaintext);
        expect(doc.getTitle()).toBe(plaintext);
      };

      assertPlaintext(loaded);

      for (const useObjectStreams of [false, true]) {
        const saved = await loaded.save({ useObjectStreams });
        const reopened = await PDFDocument.load(saved, { updateMetadata: false });
        assertPlaintext(reopened);
      }
    });
  }
});

describe("incremental saves of encrypted files", () => {
  for (const algorithm of algorithms) {
    for (const useObjectStreams of [false, true]) {
      it(`encrypts the increment under the file's ${algorithm} handler (object streams ${useObjectStreams})`, async () => {
        const original = await encryptedBytes(algorithm);

        const doc = await PDFDocument.load(original, {
          password: "user",
          forIncrementalUpdate: true,
          updateMetadata: false,
        });

        doc.getPage(0).node.set(PDFName.of("Added"), PDFString.of("added note"));
        doc.getPage(0).drawText("drawn text");

        const updated = await doc.commit({ useObjectStreams });

        expect(updated.subarray(0, original.length)).toEqual(original);
        const increment = latin1(updated.subarray(original.length));
        expect(increment).not.toContain("added note");
        expect(increment).not.toContain("drawn text");
        expect(increment).toMatch(/\/Encrypt \d+ 0 R/);

        const reopened = await PDFDocument.load(updated, {
          password: "user",
          updateMetadata: false,
        });

        expect(noteOf(reopened, "Note")).toBe("original note");
        expect(noteOf(reopened, "Added")).toBe("added note");
      });
    }
  }

  it("keeps the file /ID across the increment", async () => {
    const original = await encryptedBytes("RC4-128");

    const doc = await PDFDocument.load(original, {
      password: "user",
      forIncrementalUpdate: true,
      updateMetadata: false,
    });

    const id = latin1(original).match(/\/ID \[[^\]]*\]/)![0];
    const updated = await doc.save({ useObjectStreams: false });
    expect(latin1(updated.subarray(original.length))).toContain(id);
  });

  it("rewrites on save() after encrypt() and refuses increments", async () => {
    const original = fs.readFileSync("./assets/pdfs/normal.pdf");

    const doc = await PDFDocument.load(original, {
      forIncrementalUpdate: true,
      updateMetadata: false,
    });

    doc.encrypt({ userPassword: "user" });

    await expect(doc.commit()).rejects.toThrow(/cannot change the encryption/);
    await expect(doc.saveIncremental(doc.takeSnapshot())).rejects.toThrow(
      /cannot change the encryption/,
    );

    const saved = await doc.save();
    expect(saved.subarray(0, original.length)).not.toEqual(new Uint8Array(original));
    const reopened = await PDFDocument.load(saved, { password: "user" });
    expect(reopened.getPageCount()).toBe(doc.getPageCount());
    await expect(doc.commit()).rejects.toThrow(/cannot change the encryption/);
  });

  it("refuses increments onto a file loaded encrypted without a password", async () => {
    const original = await encryptedBytes("AES-256");

    const doc = await PDFDocument.load(original, {
      ignoreEncryption: true,
      forIncrementalUpdate: true,
      updateMetadata: false,
    });

    await expect(doc.commit()).rejects.toThrow(/without its password/);
    await expect(doc.save()).rejects.toThrow(/without its password/);
    await expect(doc.save({ rewrite: true })).rejects.toThrow(/without its password/);
  });

  it("refuses full saves, encryption and page embedding of a keyless load", async () => {
    const original = await encryptedBytes("AES-256");
    const doc = await PDFDocument.load(original, { ignoreEncryption: true });
    await expect(doc.save()).rejects.toThrow(/without its password/);
    await expect(doc.save({ compress: true })).rejects.toThrow(/without its password/);
    await expect(doc.saveAsBase64()).rejects.toThrow(/without its password/);
    expect(() => doc.encrypt({ userPassword: "u", ownerPassword: "o" })).toThrow(
      /without its password/,
    );
    const target = await PDFDocument.create();
    await expect(target.embedPage(doc.getPage(0))).rejects.toThrow(/copy or embed pages/);
  });

  it("refuses an increment that rewrites the encryption dictionary", async () => {
    const original = await encryptedBytes("AES-128");

    const doc = await PDFDocument.load(original, {
      password: "user",
      forIncrementalUpdate: true,
      updateMetadata: false,
    });

    const encryptRef = latin1(original).match(/\/Encrypt (\d+) 0 R/)!;
    doc.context.snapshot!.markRefForSave(PDFRef.of(Number(encryptRef[1])));
    await expect(doc.commit()).rejects.toThrow(/encryption dictionary/);
  });
});
