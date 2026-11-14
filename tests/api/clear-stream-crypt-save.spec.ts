import { describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from "../../src/index";

const key = PDFName.of;

describe("full saves without encryption", () => {
  for (const useObjectStreams of [false, true]) {
    for (const chain of [false, true]) {
      it(`removes caller-authored Crypt filters from emitted copies (object streams: ${useObjectStreams}, chain: ${chain})`, async () => {
        const source = await PDFDocument.create({ updateMetadata: false });
        source.addPage();
        source.encrypt({ userPassword: "user", ownerPassword: "owner" });

        const doc = await PDFDocument.load(await source.save(), {
          password: "user",
          updateMetadata: false,
        });

        const { context } = doc;
        const cryptParms = context.obj({ Name: "CallerFilter" });
        const otherParms = context.obj({ Columns: 17 });

        const filters = chain
          ? context.obj(["Crypt", "ASCIIHexDecode", "FlateDecode"])
          : key("Crypt");

        const parms = chain ? context.obj([cryptParms, null, otherParms]) : cryptParms;

        const stream = context.stream("0123456789", {
          Filter: filters,
          DecodeParms: parms,
        });

        const ref = context.register(stream);
        doc.catalog.set(key("TestStream"), ref);
        const before = stream.dict.toString();
        const contents = stream.getContents().slice();

        for (let save = 0; save < 2; save++) {
          const bytes = await doc.save({ useObjectStreams });
          const text = new TextDecoder("latin1").decode(bytes);
          expect(text).not.toMatch(/\/Crypt\b/);
          expect(text).not.toMatch(/\/Encrypt\b/);
          expect(stream.dict.toString()).toBe(before);
          expect(stream.dict.get(key("Filter"))).toBe(filters);
          expect(stream.dict.get(key("DecodeParms"))).toBe(parms);
          expect(stream.getContents()).toEqual(contents);
          const loaded = await PDFDocument.load(bytes, { updateMetadata: false });
          const emitted = loaded.context.lookup(ref, PDFRawStream);
          expect(emitted.getContents()).toEqual(contents);

          if (chain) {
            expect(emitted.dict.lookup(key("Filter"))?.toString()).toBe(
              "[ /ASCIIHexDecode /FlateDecode ]",
            );
            expect(emitted.dict.lookup(key("DecodeParms"))?.toString()).toBe(
              context.obj([null, otherParms]).toString(),
            );
          } else {
            expect(emitted.dict.has(key("Filter"))).toBe(false);
            expect(emitted.dict.has(key("DecodeParms"))).toBe(false);
          }

          expect(cryptParms.lookup(key("Name"))).toBe(key("CallerFilter"));
          expect(otherParms).toBeInstanceOf(PDFDict);
        }
      });
    }
  }
});
