import type { PDFContext, PDFObject, PDFRef } from '../../core/index.js';
import type { DocumentSnapshot } from './DocumentSnapshot.js';

export class IncrementalDocumentSnapshot implements DocumentSnapshot {
  pdfSize: number;
  prevStartXRef: number;
  deletedCount: number = 0;

  private deleted: PDFRef[] = [];
  private deletedObjectNumbers: Set<number> = new Set();
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
      objs
        .map((obj) => this.context.getRef(obj))
        .filter((ref) => ref !== undefined) as PDFRef[],
    );
  }

  markDeletedRef(ref: PDFRef): void {
    if (!this.deletedObjectNumbers.has(ref.objectNumber)) {
      this.deletedObjectNumbers.add(ref.objectNumber);
      this.deletedCount = this.deleted.push(ref);
    }
  }

  markDeletedObj(obj: PDFObject): void {
    const oref = this.context.getRef(obj);
    if (oref) this.markDeletedRef(oref);
  }

  deletedRef(index: number): PDFRef | undefined {
    if (index < 0 || index >= this.deleted.length) return;
    return this.deleted[index];
  }
}
