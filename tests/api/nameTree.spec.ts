import {
  checkNameTree,
  insertIntoNameTree,
  isWritableFlatNameTree,
  readNameTree,
  removeFromNameTree,
  sortNameTreeNames,
  UnwritableNameTreeError,
} from "../../src/api/nameTree";
import { PDFArray, PDFContext, PDFDict, PDFHexString, PDFName, PDFString } from "../../src/core";

const decodeNameKeys = (names: PDFArray): string[] => {
  const keys: string[] = [];

  for (let idx = 0, len = names.size(); idx < len; idx += 2) {
    const key = names.get(idx);

    if (key instanceof PDFString || key instanceof PDFHexString) {
      keys.push(key.decodeText());
    }
  }

  return keys;
};

const decodeLimits = (node: PDFDict): string[] =>
  node
    .lookup(PDFName.of("Limits"), PDFArray)
    .asArray()
    .map((k) => (k as PDFHexString).decodeText());

describe("nameTree helpers", () => {
  let context: PDFContext;

  beforeEach(() => {
    context = PDFContext.create();
  });

  describe("isWritableFlatNameTree()", () => {
    it("accepts empty nodes and flat Names arrays", () => {
      expect(isWritableFlatNameTree(context.obj({}))).toBe(true);
      expect(
        isWritableFlatNameTree(
          context.obj({
            Names: [PDFHexString.fromText("a"), context.register(context.obj({}))],
          }),
        ),
      ).toBe(true);
    });

    it("rejects Kids trees and malformed Names", () => {
      const leafRef = context.register(context.obj({ Names: [] }));
      expect(isWritableFlatNameTree(context.obj({ Kids: [leafRef] }))).toBe(false);
      expect(isWritableFlatNameTree(context.obj({ Kids: [leafRef], Names: [] }))).toBe(false);
      expect(isWritableFlatNameTree(context.obj({ Names: [PDFHexString.fromText("a")] }))).toBe(
        false,
      );
      expect(isWritableFlatNameTree(context.obj({ Names: [PDFName.of("NotAString"), 1] }))).toBe(
        false,
      );
    });
  });

  describe("sortNameTreeNames()", () => {
    it("sorts keys in PDF byte order", () => {
      const names = context.obj([
        PDFHexString.fromText("2.jpg"),
        context.register(context.obj({})),
        PDFHexString.fromText("10.jpg"),
        context.register(context.obj({})),
        PDFHexString.fromText("1.jpg"),
        context.register(context.obj({})),
      ]);

      sortNameTreeNames(names);

      expect(decodeNameKeys(names)).toEqual(["1.jpg", "10.jpg", "2.jpg"]);
    });

    it("compares raw bytes across string encodings", () => {
      // A UTF-16 key starts with the FE FF BOM, so it sorts after any
      // PDFDocEncoding literal key.
      const names = context.obj([
        PDFHexString.fromText("a"),
        context.register(context.obj({})),
        PDFString.of("z"),
        context.register(context.obj({})),
      ]);

      sortNameTreeNames(names);

      expect(decodeNameKeys(names)).toEqual(["z", "a"]);
    });
  });

  describe("insertIntoNameTree()", () => {
    const key = (k: string) => PDFHexString.fromText(k);

    const leaf = (keys: string[]) => {
      const names: any[] = [];

      for (const k of keys) names.push(key(k), context.register(context.obj({})));

      return context.register(
        context.obj({ Names: names, Limits: [key(keys[0]!), key(keys[keys.length - 1]!)] }),
      );
    };

    const keysOf = (root: PDFDict) => readNameTree(root).map((e) => e.key.decodeText());

    it("creates Names, appends, and keeps entries sorted", () => {
      let root = context.obj({}) as PDFDict;

      for (const name of ["2.jpg", "10.jpg", "1.jpg"]) {
        root = insertIntoNameTree(context, root, key(name), context.register(context.obj({}))).root;
      }

      expect(decodeNameKeys(root.lookup(PDFName.of("Names"), PDFArray))).toEqual([
        "1.jpg",
        "10.jpg",
        "2.jpg",
      ]);
    });

    it("repairs an unsorted flat root, keeps values paired, drops root Limits, edits nothing in place", () => {
      const refZ = context.register(context.obj({}));
      const refA = context.register(context.obj({}));
      const refM = context.register(context.obj({}));
      const oldNames = context.obj([key("zebra"), refZ, key("alpha"), refA]);
      const node = context.obj({ Names: oldNames, Limits: [key("a"), key("z")] }) as PDFDict;

      const { root } = insertIntoNameTree(context, node, key("middle"), refM);

      const names = root.lookup(PDFName.of("Names"), PDFArray);
      expect(decodeNameKeys(names)).toEqual(["alpha", "middle", "zebra"]);
      expect(names.get(1)).toBe(refA);
      expect(names.get(3)).toBe(refM);
      expect(names.get(5)).toBe(refZ);
      expect(root.has(PDFName.of("Limits"))).toBe(false);
      expect(decodeNameKeys(oldNames)).toEqual(["zebra", "alpha"]);
    });

    it("inserts into the right leaf of a Kids tree and widens Limits copy-on-write", () => {
      const l1 = leaf(["b", "d"]);
      const l2 = leaf(["m", "p"]);

      const mid = context.register(context.obj({ Kids: [l1, l2], Limits: [key("b"), key("p")] }));

      const root = context.obj({ Kids: [mid] }) as PDFDict;

      const below = insertIntoNameTree(context, root, key("a"), context.obj({}));
      expect(keysOf(below.root)).toEqual(["a", "b", "d", "m", "p"]);
      const gap = insertIntoNameTree(context, root, key("f"), context.obj({}));
      expect(keysOf(gap.root)).toEqual(["b", "d", "f", "m", "p"]);
      const above = insertIntoNameTree(context, root, key("z"), context.obj({}));
      expect(keysOf(above.root)).toEqual(["b", "d", "m", "p", "z"]);
      expect(above.displaced).toEqual(expect.arrayContaining([mid, l2]));
      expect(above.displaced).not.toContain(l1);

      // The old tree, which another structure may share, is unchanged.
      expect(keysOf(root)).toEqual(["b", "d", "m", "p"]);
      const newMid = above.root.lookup(PDFName.of("Kids"), PDFArray).lookup(0, PDFDict);
      expect(decodeLimits(newMid)).toEqual(["b", "z"]);
      expect(newMid.lookup(PDFName.of("Kids"), PDFArray).get(0)).toBe(l1);
      checkNameTree(above.root);
    });

    it("refuses malformed Kids trees before changing anything", () => {
      const good = leaf(["b"]);

      const stale = context.register(
        context.obj({ Names: [key("b"), context.obj({})], Limits: [key("a"), key("c")] }),
      );

      const bad = [
        context.obj({ Kids: [stale] }),
        context.obj({ Kids: [good], Names: [] }),
        context.obj({ Kids: [good, good] }),
        context.obj({ Kids: [leaf(["m"]), leaf(["b"])] }),
        context.obj({ Kids: [context.register(context.obj({ Names: [], Limits: [] }))] }),
        context.obj({ Kids: [PDFName.of("X")] }),
      ] as PDFDict[];

      for (const root of bad) {
        expect(() => insertIntoNameTree(context, root, key("x"), context.obj({}))).toThrow(
          UnwritableNameTreeError,
        );
      }
    });
  });

  describe("removeFromNameTree()", () => {
    const key = (k: string) => PDFHexString.fromText(k);

    const leaf = (keys: string[]) => {
      const names: any[] = [];

      for (const k of keys) names.push(key(k), context.register(context.obj({})));

      return context.register(
        context.obj({ Names: names, Limits: [key(keys[0]!), key(keys[keys.length - 1]!)] }),
      );
    };

    it("removes from every leaf, prunes emptied kids and narrows Limits", () => {
      const l1 = leaf(["a", "b"]);
      const l2 = leaf(["m"]);
      const root = context.obj({ Kids: [l1, l2] }) as PDFDict;

      expect(removeFromNameTree(context, root, (k) => k.decodeText() === "q")).toBeUndefined();

      const edit = removeFromNameTree(context, root, (k) => ["a", "m"].includes(k.decodeText()))!;
      expect(edit.removed).toHaveLength(2);
      expect(readNameTree(edit.root).map((e) => e.key.decodeText())).toEqual(["b"]);
      const kids = edit.root.lookup(PDFName.of("Kids"), PDFArray);
      expect(kids.size()).toBe(1);
      expect(decodeLimits(kids.lookup(0, PDFDict))).toEqual(["b", "b"]);
      expect(edit.displaced).toEqual(expect.arrayContaining([l1, l2]));
      checkNameTree(edit.root);

      const all = removeFromNameTree(context, root, () => true)!;
      expect(all.root.has(PDFName.of("Kids"))).toBe(false);
      expect(all.root.lookup(PDFName.of("Names"), PDFArray).size()).toBe(0);
    });
  });

  describe("readNameTree()", () => {
    it("reads Kids trees and tolerates cycles and junk", () => {
      const leafRef = context.register(
        context.obj({ Names: [PDFHexString.fromText("a"), 1, PDFName.of("bad"), 2] }),
      );

      const loop = context.nextRef();
      context.assign(loop, context.obj({ Kids: [leafRef, loop, 7] }));
      const root = context.obj({ Kids: [loop, leafRef] }) as PDFDict;
      expect(readNameTree(root).map((e) => e.key.decodeText())).toEqual(["a"]);
      const junk = context.obj({
        Kids: [context.obj({ Kids: 7 }), context.obj({ Names: 7 }), leafRef],
      });
      expect(readNameTree(junk as PDFDict).map((e) => e.key.decodeText())).toEqual(["a"]);
    });

    it("displaces the indirect arrays of a pruned direct node", () => {
      const spec = context.register(context.obj({}));
      const namesRef = context.register(context.obj([PDFHexString.fromText("a"), spec]));
      const a = PDFHexString.fromText("a");
      const root = context.obj({
        Kids: [context.obj({ Names: namesRef, Limits: [a, a] })],
      }) as PDFDict;
      const edit = removeFromNameTree(context, root, () => true)!;
      expect(edit.displaced).toContain(namesRef);
    });
  });
});
