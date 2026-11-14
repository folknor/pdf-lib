import type { PDFContext, PDFObject, PDFRef } from "../../core/index.js";
import type { DocumentSnapshot } from "./DocumentSnapshot.js";

export class IncrementalDocumentSnapshot implements DocumentSnapshot {
  pdfSize: number;
  prevStartXRef: number;

  private deleted: Map<number, PDFRef> = new Map();
  private lastObjectNumber: number;
  private changedObjects: Set<number>;

  context: PDFContext;

  constructor(
    lastObjectNumber: number,
    indirectObjects: number[],
    pdfSize: number,
    prevStartXRef: number,
    context: PDFContext,
  ) {
    this.lastObjectNumber = lastObjectNumber;
    this.changedObjects = new Set(indirectObjects);
    this.pdfSize = pdfSize;
    this.prevStartXRef = prevStartXRef;
    this.context = context;
  }

  shouldSave(objectNumber: number): boolean {
    if (objectNumber > this.lastObjectNumber) {
      return true;
    }

    return this.changedObjects.has(objectNumber);
  }

  markRefForSave(ref: PDFRef): void {
    if (ref) this.changedObjects.add(ref.objectNumber);
  }

  markRefsForSave(refs: PDFRef[]): void {
    for (const ref of refs) {
      if (ref) this.changedObjects.add(ref.objectNumber);
    }
  }

  markObjForSave(obj: PDFObject): void {
    this.markObjsForSave([obj]);
  }

  markObjsForSave(objs: PDFObject[]): void {
    this.markRefsForSave(
      objs.map((obj) => this.context.getRef(obj)).filter((ref) => ref !== undefined) as PDFRef[],
    );
  }

  markRefAssigned(ref: PDFRef): void {
    this.deleted.delete(ref.objectNumber);
    this.changedObjects.add(ref.objectNumber);
  }

  /**
   * Keeps the latest removal per number. A number above the snapshot's
   * largest was born in this revision and never reached the file, so there
   * is nothing to free.
   */
  markDeletedRef(ref: PDFRef): void {
    if (ref.objectNumber === 0 || ref.objectNumber > this.lastObjectNumber) {
      return;
    }

    this.deleted.set(ref.objectNumber, ref);
  }

  deletedRefs(): PDFRef[] {
    return [...this.deleted.values()].sort((a, b) => a.objectNumber - b.objectNumber);
  }
}
