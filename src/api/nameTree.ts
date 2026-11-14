import {
  PDFArray,
  type PDFContext,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFNull,
  type PDFObject,
  PDFRef,
  PDFString,
} from '../core/index.js';

const compareBytes = (left: Uint8Array, right: Uint8Array): number => {
  const length = Math.min(left.length, right.length);
  for (let idx = 0; idx < length; idx++) {
    const diff = left[idx]! - right[idx]!;
    if (diff !== 0) return diff;
  }
  return left.length - right.length;
};

export type NameTreeKey = PDFString | PDFHexString;

const isNameTreeKey = (object: PDFObject | undefined): object is NameTreeKey =>
  object instanceof PDFString || object instanceof PDFHexString;

const compareKeys = (a: NameTreeKey, b: NameTreeKey): number =>
  compareBytes(a.asBytes(), b.asBytes());

const Kids = PDFName.of('Kids');
const Names = PDFName.of('Names');
const Limits = PDFName.of('Limits');

/** Deeper trees than this are refused (writing) or cut off (reading). */
const MAX_DEPTH = 32;

/**
 * True when `node` is a flat leaf name-tree node we can safely rewrite.
 * Returns false for `/Kids` trees (or nodes that mix Kids + Names), and for
 * malformed `/Names` arrays - those PDFs are left untouched.
 */
export const isWritableFlatNameTree = (node: PDFDict): boolean => {
  if (node.has(Kids)) return false;

  if (!node.has(Names)) return true;

  const names = node.lookup(Names);
  if (!(names instanceof PDFArray) || names.size() % 2 !== 0) return false;

  for (let idx = 0, len = names.size(); idx < len; idx += 2) {
    if (!isNameTreeKey(names.get(idx))) return false;
  }

  return true;
};

/**
 * Sort a flat name-tree `/Names` array in place (PDF lexical / byte order,
 * as required by ISO 32000 7.9.6). Assumes every even slot is a string key.
 */
export const sortNameTreeNames = (names: PDFArray): void => {
  const pairs: { key: NameTreeKey; value: PDFObject }[] = [];

  for (let idx = 0, len = names.size(); idx + 1 < len; idx += 2) {
    const key = names.get(idx);
    if (!isNameTreeKey(key)) return;
    pairs.push({ key, value: names.get(idx + 1) });
  }

  pairs.sort((a, b) => compareKeys(a.key, b.key));

  pairs.forEach(({ key, value }, idx) => {
    names.set(idx * 2, key);
    names.set(idx * 2 + 1, value);
  });
};

/** One key/value pair of a name tree, in tree order. */
export type NameTreeEntry = { key: NameTreeKey; value: PDFObject };

/**
 * Every entry of the name tree rooted at `root`, in tree order. Reading is
 * tolerant: a node with `/Kids` is read through its kids (its own `/Names`
 * ignored), a node reached a second time, a kid that is not a dictionary,
 * a pair whose key is not a string and anything deeper than the depth limit
 * are skipped. /Limits is not consulted.
 */
export const readNameTree = (root: PDFDict): NameTreeEntry[] => {
  const entries: NameTreeEntry[] = [];
  const seen = new Set<PDFDict>();
  const visit = (node: PDFDict, depth: number) => {
    if (seen.has(node) || depth > MAX_DEPTH) return;
    seen.add(node);
    // Untyped lookups throughout: a wrong-typed entry is skipped, never
    // thrown, so it cannot hide its healthy siblings.
    const kids = node.lookup(Kids);
    if (kids instanceof PDFArray) {
      for (let i = 0; i < kids.size(); i++) {
        const kid = kids.lookup(i);
        if (kid instanceof PDFDict) visit(kid, depth + 1);
      }
      return;
    }
    if (node.has(Kids)) return;
    const names = node.lookup(Names);
    if (!(names instanceof PDFArray)) return;
    for (let i = 0; i + 1 < names.size(); i += 2) {
      const key = names.lookup(i);
      if (isNameTreeKey(key)) entries.push({ key, value: names.get(i + 1) });
    }
  };
  visit(root, 0);
  return entries;
};

/** A name tree that cannot be edited without guessing. */
export class UnwritableNameTreeError extends Error {
  constructor(reason: string) {
    super(`Refusing to edit the document: ${reason}`);
    this.name = 'UnwritableNameTreeError';
  }
}

