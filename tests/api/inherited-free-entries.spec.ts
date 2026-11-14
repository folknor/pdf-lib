import { describe, expect, it } from "vitest";
import { freeEntries } from "../../src/core/writers/PDFWriter";
import { PDFDocument, PDFRef, PDFString } from "../../src/index";

const entry = (offset: number, gen: number, type: "n" | "f") =>
  `${String(offset).padStart(10, "0")} ${String(gen).padStart(5, "0")} ${type} \n`;

/**
 * One revision: catalog 1, pages 2, page 5; number 3 frozen (free at
 * 65535), number 4 free with generation 1 next.
 */
const fileWithFreeEntries = (): Uint8Array => {
  let text = "%PDF-1.7\n";

  const add = (part: string) => {
    const at = text.length;
    text += part;

    return at;
  };

  const o1 = add("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  const o2 = add("2 0 obj\n<< /Type /Pages /Kids [5 0 R] /Count 1 >>\nendobj\n");

  const o5 = add("5 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10 10] >>\nendobj\n");

  const x = add(
    `xref\n0 6\n${entry(3, 65535, "f")}${entry(o1, 0, "n")}${entry(o2, 0, "n")}${entry(4, 65535, "f")}${entry(0, 1, "f")}${entry(o5, 0, "n")}trailer\n<< /Size 6 /Root 1 0 R >>\n`,
  );

  add(`startxref\n${x}\n%%EOF\n`);

  return new Uint8Array(Buffer.from(text, "latin1"));
};

const load = () => PDFDocument.load(fileWithFreeEntries(), { forIncrementalUpdate: true });

describe("increments respect the free entries of the file they extend", () => {
  it("keeps inherited free generations and excludes a reused number", async () => {
    const doc = await load();
    const snapshot = doc.takeSnapshot();
    expect(freeEntries(doc.context, snapshot, [])).toEqual([
      { ref: PDFRef.of(3, 65535), nextFreeObjectNumber: 4 },
      { ref: PDFRef.of(4, 1), nextFreeObjectNumber: 0 },
    ]);
    const reused = PDFRef.of(4, 1);
    doc.context.assign(reused, PDFString.of("reused"));
    expect(freeEntries(doc.context, snapshot, [reused])).toEqual([
      { ref: PDFRef.of(3, 65535), nextFreeObjectNumber: 0 },
    ]);
    // Assigning and deleting a free number does not advance its generation.
    doc.context.delete(reused);
    expect(freeEntries(doc.context, snapshot, [])).toEqual([
      { ref: PDFRef.of(3, 65535), nextFreeObjectNumber: 4 },
      { ref: PDFRef.of(4, 1), nextFreeObjectNumber: 0 },
    ]);
  });

  it("falls back to context generations only for an unreadable chain", async () => {
    const doc = await load();
    const snapshot = doc.takeSnapshot();
    const page = doc.context.lookup(PDFRef.of(5))!;
    doc.context.delete(PDFRef.of(5));
    const ref = PDFRef.of(5, 65535);
    doc.context.assign(ref, page);
    doc.context.delete(ref);
    expect(
      freeEntries(doc.context, snapshot, []).find(({ ref }) => ref.objectNumber === 5)?.ref,
    ).toBe(PDFRef.of(5, 1));
    doc.context.pdfFileDetails.originalBytes = new Uint8Array();
    expect(freeEntries(doc.context, snapshot, [])).toEqual([{ ref, nextFreeObjectNumber: 0 }]);
  });

  for (const useObjectStreams of [false, true]) {
    describe(useObjectStreams ? "xref stream" : "xref table", () => {
      it("refuses to write a number frozen at generation 65535", async () => {
        const doc = await load();
        const snapshot = doc.takeSnapshot();
        doc.context.assign(PDFRef.of(3, 0), PDFString.of("revived"));
        await expect(doc.saveIncremental(snapshot, { useObjectStreams })).rejects.toThrow(
          /froze number 3/,
        );
      });

      it("refuses a free number reused under another generation", async () => {
        const doc = await load();
        const snapshot = doc.takeSnapshot();
        doc.context.assign(PDFRef.of(4, 0), PDFString.of("reused"));
        await expect(doc.saveIncremental(snapshot, { useObjectStreams })).rejects.toThrow(
          /reused with generation 1/,
        );
      });

      it("writes a free number reused with the generation it names", async () => {
        const doc = await load();
        const snapshot = doc.takeSnapshot();
        doc.context.assign(PDFRef.of(4, 1), PDFString.of("reused"));
        const bytes = await doc.saveIncremental(snapshot, { useObjectStreams });
        expect(Buffer.from(bytes).toString("latin1")).toContain("4 1 obj");
      });

      it("refuses object 0", async () => {
        const doc = await load();
        const snapshot = doc.takeSnapshot();
        doc.context.assign(PDFRef.of(0, 0), PDFString.of("head"));
        await expect(doc.saveIncremental(snapshot, { useObjectStreams })).rejects.toThrow(
          /object number 0/,
        );
      });

      it("holds a number freed by a commit to its next generation", async () => {
        const doc = await load();
        doc.takeSnapshot();
        doc.removePage(0);
        doc.context.delete(PDFRef.of(5, 0));
        await doc.commit({ useObjectStreams });
        const snapshot = doc.takeSnapshot();
        doc.context.assign(PDFRef.of(5, 0), PDFString.of("stale"));
        await expect(doc.saveIncremental(snapshot, { useObjectStreams })).rejects.toThrow(
          /reused with generation 1/,
        );
        doc.context.delete(PDFRef.of(5, 0));
        doc.context.assign(PDFRef.of(5, 1), PDFString.of("fresh"));
        await doc.saveIncremental(snapshot, { useObjectStreams });
      });
    });
  }
});
