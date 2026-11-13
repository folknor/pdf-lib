import {
  addNameTreeEntry,
  isWritableFlatNameTree,
  sortNameTreeNames,
} from '../../src/api/nameTree';
import {
  PDFArray,
  PDFContext,
  type PDFDict,
  PDFHexString,
  PDFName,
  PDFString,
} from '../../src/core';

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

describe('nameTree helpers', () => {
  let context: PDFContext;

  beforeEach(() => {
    context = PDFContext.create();
  });

  describe('isWritableFlatNameTree()', () => {
    it('accepts empty nodes and flat Names arrays', () => {
      expect(isWritableFlatNameTree(context.obj({}))).toBe(true);
      expect(
        isWritableFlatNameTree(
          context.obj({
            Names: [PDFHexString.fromText('a'), context.register(context.obj({}))],
          }),
        ),
      ).toBe(true);
    });

    it('rejects Kids trees and malformed Names', () => {
      const leafRef = context.register(context.obj({ Names: [] }));
      expect(isWritableFlatNameTree(context.obj({ Kids: [leafRef] }))).toBe(false);
      expect(
        isWritableFlatNameTree(context.obj({ Kids: [leafRef], Names: [] })),
      ).toBe(false);
      expect(
        isWritableFlatNameTree(context.obj({ Names: [PDFHexString.fromText('a')] })),
      ).toBe(false);
      expect(
        isWritableFlatNameTree(context.obj({ Names: [PDFName.of('NotAString'), 1] })),
      ).toBe(false);
    });
  });

  describe('sortNameTreeNames()', () => {
    it('sorts keys in PDF byte order', () => {
      const names = context.obj([
        PDFHexString.fromText('2.jpg'),
        context.register(context.obj({})),
        PDFHexString.fromText('10.jpg'),
        context.register(context.obj({})),
        PDFHexString.fromText('1.jpg'),
        context.register(context.obj({})),
      ]);

      sortNameTreeNames(names);

      expect(decodeNameKeys(names)).toEqual(['1.jpg', '10.jpg', '2.jpg']);
    });

    it('compares raw bytes across string encodings', () => {
      // A UTF-16 key starts with the FE FF BOM, so it sorts after any
      // PDFDocEncoding literal key.
      const names = context.obj([
        PDFHexString.fromText('a'),
        context.register(context.obj({})),
        PDFString.of('z'),
        context.register(context.obj({})),
      ]);

      sortNameTreeNames(names);

      expect(decodeNameKeys(names)).toEqual(['z', 'a']);
    });
  });

  describe('addNameTreeEntry()', () => {
    it('creates Names, appends, and keeps entries sorted', () => {
      const node = context.obj({}) as PDFDict;
      for (const name of ['2.jpg', '10.jpg', '1.jpg']) {
        expect(
          addNameTreeEntry(
            node,
            PDFHexString.fromText(name),
            context.register(context.obj({})),
          ),
        ).toBe(true);
      }

      const names = node.lookup(PDFName.of('Names'), PDFArray);
      expect(decodeNameKeys(names)).toEqual(['1.jpg', '10.jpg', '2.jpg']);
    });

    it('repairs an already-unsorted flat Names array and keeps values paired', () => {
      const refZ = context.register(context.obj({}));
      const refA = context.register(context.obj({}));
      const refM = context.register(context.obj({}));
      const node = context.obj({
        Names: [PDFHexString.fromText('zebra'), refZ, PDFHexString.fromText('alpha'), refA],
      }) as PDFDict;

      expect(addNameTreeEntry(node, PDFHexString.fromText('middle'), refM)).toBe(true);

      const names = node.lookup(PDFName.of('Names'), PDFArray);
      expect(decodeNameKeys(names)).toEqual(['alpha', 'middle', 'zebra']);
      expect(names.get(1)).toBe(refA);
      expect(names.get(3)).toBe(refM);
      expect(names.get(5)).toBe(refZ);
    });

    it('updates Limits when present', () => {
      const node = context.obj({
        Names: [PDFHexString.fromText('b'), context.register(context.obj({}))],
        Limits: [PDFHexString.fromText('b'), PDFHexString.fromText('b')],
      }) as PDFDict;

      addNameTreeEntry(node, PDFHexString.fromText('a'), context.register(context.obj({})));
      addNameTreeEntry(node, PDFHexString.fromText('c'), context.register(context.obj({})));

      const limits = node.lookup(PDFName.of('Limits'), PDFArray);
      expect(limits.lookup(0, PDFHexString).decodeText()).toBe('a');
      expect(limits.lookup(1, PDFHexString).decodeText()).toBe('c');
    });

    it('leaves Kids trees unchanged', () => {
      const leafRef = context.register(
        context.obj({
          Names: [PDFHexString.fromText('existing.txt'), context.register(context.obj({}))],
        }),
      );
      const node = context.obj({ Kids: [leafRef] }) as PDFDict;

      expect(
        addNameTreeEntry(
          node,
          PDFHexString.fromText('new.txt'),
          context.register(context.obj({})),
        ),
      ).toBe(false);

      expect(node.has(PDFName.of('Names'))).toBe(false);
      expect(node.lookup(PDFName.of('Kids'), PDFArray).size()).toBe(1);
    });
  });
});