type Leaf = {
  kind: 'leaf';
  dict: PDFDict;
  ref: PDFRef | undefined;
  entries: NameTreeEntry[];
};
type Inner = {
  kind: 'inner';
  dict: PDFDict;
  ref: PDFRef | undefined;
  kids: TreeNode[];
};
type TreeNode = Leaf | Inner;

const firstKey = (node: TreeNode): NameTreeKey | undefined =>
  node.kind === 'leaf'
    ? node.entries[0]?.key
    : node.kids.length > 0
      ? firstKey(node.kids[0]!)
      : undefined;
const lastKey = (node: TreeNode): NameTreeKey | undefined =>
  node.kind === 'leaf'
    ? node.entries[node.entries.length - 1]?.key
    : node.kids.length > 0
      ? lastKey(node.kids[node.kids.length - 1]!)
      : undefined;

/**
 * Analyse the whole tree strictly. Every node is a dictionary reached once;
 * no node has both /Kids and /Names; every leaf /Names is an even array of
 * string keys in non-decreasing byte order; every non-root node is
 * non-empty and its /Limits is exactly its smallest and largest key; kids'
 * key ranges are ordered and do not overlap. A flat root is the exception:
 * an unsorted root /Names is accepted and sorted when rewritten, as is a
 * root /Limits (which a root may not carry, and which a rewrite drops).
 */
const analyse = (root: PDFDict): TreeNode => {
  const seen = new Set<PDFDict>();
  const fail = (reason: string): never => {
    throw new UnwritableNameTreeError(reason);
  };

  const visit = (
    dict: PDFDict,
    ref: PDFRef | undefined,
    depth: number,
  ): TreeNode => {
    if (depth > MAX_DEPTH) fail('it is deeper than this library edits');
    if (seen.has(dict)) fail('a node is reached more than once');
    seen.add(dict);
    const isRoot = depth === 0;

    let node: TreeNode;
    if (dict.has(Kids)) {
      if (dict.has(Names)) fail('a node has both /Kids and /Names');
      const kidsArray = dict.lookup(Kids);
      if (!(kidsArray instanceof PDFArray)) fail('/Kids is not an array');
      const arr = kidsArray as PDFArray;
      const kids: TreeNode[] = [];
      for (let i = 0; i < arr.size(); i++) {
        const raw = arr.get(i);
        const kid = arr.lookup(i);
        if (!(kid instanceof PDFDict)) fail('a kid is not a dictionary');
        kids.push(
          visit(
            kid as PDFDict,
            raw instanceof PDFRef ? raw : undefined,
            depth + 1,
          ),
        );
      }
      for (let i = 1; i < kids.length; i++) {
        if (compareKeys(lastKey(kids[i - 1]!)!, firstKey(kids[i]!)!) >= 0) {
          fail('the key ranges of its kids are out of order or overlap');
        }
      }
      node = { kind: 'inner', dict, ref, kids };
    } else {
      const entries: NameTreeEntry[] = [];
      if (dict.has(Names)) {
        const names = dict.lookup(Names);
        if (!(names instanceof PDFArray) || names.size() % 2 !== 0) {
          fail('a /Names entry is not an array of pairs');
        }
        const arr = names as PDFArray;
        for (let i = 0; i < arr.size(); i += 2) {
          const key = arr.lookup(i);
          if (!isNameTreeKey(key)) fail('a key is not a string');
          entries.push({ key: key as NameTreeKey, value: arr.get(i + 1) });
        }
      }
      if (isRoot) {
        entries.sort((a, b) => compareKeys(a.key, b.key));
      } else {
        for (let i = 1; i < entries.length; i++) {
          if (compareKeys(entries[i - 1]!.key, entries[i]!.key) > 0) {
            fail('the keys of a leaf are not sorted');
          }
        }
      }
      node = { kind: 'leaf', dict, ref, entries };
    }

    if (!isRoot) {
      const low = firstKey(node);
      const high = lastKey(node);
      if (!low || !high) fail('a node below the root is empty');
      const limits = dict.lookup(Limits);
      const pair = limits instanceof PDFArray && limits.size() === 2;
      const l0 = pair ? limits.lookup(0) : undefined;
      const l1 = pair ? limits.lookup(1) : undefined;
      if (
        !isNameTreeKey(l0) ||
        !isNameTreeKey(l1) ||
        compareKeys(l0, low!) !== 0 ||
        compareKeys(l1, high!) !== 0
      ) {
        fail('a /Limits entry does not match the keys under it');
      }
    }
    return node;
  };

  return visit(root, undefined, 0);
};

