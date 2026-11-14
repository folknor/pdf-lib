import { copyStringIntoBuffer, padStart } from '../../utils/index.js';
import PDFRef from '../objects/PDFRef.js';
import CharCodes from '../syntax/CharCodes.js';

export interface Entry {
  ref: PDFRef;
  offset: number;
  deleted: boolean;
}

/**
 * Entries should be added using the [[addEntry]] and [[addDeletedEntry]]
 * methods.
 */
class PDFCrossRefSection {
  static create = () =>
    new PDFCrossRefSection({
      ref: PDFRef.of(0, 65535),
      offset: 0,
      deleted: true,
    });

  static createEmpty = () => new PDFCrossRefSection();

  private subsections: Entry[][];
  private chunkIdx: number;
  private chunkLength: number;

  private constructor(firstEntry: Entry | void) {
    this.subsections = firstEntry ? [[firstEntry]] : [];
    this.chunkIdx = 0;
    this.chunkLength = firstEntry ? 1 : 0;
  }

  addEntry(ref: PDFRef, offset: number): void {
    this.append({ ref, offset, deleted: false });
  }

  addDeletedEntry(ref: PDFRef, nextFreeObjectNumber: number): void {
    // Fix the first entry if required
    if (!this.subsections.length) {
      this.subsections = [
        [
          {
            ref: PDFRef.of(0, 65535),
            offset: ref.objectNumber,
            deleted: true,
          },
        ],
      ];
      this.chunkIdx = 0;
      this.chunkLength = 1;
    } else if (!this.subsections[0]![0]!.offset) {
      this.subsections[0]![0]!.offset = ref.objectNumber;
    }

    this.append({ ref, offset: nextFreeObjectNumber, deleted: true });
  }

  /**
   * A free entry of generation 0 (65535 for object 0, the chain head): what
   * a gap in a full save stands for.
   */
  static freeGap = (objectNumber: number): Entry => ({
    ref: PDFRef.of(objectNumber, objectNumber === 0 ? 65535 : 0),
    offset: 0,
    deleted: true,
  });

  /**
   * Makes the section one contiguous subsection from 0 through the highest
   * of its own entries and `through`: every number the section does not
   * list gets the entry `gapEntry` gives for it, and the free chain is
   * rebuilt in ascending order over every free entry, from object 0 and
   * ending at 0. This avoids a fragmented xref, which can make Adobe Reader
   * invalidate digital signatures (Hopding/pdf-lib#1388).
   *
   * What a gap means is the caller's: in a full save a number the section
   * does not list is absent ([[PDFCrossRefSection.freeGap]]); in an
   * increment it is inherited from earlier revisions and must be listed as
   * the file already resolves it (see PDFWriter.computeBufferSize).
   */
  fillGaps(
    gapEntry: (objectNumber: number) => Entry = PDFCrossRefSection.freeGap,
    through = 0,
  ): void {
    const merged: Entry[] = [];
    let nextExpectedObjNum = 0;

    const fillUpTo = (end: number) => {
      while (nextExpectedObjNum < end) {
        merged.push(gapEntry(nextExpectedObjNum));
        nextExpectedObjNum++;
      }
    };

    for (const subsection of this.subsections) {
      for (const entry of subsection) {
        fillUpTo(entry.ref.objectNumber);
        merged.push(entry);
        nextExpectedObjNum = entry.ref.objectNumber + 1;
      }
    }

    fillUpTo(through + 1);

    if (merged.length === 0) return;

    // Build the free object linked list
    // Each free entry's offset should point to the next free object
    const freeIndices: number[] = [];

    for (let i = 0; i < merged.length; i++) {
      if (merged[i]!.deleted) freeIndices.push(i);
    }

    for (let i = 0; i < freeIndices.length; i++) {
      const nextFreeIdx = freeIndices[i + 1];

      const nextFreeObjNum =
        nextFreeIdx !== undefined ? merged[nextFreeIdx]!.ref.objectNumber : 0;

      merged[freeIndices[i]!]!.offset = nextFreeObjNum;
    }

    this.subsections = [merged];
    this.chunkIdx = 0;
    this.chunkLength = merged.length;
  }

  toString(): string {
    let section = 'xref\n';

    for (
      let rangeIdx = 0, rangeLen = this.subsections.length;
      rangeIdx < rangeLen;
      rangeIdx++
    ) {
      const range = this.subsections[rangeIdx]!;
      section += `${range[0]!.ref.objectNumber} ${range.length}\n`;

      for (
        let entryIdx = 0, entryLen = range.length;
        entryIdx < entryLen;
        entryIdx++
      ) {
        const entry = range[entryIdx]!;
        section += padStart(String(entry.offset), 10, '0');
        section += ' ';
        section += padStart(String(entry.ref.generationNumber), 5, '0');
        section += ' ';
        section += entry.deleted ? 'f' : 'n';
        section += ' \n';
      }
    }

    return section;
  }

