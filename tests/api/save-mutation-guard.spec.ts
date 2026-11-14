import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "../../src/index";
import FileEmbedder from "../../src/core/embedders/FileEmbedder";

const savingError = /while a save is in progress/;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

describe("save mutation guard", () => {
  it.each(["save", "saveIncremental", "commit"] as const)(
    "guards mutations throughout %s and releases after success",
    async (method) => {
      const source = await PDFDocument.create();

      const doc = await PDFDocument.load(await source.save(), {
        forIncrementalUpdate: true,
      });

      await doc.attach(new Uint8Array([1]), "pending.txt");
      const entered = deferred();
      const release = deferred();
      const original = FileEmbedder.prototype.embedIntoContext;

      const embed = vi
        .spyOn(FileEmbedder.prototype, "embedIntoContext")
        .mockImplementationOnce(async function (...args) {
          entered.resolve();
          await release.promise;

          return original.apply(this, args);
        });

      try {
        const snapshot = doc.takeSnapshot();

        const saving = method === "saveIncremental" ? doc.saveIncremental(snapshot) : doc[method]();

        await entered.promise;
        expect(() => doc.detach("pending.txt")).toThrow(savingError);
        expect(() => doc.embedFacturX("<invoice/>")).toThrow(savingError);
        await expect(doc.attach(new Uint8Array([2]), "other.txt")).rejects.toThrow(savingError);
        await expect(doc.save()).rejects.toThrow(savingError);
        await expect(doc.saveIncremental(snapshot)).rejects.toThrow(savingError);
        await expect(doc.commit()).rejects.toThrow(savingError);
        release.resolve();
        await saving;
        expect(embed).toHaveBeenCalledTimes(1);
        doc.detach("pending.txt");
        await doc.attach(new Uint8Array([2]), "other.txt");
        await doc.save();
      } finally {
        release.resolve();
        embed.mockRestore();
      }
    },
  );

  it("releases the guard after an embed fails", async () => {
    const doc = await PDFDocument.create();
    await doc.attach(new Uint8Array([1]), "pending.txt");

    const embed = vi
      .spyOn(FileEmbedder.prototype, "embedIntoContext")
      .mockRejectedValueOnce(new Error("embed failed"));

    try {
      await expect(doc.save()).rejects.toThrow("embed failed");
      doc.detach("pending.txt");
      await doc.save();
    } finally {
      embed.mockRestore();
    }
  });

  it("embeds a snapshot even when the pending array shrinks during an await", async () => {
    const doc = await PDFDocument.create();
    const entered = deferred();
    const release = deferred();
    const first = {
      embed: vi.fn(async () => {
        entered.resolve();
        await release.promise;
      }),
    };
    const second = { embed: vi.fn(async () => {}) };
    const pending = [first, second];

    const internal = doc as unknown as {
      embedAll(items: { embed(): Promise<void> }[]): Promise<void>;
    };

    const embedding = internal.embedAll(pending);
    await entered.promise;
    pending.splice(0, 1);
    release.resolve();
    await embedding;
    expect(first.embed).toHaveBeenCalledTimes(1);
    expect(second.embed).toHaveBeenCalledTimes(1);
  });
});
