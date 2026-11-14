import PDFArray from "../objects/PDFArray.js";
import PDFDict from "../objects/PDFDict.js";
import PDFHexString from "../objects/PDFHexString.js";
import PDFName from "../objects/PDFName.js";
import type PDFObject from "../objects/PDFObject.js";
import PDFRef from "../objects/PDFRef.js";
import PDFString from "../objects/PDFString.js";
import type PDFContext from "../PDFContext.js";
import type PDFCatalog from "../structures/PDFCatalog.js";

/*
 * Optional content groups (layers) and their state in the default
 * configuration, the catalog /OCProperties /D dictionary (ISO 32000-1
 * 8.11.4).
 *
 * Only the default configuration's initial ON/OFF state is read and written.
 * What a viewer renders also depends on /Usage, /AS, /Intent, membership
 * dictionaries (OCMDs) and the viewer's own choices; none of that is modelled
 * here. /Configs, /Order and /Locked are left as they are.
 *
 * Upstream pdf-lib's helpers (baced40d2) were not ported: rebuilding /ON and
 * /OFF from /OCGs drops entries for groups not listed there, forcing
 * /BaseState /ON rewrites the configuration, a by-name setter is ambiguous
 * (names are labels, and copyPages duplicates them) and /RBGroups were
 * ignored. This module keys on refs and edits one group at a time.
 */

const OCProperties = PDFName.of("OCProperties");
const OCGs = PDFName.of("OCGs");
const D = PDFName.of("D");
const ON = PDFName.of("ON");
const OFF = PDFName.of("OFF");
const BaseState = PDFName.of("BaseState");
const RBGroups = PDFName.of("RBGroups");
const Type = PDFName.of("Type");
const OCG = PDFName.of("OCG");
const Name = PDFName.of("Name");

const sameRef = (a: PDFObject | undefined, b: PDFRef): boolean =>
  a instanceof PDFRef &&
  a.objectNumber === b.objectNumber &&
  a.generationNumber === b.generationNumber;

const properties = (catalog: PDFCatalog): PDFDict | undefined =>
  catalog.lookupMaybe(OCProperties, PDFDict);

/**
 * The refs of the document's optional content groups: the /OCProperties
 * /OCGs entries that are refs to dictionaries of /Type /OCG, each once, in
 * order. Other entries are skipped. Empty without /OCProperties; throws when
 * /OCProperties or /OCGs has the wrong type.
 */
export const listOptionalContentGroups = (catalog: PDFCatalog): PDFRef[] => {
  const props = properties(catalog);

  if (!props) return [];
  const ocgs = props.lookupMaybe(OCGs, PDFArray);

  if (!ocgs) return [];
  const refs: PDFRef[] = [];

  for (let i = 0; i < ocgs.size(); i++) {
    const entry = ocgs.get(i);

    if (!(entry instanceof PDFRef)) continue;

    if (refs.some((r) => sameRef(r, entry))) continue;
    const dict = catalog.context.lookup(entry);

    if (!(dict instanceof PDFDict)) continue;

    if (dict.lookup(Type) !== OCG) continue;
    refs.push(entry);
  }

  return refs;
};

/** The group's /Name as text, or `undefined` when missing or not a string. */
export const optionalContentGroupName = (context: PDFContext, ref: PDFRef): string | undefined => {
  const dict = context.lookup(ref);

  if (!(dict instanceof PDFDict)) return undefined;
  const name = dict.lookup(Name);

  if (name instanceof PDFString || name instanceof PDFHexString) {
    return name.decodeText();
  }

  return undefined;
};

const defaultConfig = (catalog: PDFCatalog): PDFDict | undefined =>
  properties(catalog)?.lookupMaybe(D, PDFDict);

/**
 * Whether the group is ON in the default configuration. /BaseState must be
 * /ON there; as our recovery policy /OFF is honoured and anything else
 * (including /Unchanged) is read as /ON. /ON is applied after the base state
 * and /OFF after /ON, so a group listed in both is OFF (our policy for a
 * conflict the standard leaves open).
 */