  sizeInBytes(): number {
    let size = 5;

    for (let idx = 0, len = this.subsections.length; idx < len; idx++) {
      const subsection = this.subsections[idx]!;
      const subsectionLength = subsection.length;
      const [firstEntry] = subsection as [Entry];
      size += 2;
      size += String(firstEntry.ref.objectNumber).length;
      size += String(subsectionLength).length;
      size += 20 * subsectionLength;
    }

    return size;
  }

  copyBytesInto(buffer: Uint8Array, offset: number): number {
    const initialOffset = offset;

    buffer[offset++] = CharCodes.x;
    buffer[offset++] = CharCodes.r;
    buffer[offset++] = CharCodes.e;
    buffer[offset++] = CharCodes.f;
    buffer[offset++] = CharCodes.Newline;

    offset += this.copySubsectionsIntoBuffer(this.subsections, buffer, offset);

    return offset - initialOffset;
  }

  private copySubsectionsIntoBuffer(
    subsections: Entry[][],
    buffer: Uint8Array,
    offset: number,
  ): number {
    const initialOffset = offset;
    const length = subsections.length;

    for (let idx = 0; idx < length; idx++) {
      const subsection = this.subsections[idx]!;

      const firstObjectNumber = String(subsection[0]!.ref.objectNumber);
      offset += copyStringIntoBuffer(firstObjectNumber, buffer, offset);
      buffer[offset++] = CharCodes.Space;

      const rangeLength = String(subsection.length);
      offset += copyStringIntoBuffer(rangeLength, buffer, offset);
      buffer[offset++] = CharCodes.Newline;

      offset += this.copyEntriesIntoBuffer(subsection, buffer, offset);
    }

    return offset - initialOffset;
  }

  private copyEntriesIntoBuffer(
    entries: Entry[],
    buffer: Uint8Array,
    offset: number,
  ): number {
    const length = entries.length;

    for (let idx = 0; idx < length; idx++) {
      const entry = entries[idx]!;

      const entryOffset = padStart(String(entry.offset), 10, '0');
      offset += copyStringIntoBuffer(entryOffset, buffer, offset);
      buffer[offset++] = CharCodes.Space;

      const entryGen = padStart(String(entry.ref.generationNumber), 5, '0');
      offset += copyStringIntoBuffer(entryGen, buffer, offset);
      buffer[offset++] = CharCodes.Space;

      buffer[offset++] = entry.deleted ? CharCodes.f : CharCodes.n;

      buffer[offset++] = CharCodes.Space;
      buffer[offset++] = CharCodes.Newline;
    }

    return 20 * length;
  }

  private append(currEntry: Entry): void {
    if (this.chunkLength === 0) {
      this.subsections.push([currEntry]);
      this.chunkIdx = 0;
      this.chunkLength = 1;

      return;
    }

    const chunk = this.subsections[this.chunkIdx]!;
    const prevEntry = chunk[this.chunkLength - 1]!;

    if (currEntry.ref.objectNumber - prevEntry.ref.objectNumber !== 1) {
      // The current chunk is not the right chunk, find the right one, or create a new one
      for (let c = 0; c < this.subsections.length; c++) {
        const first = this.subsections[c]![0]!;
        const last = this.subsections[c]![this.subsections[c]!.length - 1]!;

        if (first.ref.objectNumber > currEntry.ref.objectNumber) {
          // Goes before this subsection, or at the start of it
          if (first.ref.objectNumber - currEntry.ref.objectNumber === 1) {
            // First element of subsection
            this.subsections[c]!.unshift(currEntry);

            if (c === this.chunkIdx) this.chunkLength += 1;

            return;
          } else {
            // Create subsection
            this.subsections.splice(c, 0, [currEntry]);
            this.chunkIdx++;

            return;
          }
        } else if (last.ref.objectNumber > currEntry.ref.objectNumber) {
          // Goes in this subsection, find its place
          const cep = this.subsections[c]!.findIndex(
            (ee) => ee.ref.objectNumber > currEntry.ref.objectNumber,
          );

          this.subsections[c]!.splice(cep, 0, currEntry);

          if (c === this.chunkIdx) this.chunkLength += 1;

          return;
        }
        // Bigger, keep looking
      }

      // If got to here, then a new subsection is required
      this.subsections.push([currEntry]);
      this.chunkIdx += 1;
      this.chunkLength = 1;
    } else {
      chunk.push(currEntry);
      this.chunkLength += 1;
    }
  }
}

export default PDFCrossRefSection;
