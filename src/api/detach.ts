import {
  PDFArray,
  type PDFContext,
  PDFDict,
  PDFName,
  type PDFObject,
  PDFRef,
  PDFStream,
} from '../core/index.js';
import {
  checkCatalogAF,
  type NameTreeKey,
  readCatalogNameTree,
  removeFromCatalogNameTree,
} from './nameTree.js';

/** Calls `visit` for every reference inside `object`'s direct containment. */
export const forEachRef = (
  object: PDFObject,
  visit: (ref: PDFRef) => void,
): void => {
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
export const collectUnreferenced = (
  context: PDFContext,
  roots: PDFRef[],
): void => {
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

const EmbeddedFiles = PDFName.of('EmbeddedFiles');

/**
 * Remove every saved attachment named `name` from the catalog: every pair
 * with that key anywhere in the /EmbeddedFiles name tree, flat or /Kids,
 * and every catalog /AF occurrence of their file specifications. The tree
 * and /AF are rebuilt copy-on-write (see `removeFromNameTree`), so a node
 * or array shared with another structure is not changed. Then the objects
 * only those attachments and the replaced containers used are deleted;
 * anything another structure still refers to (a file-attachment
 * annotation, a page /AF, a second key for the same specification) is
 * kept.
 *
 * Nothing is decoded, so an unreadable attachment does not stop another
 * being detached. Throws `UnwritableNameTreeError`, changing nothing, when
 * the name is present but the tree is not strictly well formed.
 */
export const detachSavedAttachments = (
  context: PDFContext,
  catalog: PDFDict,
  name: string,
): void => {
  const matches = (key: NameTreeKey) => key.decodeText() === name;
  // /AF is checked before the tree is published, so a refusal changes
  // nothing; and only when there is something to detach.
  if (readCatalogNameTree(catalog, EmbeddedFiles).some((e) => matches(e.key))) {
    checkCatalogAF(catalog);
  }
  const edit = removeFromCatalogNameTree(
    context,
    catalog,
    EmbeddedFiles,
    matches,
  );
  if (!edit) return;
  const { removed, displaced } = edit;

  const AF = PDFName.of('AF');
  const removedRefs = removed.filter((v): v is PDFRef => v instanceof PDFRef);
  const oldAF = catalog.lookupMaybe(AF, PDFArray);
  if (oldAF) {
    const rawAF = catalog.get(AF);
    if (rawAF instanceof PDFRef) displaced.push(rawAF);
    const kept = oldAF
      .asArray()
      .filter((e) => !(e instanceof PDFRef && removedRefs.includes(e)));
    catalog.set(AF, context.obj(kept));
  }

  // A direct file specification has no object of its own; what it refers
  // to is collected in its place.
  const roots: PDFRef[] = [...displaced];
  for (const value of removed) forEachRef(value, (r) => roots.push(r));
  collectUnreferenced(context, roots);
};