/**
 * Throw [[UnwritableNameTreeError]] unless the tree rooted at `root` can be
 * edited by [[insertIntoNameTree]] and [[removeFromNameTree]].
 */
export const checkNameTree = (root: PDFDict): void => {
  analyse(root);
};

/** The result of an edit: the new root, and the objects it displaced. */
export type NameTreeEdit = {
  /** The new root dictionary, to be published where the old root was. */
  root: PDFDict;
  /**
   * Indirect objects the old tree used that the new one may not: rebuilt
   * nodes and their indirect /Names, /Kids and /Limits arrays. Candidates
   * for collection once the new root is published.
   */
  displaced: PDFRef[];
};

/**
 * Record a node leaving the tree (rebuilt or pruned): its own reference and
 * any indirect /Names, /Kids or /Limits array, which would otherwise be
 * orphans keeping what they list alive.
 */
const displace = (displaced: PDFRef[], node: TreeNode): void => {
  if (node.ref) displaced.push(node.ref);
  for (const key of [Names, Kids, Limits]) {
    const raw = node.dict.get(key);
    if (raw instanceof PDFRef) displaced.push(raw);
  }
};

/**
 * Rebuild changed nodes copy-on-write: a fresh dictionary with fresh
 * arrays, given a new reference if the old node was indirect, so another
 * structure sharing the old node or its arrays is never changed. Unchanged
 * subtrees are reused as they are.
 */
const rebuild = (
  context: PDFContext,
  displaced: PDFRef[],
  node: TreeNode,
  contents: { entries: NameTreeEntry[] } | { kids: PDFObject[] },
  isRoot: boolean,
  low: NameTreeKey | undefined,
  high: NameTreeKey | undefined,
): PDFObject => {
  displace(displaced, node);
  const dict = context.obj({}) as PDFDict;
  for (const [key, value] of node.dict.entries()) {
    if (key !== Names && key !== Kids && key !== Limits) dict.set(key, value);
  }
  if ('entries' in contents) {
    const names = context.obj([]) as PDFArray;
    for (const { key, value } of contents.entries) {
      names.push(key);
      names.push(value);
    }
    dict.set(Names, names);
  } else {
    dict.set(Kids, context.obj(contents.kids));
  }
  if (!isRoot && low && high) dict.set(Limits, context.obj([low, high]));
  if (isRoot) return dict;
  return node.ref ? context.register(dict) : dict;
};

const original = (node: TreeNode): PDFObject => node.ref ?? node.dict;

/**
 * Insert `key` / `value`, after any equal keys (refusing a duplicate name
 * is the caller's policy: see [[checkCatalogNameUnused]]). The leaf is the kid whose
 * range holds the key, else the last kid starting below it, else the first
 * kid. Throws [[UnwritableNameTreeError]] before changing anything when
 * the tree is not strictly well formed. Nothing is changed in place: the
 * caller publishes `root`.
 */
export const insertIntoNameTree = (
  context: PDFContext,
  root: PDFDict,
  key: NameTreeKey,
  value: PDFObject,
): NameTreeEdit => {
  const tree = analyse(root);
  const displaced: PDFRef[] = [];

  const insert = (node: TreeNode, isRoot: boolean): PDFObject => {
    if (node.kind === 'leaf' || node.kids.length === 0) {
      const entries = node.kind === 'leaf' ? [...node.entries] : [];
      let at = entries.length;
      while (at > 0 && compareKeys(entries[at - 1]!.key, key) > 0) at--;
      entries.splice(at, 0, { key, value });
      return rebuild(
        context,
        displaced,
        node,
        { entries },
        isRoot,
        entries[0]!.key,
        entries[entries.length - 1]!.key,
      );
    }
    let pick = 0;
    for (let i = node.kids.length - 1; i >= 0; i--) {
      if (compareKeys(firstKey(node.kids[i]!)!, key) <= 0) {
        pick = i;
        break;
      }
    }
    const kids = node.kids.map(original);
    kids[pick] = insert(node.kids[pick]!, false);
    const low = compareKeys(key, firstKey(node)!) < 0 ? key : firstKey(node);
    const high = compareKeys(key, lastKey(node)!) > 0 ? key : lastKey(node);
    return rebuild(context, displaced, node, { kids }, isRoot, low, high);
  };

  return { root: insert(tree, true) as PDFDict, displaced };
};

