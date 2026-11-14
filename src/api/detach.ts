import {
  PDFArray,
  type PDFContext,
  PDFDict,
  PDFHexString,
  PDFName,
  type PDFObject,
  PDFRef,
  PDFStream,
  PDFString,
} from '../core/index.js';

/** Calls `visit` for every reference inside `object`'s direct containment. */
const forEachRef = (object: PDFObject, visit: (ref: PDFRef) => void): void => {
  if (object instanceof PDFRef) {
    visit(object);
  } else if (object instanceof PDFDict) {
    for (const value of object.values()) forEachRef(value, visit);
  } else if (object instanceof PDFArray) {
    for (let i = 0; i < object.size(); i++) forEachRef(object.get(i), visit);
  } else if (object instanceof PDFStream) {
    forEachRef(object.dict, visit);
  }
};

/**
 * Delete the indirect objects that only the given, already unlinked,
 * objects used. Candidates are every indirect object reachable from
 * `roots`; a candidate stays if the trailer or any object outside the
 * candidates refers to it, and so does everything it reaches. The whole
 * live set is decided before anything is deleted, so cycles among the
 * candidates are collected and nothing still referenced is left dangling.
 *
 * This is conservative: an orphan already in the document that points at a
 * candidate keeps it alive.
 */
const collectUnreferenced = (context: PDFContext, roots: PDFRef[]): void => {
  const candidates = new Set<PDFRef>();
  const pending = [...roots];
  while (pending.length > 0) {
    const ref = pending.pop()!;
    if (candidates.has(ref)) continue;
    const object = context.lookup(ref);
    if (object === undefined) continue;
    candidates.add(ref);
    forEachRef(object, (r) => pending.push(r));
  }

  const live: PDFRef[] = [];
  const keep = (r: PDFRef) => {
    if (candidates.has(r)) live.push(r);
  };
  for (const value of Object.values(context.trailerInfo)) {
    if (value) forEachRef(value, keep);
  }
  for (const [ref, object] of context.enumerateIndirectObjects()) {
    if (!candidates.has(ref)) forEachRef(object, keep);
  }

  const kept = new Set<PDFRef>();
  while (live.length > 0) {
    const ref = live.pop()!;
    if (kept.has(ref)) continue;
    kept.add(ref);
    forEachRef(context.lookup(ref)!, keep);
  }

  for (const ref of candidates) {
    if (!kept.has(ref)) context.delete(ref);
  }
};

const isKey = (o: PDFObject): o is PDFString | PDFHexString =>
  o instanceof PDFString || o instanceof PDFHexString;

/**
 * Remove every saved attachment named `name` from the catalog: every pair
 * with that key in the flat /EmbeddedFiles /Names array and every catalog
 * /AF occurrence of their file specifications, edited in place so no
 * orphaned copy of a container keeps them alive. An existing /Limits is
 * replaced (it may be shared with another tree), or dropped once the array
 * is empty. Then the objects only those attachments used are deleted;
 * anything another structure still refers to (a file-attachment annotation,
 * a page /AF, a second key for the same specification) is kept.
 *
 * Nothing is decoded, so an unreadable attachment does not stop another
 * being detached. A /Kids name tree is not searched.
 */
export const detachSavedAttachments = (
  context: PDFContext,
  catalog: PDFDict,
  name: string,
): void => {
  const ef = catalog
    .lookupMaybe(PDFName.of('Names'), PDFDict)
    ?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict);
  const names = ef?.lookupMaybe(PDFName.of('Names'), PDFArray);
  if (!ef || !names) return;

  const removed: PDFObject[] = [];
  for (let i = names.size() - (names.size() % 2) - 2; i >= 0; i -= 2) {
    const key = names.get(i);
    if (!isKey(key) || key.decodeText() !== name) continue;
    removed.push(names.get(i + 1));
    names.remove(i + 1);
    names.remove(i);
  }
  if (removed.length === 0) return;

  const Limits = PDFName.of('Limits');
  if (ef.has(Limits)) {
    const lastKey = names.size() - (names.size() % 2) - 2;
    if (lastKey >= 0) {
      ef.set(Limits, context.obj([names.get(0), names.get(lastKey)]));
    } else {
      ef.delete(Limits);
    }
  }

  const removedRefs = removed.filter((v): v is PDFRef => v instanceof PDFRef);
  const AF = catalog.lookupMaybe(PDFName.of('AF'), PDFArray);
  if (AF) {
    for (let i = AF.size() - 1; i >= 0; i--) {
      const entry = AF.get(i);
      if (entry instanceof PDFRef && removedRefs.includes(entry)) AF.remove(i);
    }
  }

  // A direct file specification has no object of its own; what it refers
  // to is collected in its place.
  const roots: PDFRef[] = [];
  for (const value of removed) forEachRef(value, (r) => roots.push(r));
  collectUnreferenced(context, roots);
};
