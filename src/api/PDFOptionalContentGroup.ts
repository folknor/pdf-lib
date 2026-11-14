import {
  isOptionalContentGroupOn,
  optionalContentGroupName,
  setOptionalContentGroupOn,
} from "../core/interactive/OptionalContent.js";
import type PDFRef from "../core/objects/PDFRef.js";
import type PDFCatalog from "../core/structures/PDFCatalog.js";
import { savableBaseline } from "../core/writers/PDFWriter.js";
import { collectUnreferenced } from "./detach.js";

/**
 * An optional content group (a layer) of a document, as listed in its
 * catalog /OCProperties /OCGs. Obtain one from
 * [[PDFDocument.getOptionalContentGroups]].
 *
 * Its state here is the group's initial state in the document's default
 * configuration (/OCProperties /D), read afresh on every call. That is not a
 * promise of what a viewer renders: usage rules, auto-state arrays, intents
 * and membership dictionaries are not taken into account, and alternate
 * configurations (/Configs) are neither read nor changed. Setting a group's
 * state changes no page content.
 */
export default class PDFOptionalContentGroup {
  /** The group dictionary's ref. Groups are identified by it, not by name. */
  readonly ref: PDFRef;

  private readonly catalog: PDFCatalog;

  /** @hidden */
  constructor(ref: PDFRef, catalog: PDFCatalog) {
    this.ref = ref;
    this.catalog = catalog;
  }

  /**
   * The group's /Name, or `undefined` when it has none. Names are labels and
   * need not be unique. For a file loaded encrypted without its password the
   * text may still be ciphertext.
   */
  getName(): string | undefined {
    return optionalContentGroupName(this.catalog.context, this.ref);
  }

  /**
   * Whether the group is ON in the default configuration. A /BaseState other
   * than /ON there is malformed; as recovery /OFF is honoured and anything
   * else is read as /ON. A group in both /ON and /OFF is OFF.
   */
  isOnByDefault(): boolean {
    return isOptionalContentGroupOn(this.catalog, this.ref);
  }

  /**
   * Set the group's state in the default configuration. Turning it ON turns
   * OFF the groups sharing a radio-button group (/RBGroups) with it. The
   * edit replaces /OCProperties /D with a copy, so anything sharing the old
   * one is left as it was; other groups' entries are kept.
   *
   * Throws, changing nothing, when the group is no longer listed in /OCGs,
   * when the configuration is malformed, or for a file loaded encrypted
   * without its password.
   */
  setOnByDefault(on: boolean): void {
    savableBaseline(this.catalog.context);
    const unlinked = setOptionalContentGroupOn(this.catalog, this.ref, on);
    collectUnreferenced(this.catalog.context, unlinked);
  }
}