/**
 * Remove every pair whose key `matches`, from every leaf. Emptied nodes
 * below the root are dropped; a root left with nothing becomes an empty
 * leaf. Returns undefined, changing nothing, when no key matches. Throws
 * [[UnwritableNameTreeError]] before changing anything when the tree is not
 * strictly well formed.
 */
export const removeFromNameTree = (
  context: PDFContext,
  root: PDFDict,
  matches: (key: NameTreeKey) => boolean,
): (NameTreeEdit & { removed: PDFObject[] }) | undefined => {
  const tree = analyse(root);
  const displaced: PDFRef[] = [];
  const removed: PDFObject[] = [];

  // Decide every match before building anything, so a throwing predicate
  // leaves no new objects behind.
  const doomed = new Set<NameTreeEntry>();
  const mark = (node: TreeNode) => {
    if (node.kind === 'inner') node.kids.forEach(mark);
    else for (const e of node.entries) if (matches(e.key)) doomed.add(e);
  };
  mark(tree);
  if (doomed.size === 0) return undefined;

  const touches = (node: TreeNode): boolean =>
    node.kind === 'leaf'
      ? node.entries.some((e) => doomed.has(e))
      : node.kids.some(touches);

  // Returns the node's replacement, or undefined when it ends up empty.
  const remove = (node: TreeNode, isRoot: boolean): PDFObject | undefined => {
    if (!touches(node)) return original(node);
    if (node.kind === 'leaf') {
      const entries = node.entries.filter((e) => {
        if (!doomed.has(e)) return true;
        removed.push(e.value);
        return false;
      });
      if (entries.length === 0 && !isRoot) {
        displace(displaced, node);
        return undefined;
      }
      return rebuild(
        context,
        displaced,
        node,
        { entries },
        isRoot,
        entries[0]?.key,
        entries[entries.length - 1]?.key,
      );
    }
    const kept: { obj: PDFObject; node: TreeNode }[] = [];
    let low: NameTreeKey | undefined;
    let high: NameTreeKey | undefined;
    for (const kid of node.kids) {
      const obj = remove(kid, false);
      if (obj === undefined) continue;
      kept.push({ obj, node: kid });
    }
    // Limits of the survivors, read from what remains under them.
    const remaining = (n: TreeNode): NameTreeKey[] =>
      n.kind === 'leaf'
        ? n.entries.filter((e) => !doomed.has(e)).map((e) => e.key)
        : n.kids.flatMap(remaining);
    for (const { node: kid } of kept) {
      const keys = remaining(kid);
      low ??= keys[0];
      high = keys[keys.length - 1] ?? high;
    }
    if (kept.length === 0) {
      if (!isRoot) {
        displace(displaced, node);
        return undefined;
      }
      return rebuild(
        context,
        displaced,
        node,
        { entries: [] },
        true,
        low,
        high,
      );
    }
    const kids = kept.map((k) => k.obj);
    return rebuild(context, displaced, node, { kids }, isRoot, low, high);
  };

  return { root: remove(tree, true) as PDFDict, displaced, removed };
};

/** A catalog `/Names` entry that is neither absent nor a dictionary. */
const catalogNamesDict = (catalog: PDFDict): PDFDict | undefined => {
  const value = catalog.lookup(Names);
  if (value === undefined || value === PDFNull) return undefined;
  if (!(value instanceof PDFDict)) {
    throw new UnwritableNameTreeError('the catalog /Names is not a dictionary');
  }
  return value;
};

const catalogTreeRoot = (
  catalog: PDFDict,
  tree: PDFName,
): PDFDict | undefined => {
  const value = catalogNamesDict(catalog)?.lookup(tree);
  if (value === undefined || value === PDFNull) return undefined;
  if (!(value instanceof PDFDict)) {
    throw new UnwritableNameTreeError(`${tree} is not a dictionary`);
  }
  return value;
};

/** Entries of a catalog name tree (tolerant read); empty when absent. */
export const readCatalogNameTree = (
  catalog: PDFDict,
  tree: PDFName,
): NameTreeEntry[] => {
  const names = catalog.lookup(Names);
  const root = names instanceof PDFDict ? names.lookup(tree) : undefined;
  return root instanceof PDFDict ? readNameTree(root) : [];
};

