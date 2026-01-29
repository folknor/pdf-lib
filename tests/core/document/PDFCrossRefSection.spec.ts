import { PDFCrossRefSection, PDFRef } from '../../../src/core';
import { toCharCode, typedArrayFor } from '../../../src/utils';

describe('PDFCrossRefSection', () => {
  it('can be constructed from PDFCrossRefSection.create()', () => {
    expect(PDFCrossRefSection.create()).toBeInstanceOf(PDFCrossRefSection);
  });

  const xref1 = PDFCrossRefSection.create();
  xref1.addEntry(PDFRef.of(1), 21);
  xref1.addDeletedEntry(PDFRef.of(2, 1), 24);
  xref1.addEntry(PDFRef.of(3), 192188923);
  xref1.addEntry(PDFRef.of(4), 129219);

  const xref2 = PDFCrossRefSection.create();
  xref2.addEntry(PDFRef.of(3), 21);
  xref2.addDeletedEntry(PDFRef.of(4, 1), 24);
  xref2.addEntry(PDFRef.of(6), 192188923);
  xref2.addEntry(PDFRef.of(7), 129219);

  // Note: PDF spec requires free entries to form a linked list.
  // Entry 0 (always free) should point to the first free object number.
  it('can be converted to a string with a single subsection', () => {
    expect(String(xref1)).toEqual(
      'xref\n' +
        '0 5\n' +
        '0000000002 65535 f \n' + // Points to first free object (2)
        '0000000021 00000 n \n' +
        '0000000024 00001 f \n' +
        '0192188923 00000 n \n' +
        '0000129219 00000 n \n',
    );
  });

  it('can be converted to a string with multiple subsections and without object number 1', () => {
    expect(String(xref2)).toEqual(
      'xref\n' +
        '0 1\n' +
        '0000000004 65535 f \n' + // Points to first free object (4)
        '3 2\n' +
        '0000000021 00000 n \n' +
        '0000000024 00001 f \n' +
        '6 2\n' +
        '0192188923 00000 n \n' +
        '0000129219 00000 n \n',
    );
  });

  it('can provide its size in bytes with a single subsection', () => {
    expect(xref1.sizeInBytes()).toBe(109);
  });

  it('can provide its size in bytes with multiple subsections and without object number 1', () => {
    expect(xref2.sizeInBytes()).toBe(117);
  });

  it('can be serialized with a single subsection', () => {
    const buffer = new Uint8Array(113).fill(toCharCode(' '));
    expect(xref1.copyBytesInto(buffer, 3)).toBe(109);
    expect(buffer).toEqual(
      typedArrayFor(
        '   xref\n' +
          '0 5\n' +
          '0000000002 65535 f \n' + // Points to first free object (2)
          '0000000021 00000 n \n' +
          '0000000024 00001 f \n' +
          '0192188923 00000 n \n' +
          '0000129219 00000 n \n ',
      ),
    );
  });

  it('can be serialized with multiple subsections and without object number 1', () => {
    const buffer = new Uint8Array(121).fill(toCharCode(' '));
    expect(xref2.copyBytesInto(buffer, 3)).toBe(117);
    expect(buffer).toEqual(
      typedArrayFor(
        '   xref\n' +
          '0 1\n' +
          '0000000004 65535 f \n' + // Points to first free object (4)
          '3 2\n' +
          '0000000021 00000 n \n' +
          '0000000024 00001 f \n' +
          '6 2\n' +
          '0192188923 00000 n \n' +
          '0000129219 00000 n \n ',
      ),
    );
  });

  describe('fillGaps', () => {
    it('fills gaps between subsections with deleted entries', () => {
      const xref = PDFCrossRefSection.create();
      xref.addEntry(PDFRef.of(1), 100);
      xref.addEntry(PDFRef.of(2), 200);
      // Gap at object 3, 4
      xref.addEntry(PDFRef.of(5), 500);
      xref.addEntry(PDFRef.of(6), 600);

      // Before fillGaps, should have multiple subsections
      const beforeStr = String(xref);
      expect(beforeStr).toContain('0 3\n'); // First subsection
      expect(beforeStr).toContain('5 2\n'); // Second subsection

      xref.fillGaps();

      // After fillGaps, should have single contiguous subsection
      const afterStr = String(xref);
      expect(afterStr).toContain('0 7\n'); // Single subsection 0-6
      expect(afterStr).not.toContain('5 2\n'); // No separate subsection

      // Objects 3 and 4 should be marked as deleted (f)
      expect(afterStr).toMatch(/00000 f/); // Deleted entries have 'f' marker
    });

    it('does nothing when there is only one subsection', () => {
      const xref = PDFCrossRefSection.create();
      xref.addEntry(PDFRef.of(1), 100);
      xref.addEntry(PDFRef.of(2), 200);
      xref.addEntry(PDFRef.of(3), 300);

      const beforeStr = String(xref);
      xref.fillGaps();
      const afterStr = String(xref);

      expect(afterStr).toBe(beforeStr);
    });

    it('preserves existing deleted entries', () => {
      const xref = PDFCrossRefSection.create();
      xref.addEntry(PDFRef.of(1), 100);
      xref.addDeletedEntry(PDFRef.of(2, 1), 0); // Explicitly deleted
      xref.addEntry(PDFRef.of(3), 300);
      // Gap at object 4
      xref.addEntry(PDFRef.of(5), 500);

      xref.fillGaps();

      const afterStr = String(xref);
      // Should have single subsection
      expect(afterStr).toContain('0 6\n');
      // Object 2 should still be marked as deleted with generation 1
      expect(afterStr).toMatch(/00001 f/);
    });
  });
});