export const isOptionalContentGroupOn = (catalog: PDFCatalog, ref: PDFRef): boolean => {
  const d = defaultConfig(catalog);

  if (!d) return true;

  const lists = (key: PDFName) =>
    d
      .lookupMaybe(key, PDFArray)
      ?.asArray()
      .some((e) => sameRef(e, ref)) ?? false;

  if (lists(OFF)) return false;

  if (lists(ON)) return true;

  return d.lookup(BaseState) !== OFF;
};

/**
 * Set the group's state in the default configuration: it is removed from
 * /ON and /OFF (every occurrence) and listed in the one matching `on`, even
 * where that repeats /BaseState. Turning a group ON turns OFF every group
 * that shares one of its /RBGroups arrays (direct membership only, whether
 * or not the peer is in /OCGs). Other entries are kept verbatim.
 *
 * Everything is validated and built off-tree first, then attached once: a
 * shallow copy of /D with fresh /ON and /OFF arrays replaces /OCProperties
 * /D, so whatever else shares the old /D or arrays (for instance /Configs)
 * is left alone. A missing /D (it is required) is created without a /Name;
 * this is not a PDF/A repair.
 *
 * Throws, changing nothing, when the ref is not one of the document's
 * groups, or /D, /ON, /OFF or /RBGroups has the wrong type.
 *
 * Returns the refs the edit unlinked (an indirect /D, /ON or /OFF), for the
 * caller to collect if nothing else uses them.
 */
export const setOptionalContentGroupOn = (
  catalog: PDFCatalog,
  ref: PDFRef,
  on: boolean,
): PDFRef[] => {
  const { context } = catalog;

  if (!listOptionalContentGroups(catalog).some((r) => sameRef(r, ref))) {
    throw new Error(
      `${ref} is not an optional content group listed in this document's /OCProperties /OCGs`,
    );
  }

  const props = properties(catalog)!;
  const oldD = props.lookupMaybe(D, PDFDict);
  const oldOn = oldD?.lookupMaybe(ON, PDFArray);
  const oldOff = oldD?.lookupMaybe(OFF, PDFArray);

  const turnOff: PDFRef[] = [];
  const groups = oldD?.lookupMaybe(RBGroups, PDFArray);

  for (let i = 0; i < (groups?.size() ?? 0); i++) {
    const group = groups!.lookup(i);

    if (!(group instanceof PDFArray)) {
      throw new Error(
        "The default optional content configuration has an /RBGroups entry that is not an array",
      );
    }

    const members = group.asArray();

    if (!on || !members.some((m) => sameRef(m, ref))) continue;

    for (const m of members) {
      if (m instanceof PDFRef && !sameRef(m, ref)) turnOff.push(m);
    }
  }

  const affected = [ref, ...turnOff];

  const kept = (array: PDFArray | undefined) =>
    (array?.asArray() ?? []).filter((e) => !affected.some((r) => sameRef(e, r)));

  const newOn = PDFArray.withContext(context);
  const newOff = PDFArray.withContext(context);

  for (const e of kept(oldOn)) newOn.push(e);

  for (const e of kept(oldOff)) newOff.push(e);
  (on ? newOn : newOff).push(ref);

  for (const r of turnOff) {
    if (!newOff.asArray().some((e) => sameRef(e, r))) newOff.push(r);
  }

  const newD = oldD ? oldD.clone() : PDFDict.withContext(context);
  newD.set(ON, newOn);
  newD.set(OFF, newOff);
  const unlinked: PDFRef[] = [];
  const rawD = props.get(D);

  if (rawD instanceof PDFRef) unlinked.push(rawD);

  for (const key of [ON, OFF]) {
    const raw = oldD?.get(key);

    if (raw instanceof PDFRef) unlinked.push(raw);
  }

  props.set(D, newD);

  return unlinked;
};