/** Throws unless the catalog /AF is absent, null or an array. */
export const checkCatalogAF = (catalog: PDFDict): void => {
  const af = catalog.lookup(PDFName.of('AF'));
  if (af !== undefined && af !== PDFNull && !(af instanceof PDFArray)) {
    throw new UnwritableNameTreeError('the catalog /AF is not an array');
  }
};

/** Throws unless the catalog name tree `tree` (absent counts) is editable. */
export const checkCatalogNameTree = (catalog: PDFDict, tree: PDFName): void => {
  const root = catalogTreeRoot(catalog, tree);
  if (root) checkNameTree(root);
};

/** A name already used by an entry of the name tree it would be added to. */
export class DuplicateNameError extends Error {
  constructor(tree: PDFName, name: string) {
    super(`${tree} already has an entry named ${JSON.stringify(name)}`);
    this.name = 'DuplicateNameError';
  }
}

/**
 * Whether the key `key` names `name`: decoded text equal (how
 * [[PDFDocument.getAttachments]] and [[PDFDocument.detach]] see names), or
 * bytes equal to the key [[PDFHexString.fromText]] would write (which
 * catches names, such as ones holding a lone surrogate, that do not survive
 * decoding). This is the library's notion of a name, not ISO 32000's: the
 * standard compares keys byte by byte, so `(a)` and `<FEFF0061>` are
 * distinct keys to it and one name here.
 */
export const keyNames = (key: NameTreeKey, name: string): boolean =>
  key.decodeText() === name ||
  compareKeys(key, PDFHexString.fromText(name)) === 0;

/**
 * Like [[checkCatalogNameTree]], and also throws [[DuplicateNameError]]
 * when an entry of the tree already has the name `name` (see [[keyNames]]).
 * Entries already present twice in a loaded document are left alone; only
 * adding another is refused.
 */
export const checkCatalogNameUnused = (
  catalog: PDFDict,
  tree: PDFName,
  name: string,
): void => {
  checkCatalogNameTree(catalog, tree);
  // The strict check just passed, so the tolerant read skips nothing.
  if (readCatalogNameTree(catalog, tree).some((e) => keyNames(e.key, name))) {
    throw new DuplicateNameError(tree, name);
  }
};

/**
 * Publish a new root for the catalog name tree `tree`. The catalog `/Names`
 * dictionary is replaced by a fresh copy, so one shared with another
 * catalog is not changed; the old one, if indirect, is displaced.
 */
const publish = (
  context: PDFContext,
  catalog: PDFDict,
  tree: PDFName,
  root: PDFDict,
  displaced: PDFRef[],
): void => {
  const old = catalogNamesDict(catalog);
  const raw = catalog.get(Names);
  if (raw instanceof PDFRef) displaced.push(raw);
  const rawRoot = old?.get(tree);
  if (rawRoot instanceof PDFRef) displaced.push(rawRoot);
  const names = context.obj({}) as PDFDict;
  if (old) for (const [key, value] of old.entries()) names.set(key, value);
  names.set(tree, root);
  catalog.set(Names, names);
};

/**
 * Insert into the catalog name tree `tree`, creating it if absent, and
 * publish the result. Returns the displaced objects for collection.
 */
export const insertIntoCatalogNameTree = (
  context: PDFContext,
  catalog: PDFDict,
  tree: PDFName,
  key: NameTreeKey,
  value: PDFObject,
): PDFRef[] => {
  const root = catalogTreeRoot(catalog, tree) ?? (context.obj({}) as PDFDict);
  const edit = insertIntoNameTree(context, root, key, value);
  publish(context, catalog, tree, edit.root, edit.displaced);
  return edit.displaced;
};

/**
 * Remove matching pairs from the catalog name tree `tree` and publish the
 * result. Returns undefined, changing nothing, when a tolerant read finds
 * nothing matching; only a tree that holds a match must be editable.
 */
export const removeFromCatalogNameTree = (
  context: PDFContext,
  catalog: PDFDict,
  tree: PDFName,
  matches: (key: NameTreeKey) => boolean,
): { removed: PDFObject[]; displaced: PDFRef[] } | undefined => {
  if (!readCatalogNameTree(catalog, tree).some(({ key }) => matches(key))) {
    return undefined;
  }
  const root = catalogTreeRoot(catalog, tree);
  if (!root) return undefined;
  const edit = removeFromNameTree(context, root, matches);
  if (!edit) return undefined;
  publish(context, catalog, tree, edit.root, edit.displaced);
  return edit;
};
