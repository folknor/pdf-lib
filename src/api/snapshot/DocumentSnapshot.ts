import type { PDFObject, PDFRef } from '../../core/index.js';

export interface DocumentSnapshot {
  pdfSize: number;
  prevStartXRef: number;

  shouldSave: (objectNumber: number) => boolean;

  markRefForSave: (ref: PDFRef) => void;
  markRefsForSave: (refs: PDFRef[]) => void;

  markObjForSave: (obj: PDFObject) => void;
  markObjsForSave: (objs: PDFObject[]) => void;

  /**
   * Called by PDFContext.assign: the number holds an object again, so a
   * deletion recorded for it earlier is void and the object is written.
   */
  markRefAssigned: (ref: PDFRef) => void;
  /**
   * Called by PDFContext.delete only when an object was actually removed.
   */
  markDeletedRef: (ref: PDFRef) => void;

  /**
   * The current disposition of every deletion since the snapshot: one ref
   * per object number (the generation the removed object had), ascending,
   * only numbers the file already had and that no later assign revived.
   */
  deletedRefs: () => PDFRef[];
}