/** Register only OCG refs reached by the copier, preserving initial states.
 * Validate both configurations before attaching fresh arrays and a shallow /D
 * copy. Radio groups retain only their copied members; unrelated layers are
 * never pulled into the destination merely by configuration membership.
 */
export const registerCopiedOptionalContentGroups = (
  source: PDFCatalog,
  destination: PDFCatalog,
  copied: Map<PDFRef, PDFRef>,
): PDFRef[] => {
  const additions: { source: PDFRef; destination: PDFRef }[] = [];

  for (const [src, dest] of copied) {
    const dict = source.context.lookup(src);

    if (dict instanceof PDFDict && dict.lookup(Type) === OCG) {
      additions.push({ source: src, destination: dest });
    }
  }

  if (!additions.length) return [];
  const props = properties(destination);
  const oldGroups = props?.lookupMaybe(OCGs, PDFArray);

  const fresh = additions.filter(
    (a) => !oldGroups?.asArray().some((r) => sameRef(r, a.destination)),
  );

  if (!fresh.length) return [];

  const validate = (catalog: PDFCatalog) => {
    const d = defaultConfig(catalog);
    const on = d?.lookupMaybe(ON, PDFArray);
    const off = d?.lookupMaybe(OFF, PDFArray);
    const radio = d?.lookupMaybe(RBGroups, PDFArray);
    const groups: PDFArray[] = [];

    for (const entry of radio?.asArray() ?? []) {
      const group = catalog.context.lookup(entry);

      if (!(group instanceof PDFArray)) {
        throw new Error(
          "The default optional content configuration has an /RBGroups entry that is not an array",
        );
      }

      groups.push(group);
    }

    return { d, on, off, radio, groups };
  };

  const src = validate(source);
  const dst = validate(destination);
  const states = fresh.map((a) => isOptionalContentGroupOn(source, a.source));
  const { context } = destination;
  const newGroups = oldGroups?.clone() ?? PDFArray.withContext(context);
  const newOn = dst.on?.clone() ?? PDFArray.withContext(context);
  const newOff = dst.off?.clone() ?? PDFArray.withContext(context);

  // A copied ref can already occur in state lists even when absent from /OCGs.
  for (const array of [newOn, newOff]) {
    for (let i = array.size() - 1; i >= 0; i--) {
      if (fresh.some((a) => sameRef(array.get(i), a.destination))) array.remove(i);
    }
  }

  fresh.forEach((a, i) => {
    newGroups.push(a.destination);
    (states[i] ? newOn : newOff).push(a.destination);
  });
  const newRadio = dst.radio?.clone() ?? PDFArray.withContext(context);

  for (const group of src.groups) {
    const members = PDFArray.withContext(context);

    for (const entry of group.asArray()) {
      const match = additions.find((a) => sameRef(entry, a.source));

      if (match && !members.asArray().some((r) => sameRef(r, match.destination))) {
        members.push(match.destination);
      }
    }

    if (members.size() > 1) newRadio.push(members);
  }

  const newD = dst.d?.clone() ?? PDFDict.withContext(context);
  newD.set(ON, newOn);
  newD.set(OFF, newOff);

  if (newRadio.size()) newD.set(RBGroups, newRadio);
  const newProps = props?.clone() ?? PDFDict.withContext(context);
  newProps.set(OCGs, newGroups);
  newProps.set(D, newD);
  const unlinked: PDFRef[] = [];

  for (const raw of [
    destination.get(OCProperties),
    props?.get(OCGs),
    props?.get(D),
    dst.d?.get(ON),
    dst.d?.get(OFF),
    dst.d?.get(RBGroups),
  ]) {
    if (raw instanceof PDFRef) unlinked.push(raw);
  }

  destination.set(OCProperties, newProps);

  return unlinked;
};
