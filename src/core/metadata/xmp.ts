import {
  childElements,
  createElement,
  decodeXmlBytes,
  isXmlText,
  lookupNamespace,
  parseXml,
  serializeXml,
  textContent,
  XML_NAMESPACE,
  XMLNS_NAMESPACE,
  type XmlAttribute,
  type XmlDocument,
  type XmlElement,
  XmlError,
} from "./xml.js";

export const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export const X_NS = "adobe:ns:meta/";
export const DC_NS = "http://purl.org/dc/elements/1.1/";
export const XMP_NS = "http://ns.adobe.com/xap/1.0/";
export const PDF_NS = "http://ns.adobe.com/pdf/1.3/";
export const PDFAID_NS = "http://www.aiim.org/pdfa/ns/id/";
export const PDFA_EXTENSION_NS = "http://www.aiim.org/pdfa/ns/extension/";
export const PDFA_SCHEMA_NS = "http://www.aiim.org/pdfa/ns/schema#";
export const PDFA_PROPERTY_NS = "http://www.aiim.org/pdfa/ns/property#";

/**
 * The prefixes this library writes; PDF/A prescribes `pdfaid` and the
 * extension schema prefixes (ISO 19005-1 6.7.8, -2/-3 6.6.2.3).
 */
const preferredPrefix: Record<string, string> = {
  [DC_NS]: "dc",
  [XMP_NS]: "xmp",
  [PDF_NS]: "pdf",
  [PDFAID_NS]: "pdfaid",
  [PDFA_EXTENSION_NS]: "pdfaExtension",
  [PDFA_SCHEMA_NS]: "pdfaSchema",
  [PDFA_PROPERTY_NS]: "pdfaProperty",
};

/** One property of a PDF/A extension schema (`pdfaProperty` fields). */
export interface ExtensionProperty {
  name: string;
  valueType: string;
  category: "internal" | "external";
  description: string;
}

/** A PDF/A extension schema description (`pdfaSchema` fields). */
export interface ExtensionSchema {
  schema: string;
  namespaceURI: string;
  prefix: string;
  properties: ExtensionProperty[];
}

/** The fields of an XMP structure, by namespace and local name. */
interface XmpStruct {
  /** The element new fields are added to. */
  container: XmlElement;
  fields: Map<string, (XmlElement | XmlAttribute)[]>;
}

const fieldKey = (ns: string | undefined, local: string) => `${ns} ${local}`;

/** A packet that cannot be read or edited as this module understands XMP. */
export class XmpError extends Error {}

/** One occurrence of a property on a top-level description. */
export type XmpProperty =
  | { form: "attribute"; description: XmlElement; attribute: XmlAttribute }
  | { form: "element"; description: XmlElement; element: XmlElement };

/**
 * What a property holds, as far as this library reads it: absent, a simple
 * text value, or a shape it does not interpret (a URI, a structure, an
 * array where text was expected, a qualified value, several occurrences).
 */
export type XmpRead =
  | { kind: "absent" }
  | { kind: "text"; value: string }
  | { kind: "unsupported"; reason: string };

const isRdf = (e: XmlElement, local: string) => e.ns === RDF_NS && e.local === local;

const rdfAttribute = (e: XmlElement, local: string) =>
  e.attributes.find((a) => a.ns === RDF_NS && a.local === local);

const langOf = (e: XmlElement) =>
  e.attributes.find((a) => a.ns === XML_NAMESPACE && a.local === "lang")?.value;

const isSyntaxAttribute = (a: XmlAttribute) =>
  a.ns === XMLNS_NAMESPACE || a.ns === RDF_NS || a.ns === XML_NAMESPACE;

const isDefaultItem = (e: XmlElement) => langOf(e)?.toLowerCase() === "x-default";

/** Whether an element is a plain text-valued property element. */
const simpleTextElement = (e: XmlElement): boolean =>
  childElements(e).length === 0 &&
  e.attributes.every(
    (a) => a.ns === XMLNS_NAMESPACE || (a.ns === XML_NAMESPACE && a.local === "lang"),
  );

/** The rdf:Bag/Seq/Alt directly inside a property element, if that is all it holds. */
const arrayOf = (e: XmlElement): XmlElement | undefined => {
  const kids = childElements(e);

  if (kids.length !== 1 || textContent(e).trim() !== "") return undefined;
  const [array] = kids;

  if (array && (isRdf(array, "Bag") || isRdf(array, "Seq") || isRdf(array, "Alt"))) {
    return array;
  }

  return undefined;
};

/** Every rdf:RDF element; a packet has exactly one (ISO 16684-1 7.3). */
const findRdfRoots = (e: XmlElement, found: XmlElement[] = []): XmlElement[] => {
  if (isRdf(e, "RDF")) {
    found.push(e);

    return found;
  }

  for (const child of childElements(e)) findRdfRoots(child, found);

  return found;
};

export const XMP_PACKET_ID = "W5M0MpCehiHzreSzNTczkc9d";

const freshPacket = (): string =>
  `<?xpacket begin="\uFEFF" id="${XMP_PACKET_ID}"?>\n` +
  `<x:xmpmeta xmlns:x="${X_NS}">\n` +
  ` <rdf:RDF xmlns:rdf="${RDF_NS}">\n` +
  " </rdf:RDF>\n" +
  "</x:xmpmeta>\n" +
  `${" ".repeat(99)}\n`.repeat(20) +
  '<?xpacket end="w"?>';

/**
 * An XMP packet (ISO 16684-1) read for the properties of the resource it
 * describes. Every top-level rdf:Description must describe the same
 * resource (one rdf:about value); a packet that does not is refused rather
 * than merged. Properties are found by namespace URI and local name, in
 * attribute or element form, whatever prefixes the packet uses.
 *
 * Edits mutate the tree and `serialize` writes the whole packet back: other
 * properties, descriptions, comments and the xpacket wrapper are kept, though
 * not byte for byte.
 */
export class XmpPacket {
  static parse(bytes: Uint8Array): XmpPacket {
    let doc: XmlDocument;

    try {
      doc = parseXml(decodeXmlBytes(bytes));
    } catch (e) {
      if (e instanceof XmlError || e instanceof TypeError) {
        throw new XmpError(`Unreadable XMP: ${(e as Error).message}`);
      }

      throw e;
    }

    return new XmpPacket(doc);
  }

  static create(): XmpPacket {
    return new XmpPacket(parseXml(freshPacket()));
  }

  private readonly doc: XmlDocument;
  private readonly rdf: XmlElement;
  private readonly about: string;

  private constructor(doc: XmlDocument) {
    this.doc = doc;
    const roots = findRdfRoots(doc.root);

    if (roots.length !== 1) {
      throw new XmpError(
        `XMP packet has ${roots.length === 0 ? "no" : "more than one"} rdf:RDF element`,
      );
    }

    const rdf = roots[0]!;
    this.rdf = rdf;
    let about: string | undefined;

    for (const node of childElements(rdf)) {
      if (!isRdf(node, "Description")) {
        throw new XmpError(`XMP top-level node <${node.name}> is not an rdf:Description`);
      }

      const value = rdfAttribute(node, "about")?.value ?? "";

      if (about !== undefined && value !== about) {
        throw new XmpError("XMP descriptions describe different resources (rdf:about differs)");
      }

      about = value;
    }

    this.about = about ?? "";
  }

  private descriptions(): XmlElement[] {
    return childElements(this.rdf);
  }

  /** Every occurrence of a property across the top-level descriptions. */
  properties(ns: string, local: string): XmpProperty[] {
    const found: XmpProperty[] = [];

    for (const description of this.descriptions()) {
      for (const attribute of description.attributes) {
        if (!isSyntaxAttribute(attribute) && attribute.ns === ns && attribute.local === local) {
          found.push({ form: "attribute", description, attribute });
        }
      }

      for (const element of childElements(description)) {
        if (element.ns === ns && element.local === local) {
          found.push({ form: "element", description, element });
        }
      }
    }

    return found;
  }

  /** Whether any property of the namespace occurs at all. */
  hasNamespace(ns: string): boolean {
    for (const description of this.descriptions()) {
      if (description.attributes.some((a) => !isSyntaxAttribute(a) && a.ns === ns)) {
        return true;
      }

      if (childElements(description).some((e) => e.ns === ns)) return true;
    }

    return false;
  }

  /** Every distinct local name the namespace's properties use. */
  propertyNames(ns: string): string[] {
    const names = new Set<string>();

    for (const description of this.descriptions()) {
      for (const a of description.attributes) {
        if (!isSyntaxAttribute(a) && a.ns === ns) names.add(a.local);
      }

      for (const e of childElements(description)) {
        if (e.ns === ns) names.add(e.local);
      }
    }

    return [...names];
  }

  /** A property read as simple text; one occurrence only. */
  readText(ns: string, local: string): XmpRead {
    const found = this.properties(ns, local);

    if (found.length === 0) return { kind: "absent" };

    if (found.length > 1) {
      return { kind: "unsupported", reason: `${local} occurs more than once` };
    }

    const [p] = found;

    if (p!.form === "attribute") return { kind: "text", value: p!.attribute.value };

    if (!simpleTextElement(p!.element)) {
      return { kind: "unsupported", reason: `${local} is not a simple value` };
    }

    return { kind: "text", value: textContent(p!.element) };
  }

  /** The x-default item of a language alternative. */
  readDefaultLanguage(ns: string, local: string): XmpRead {
    const found = this.properties(ns, local);

    if (found.length === 0) return { kind: "absent" };

    if (found.length > 1 || found[0]!.form !== "element") {
      return {
        kind: "unsupported",
        reason: `${local} is not a language alternative`,
      };
    }

    const alt = arrayOf(found[0]!.element);

    if (!alt || !isRdf(alt, "Alt")) {
      return {
        kind: "unsupported",
        reason: `${local} is not a language alternative`,
      };
    }

    const items = this.items(alt);

    if (!items) return { kind: "unsupported", reason: `${local} has a non-text item` };
    const defaults = items.filter(isDefaultItem);

    if (defaults.length > 1) {
      return {
        kind: "unsupported",
        reason: `${local} has several x-default items`,
      };
    }

    const [item] = defaults;

    return item ? { kind: "text", value: textContent(item) } : { kind: "absent" };
  }

  /** The items of an ordered or unordered array, as text. */
  readList(
    ns: string,
    local: string,
    ordered = false,
  ):
    | { kind: "absent" }
    | { kind: "list"; values: string[] }
    | { kind: "unsupported"; reason: string } {
    const found = this.properties(ns, local);

    if (found.length === 0) return { kind: "absent" };

    if (found.length > 1 || found[0]!.form !== "element") {
      return { kind: "unsupported", reason: `${local} is not an array` };
    }

    const array = arrayOf(found[0]!.element);

    if (!array || isRdf(array, "Alt") || (ordered && !isRdf(array, "Seq"))) {
      return {
        kind: "unsupported",
        reason: `${local} is not ${ordered ? "an ordered" : "an"} array`,
      };
    }

    const items = this.items(array);

    if (!items) return { kind: "unsupported", reason: `${local} has a non-text item` };

    return { kind: "list", values: items.map(textContent) };
  }

  private items(array: XmlElement): XmlElement[] | undefined {
    const kids = childElements(array);

    if (kids.some((k) => !isRdf(k, "li") || !simpleTextElement(k))) return undefined;

    return kids;
  }

  /**
   * Set a simple text property, creating it if absent. `prefix` names the
   * prefix a new property is written with, for a namespace this module has
   * no preferred prefix for; an existing property keeps its own.
   */
  setText(ns: string, local: string, value: string, prefix?: string): void {
    assertXmlValue(value);
    const found = this.properties(ns, local);

    if (found.length > 1) throw new XmpError(`XMP ${local} occurs more than once`);
    const [p] = found;

    if (!p) {
      this.addProperty(ns, local, prefix).children = [{ kind: "text", value }];

      return;
    }

    if (p.form === "attribute") {
      p.attribute.value = value;

      return;
    }

    if (!simpleTextElement(p.element)) {
      throw new XmpError(`XMP ${local} is not a simple value`);
    }

    p.element.children = [{ kind: "text", value }];
  }

  /** Set the x-default item of a language alternative, keeping other languages. */
  setDefaultLanguage(ns: string, local: string, value: string): void {
    assertXmlValue(value);
    const found = this.properties(ns, local);

    if (found.length === 0) {
      const property = this.addProperty(ns, local);
      const alt = this.addRdfChild(property, "Alt");
      this.addItem(alt, value, "x-default");

      return;
    }

    if (found.length > 1 || found[0]!.form !== "element") {
      throw new XmpError(`XMP ${local} is not a language alternative`);
    }

    const alt = arrayOf(found[0]!.element);

    if (!alt || !isRdf(alt, "Alt") || !this.items(alt)) {
      throw new XmpError(`XMP ${local} is not a language alternative`);
    }

    const defaults = childElements(alt).filter(isDefaultItem);

    if (defaults.length > 1) {
      throw new XmpError(`XMP ${local} has several x-default items`);
    }

    const [item] = defaults;

    if (item) {
      item.children = [{ kind: "text", value }];
    } else {
      // The x-default item comes first (XMP part 1, 8.2.2.4).
      const li = this.addItem(alt, value, "x-default");
      alt.children.splice(alt.children.indexOf(li), 1);
      alt.children.unshift(li);
    }
  }

  /** Replace an ordered array with a single item. */
  setSingleItemList(ns: string, local: string, value: string): void {
    assertXmlValue(value);
    const found = this.properties(ns, local);

    if (found.length > 1 || (found[0] && found[0].form !== "element")) {
      throw new XmpError(`XMP ${local} is not an array`);
    }

    let property: XmlElement;

    if (found[0]) {
      property = (found[0] as { element: XmlElement }).element;
      const array = arrayOf(property);

      if (!array || isRdf(array, "Alt") || !this.items(array)) {
        throw new XmpError(`XMP ${local} is not an array of text items`);
      }

      // Always an ordered array, whatever the packet had (dc:creator is a Seq).
      property.children = [];
      this.addItem(this.addRdfChild(property, "Seq"), value);

      return;
    }

    property = this.addProperty(ns, local);
    this.addItem(this.addRdfChild(property, "Seq"), value);
  }

  /**
   * A name in the RDF namespace usable at `context`: with a prefix bound to
   * it in scope, else (for an element) unprefixed under an RDF default
   * namespace, else with an `rdf` prefix declared on `context` itself.
   */
  private rdfName(context: XmlElement, local: string, attribute = false): string {
    for (let e: XmlElement | undefined = context; e; e = e.parent) {
      for (const a of e.attributes) {
        if (a.ns === XMLNS_NAMESPACE && a.value === RDF_NS && a.local) {
          if (lookupNamespace(context, a.local) === RDF_NS) {
            return `${a.local}:${local}`;
          }
        }
      }
    }

    if (!attribute && lookupNamespace(context, "") === RDF_NS) return local;

    if (lookupNamespace(context, "rdf") !== undefined) {
      throw new XmpError("XMP: the rdf prefix is bound to another namespace");
    }

    context.attributes.unshift({
      name: "xmlns:rdf",
      ns: XMLNS_NAMESPACE,
      local: "rdf",
      value: RDF_NS,
    });

    return `rdf:${local}`;
  }

  private addRdfChild(parent: XmlElement, local: string): XmlElement {
    const child = createElement(this.rdfName(parent, local), RDF_NS, parent);
    parent.children.push(child);

    return child;
  }

  private addItem(array: XmlElement, value: string, lang?: string): XmlElement {
    const li = this.addRdfChild(array, "li");

    if (lang !== undefined) {
      li.attributes.push({
        name: "xml:lang",
        ns: XML_NAMESPACE,
        local: "lang",
        value: lang,
      });
    }

    li.children = [{ kind: "text", value }];

    return li;
  }

  /**
   * Add an empty property element. It goes on a description where the
   * preferred prefix is already bound to the namespace; otherwise on a new
   * description that declares the prefix itself, so no existing binding is
   * disturbed.
   */
  private addProperty(ns: string, local: string, prefixOverride?: string): XmlElement {
    const prefix = prefixOverride ?? preferredPrefix[ns];

    if (!prefix) throw new XmpError(`XMP: no prefix known for ${ns}`);

    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(prefix) || /^xml/i.test(prefix)) {
      throw new XmpError(`XMP: ${prefix} is not a usable prefix`);
    }

    let description = this.descriptions().find((d) => lookupNamespace(d, prefix) === ns);

    if (!description) {
      description = this.addRdfChild(this.rdf, "Description");
      description.attributes.push(
        {
          name: this.rdfName(description, "about", true),
          ns: RDF_NS,
          local: "about",
          value: this.about,
        },
        {
          name: `xmlns:${prefix}`,
          ns: XMLNS_NAMESPACE,
          local: prefix,
          value: ns,
        },
      );
    }

    const property = createElement(`${prefix}:${local}`, ns, description);
    description.children.push(property);

    return property;
  }

  /**
   * A qualified element name for `ns` usable at `context`: a prefix already
   * bound to it in scope, else its preferred prefix declared on `context`.
   */
  private qualifiedName(context: XmlElement, ns: string, local: string) {
    for (let e: XmlElement | undefined = context; e; e = e.parent) {
      for (const a of e.attributes) {
        if (
          a.ns === XMLNS_NAMESPACE &&
          a.value === ns &&
          a.local &&
          lookupNamespace(context, a.local) === ns
        ) {
          return `${a.local}:${local}`;
        }
      }
    }

    const prefix = preferredPrefix[ns];

    if (!prefix) throw new XmpError(`XMP: no prefix known for ${ns}`);

    if (lookupNamespace(context, prefix) !== undefined) {
      throw new XmpError(`XMP: the ${prefix} prefix is bound to another namespace`);
    }

    context.attributes.push({
      name: `xmlns:${prefix}`,
      ns: XMLNS_NAMESPACE,
      local: prefix,
      value: ns,
    });

    return `${prefix}:${local}`;
  }

  private addField(container: XmlElement, ns: string, local: string): XmlElement {
    const field = createElement(this.qualifiedName(container, ns, local), ns, container);

    container.children.push(field);

    return field;
  }

  private addTextField(container: XmlElement, ns: string, local: string, value: string) {
    this.addField(container, ns, local).children = [{ kind: "text", value }];
  }

  /**
   * Read an array item as a structure: `rdf:parseType="Resource"` or a
   * single nested rdf:Description. Undefined for any other form.
   */
  private readStruct(item: XmlElement): XmpStruct | undefined {
    if (!isRdf(item, "li") || textContent(item).trim() !== "") return undefined;

    // Only namespace declarations, plus the parseType that makes the item
    // itself the structure; any other RDF or xml: attribute (rdf:resource,
    // rdf:nodeID, xml:lang ...) is a form this module does not read.
    const onlyDeclarations = (e: XmlElement, allowParseType: boolean) =>
      e.attributes.every(
        (a) =>
          a.ns === XMLNS_NAMESPACE ||
          (allowParseType && a.ns === RDF_NS && a.local === "parseType"),
      );

    let container: XmlElement;

    if (rdfAttribute(item, "parseType")?.value === "Resource") {
      if (!onlyDeclarations(item, true)) return undefined;
      container = item;
    } else {
      const kids = childElements(item);

      if (
        kids.length !== 1 ||
        !isRdf(kids[0]!, "Description") ||
        !onlyDeclarations(item, false) ||
        textContent(kids[0]!).trim() !== "" ||
        kids[0]!.attributes.some((a) => a.ns === RDF_NS || a.ns === XML_NAMESPACE)
      ) {
        return undefined;
      }

      container = kids[0]!;
    }

    const fields = new Map<string, (XmlElement | XmlAttribute)[]>();

    const add = (key: string, f: XmlElement | XmlAttribute) =>
      fields.set(key, [...(fields.get(key) ?? []), f]);

    for (const a of container.attributes) {
      if (!isSyntaxAttribute(a)) add(fieldKey(a.ns, a.local), a);
    }

    for (const e of childElements(container)) add(fieldKey(e.ns, e.local), e);

    return { container, fields };
  }

  /** A structure field read as simple text, stated once. */
  private structText(struct: XmpStruct, ns: string, local: string): XmpRead {
    const found = struct.fields.get(fieldKey(ns, local)) ?? [];

    if (found.length === 0) return { kind: "absent" };

    if (found.length > 1) {
      return { kind: "unsupported", reason: `${local} occurs more than once` };
    }

    const f = found[0]!;

    if ("children" in f) {
      if (!simpleTextElement(f)) {
        return {
          kind: "unsupported",
          reason: `${local} is not a simple value`,
        };
      }

      return { kind: "text", value: textContent(f).trim() };
    }

    return { kind: "text", value: f.value.trim() };
  }

  /** The text of a structure field that must be stated once, as text. */
  private requiredText(struct: XmpStruct, ns: string, local: string): string {
    const read = this.structText(struct, ns, local);

    if (read.kind === "text" && read.value !== "") return read.value;
    throw new XmpError(
      read.kind === "unsupported"
        ? `XMP extension schema field ${local}: ${read.reason}`
        : `XMP extension schema lacks ${local}`,
    );
  }

  /** The items of the pdfaExtension:schemas bag, or undefined if absent. */
  private schemaBag(): XmlElement | undefined {
    const found = this.properties(PDFA_EXTENSION_NS, "schemas");

    if (found.length === 0) return undefined;

    if (found.length > 1 || found[0]!.form !== "element") {
      throw new XmpError("XMP pdfaExtension:schemas is not a single bag");
    }

    const bag = arrayOf(found[0]!.element);

    if (!bag || !isRdf(bag, "Bag")) {
      throw new XmpError("XMP pdfaExtension:schemas is not a bag");
    }

    return bag;
  }

  /**
   * The schemas the packet's PDF/A extension schema container declares,
   * keyed by structure. Throws for any item this module cannot read.
   */
  private extensionSchemas(): { struct: XmpStruct; namespaceURI: string }[] {
    const bag = this.schemaBag();

    if (!bag) return [];

    return childElements(bag).map((item) => {
      const struct = this.readStruct(item);

      if (!struct) {
        throw new XmpError("XMP pdfaExtension:schemas has an item that is not a structure");
      }

      return {
        struct,
        namespaceURI: this.requiredText(struct, PDFA_SCHEMA_NS, "namespaceURI"),
      };
    });
  }

  /** The namespace URIs the PDF/A extension schemas declare. */
  extensionSchemaNamespaces(): string[] {
    return this.extensionSchemas().map((s) => s.namespaceURI);
  }

  /**
   * Make the packet declare `schema` as a PDF/A extension schema. An
   * existing declaration of the same namespace is kept and completed: each
   * property it lacks is added, and one it describes differently (another
   * value type or category, a missing description) is refused, as are a
   * declaration under another prefix and more than one declaration.
   * Other schemas are left as they are. A throw can leave the packet partly
   * edited, so callers edit a packet they discard on failure.
   */
  ensureExtensionSchema(schema: ExtensionSchema): void {
    const matching = this.extensionSchemas().filter((s) => s.namespaceURI === schema.namespaceURI);

    if (matching.length > 1) {
      throw new XmpError(
        `XMP declares the extension schema for ${schema.namespaceURI} more than once`,
      );
    }

    const [existing] = matching;

    if (!existing) {
      let bag = this.schemaBag();

      if (!bag) {
        bag = this.addRdfChild(this.addProperty(PDFA_EXTENSION_NS, "schemas"), "Bag");
      }

      const item = this.addResourceItem(bag);
      this.addTextField(item, PDFA_SCHEMA_NS, "schema", schema.schema);
      this.addTextField(item, PDFA_SCHEMA_NS, "namespaceURI", schema.namespaceURI);
      this.addTextField(item, PDFA_SCHEMA_NS, "prefix", schema.prefix);

      const seq = this.addRdfChild(this.addField(item, PDFA_SCHEMA_NS, "property"), "Seq");

      for (const p of schema.properties) this.addExtensionProperty(seq, p);

      return;
    }

    const { struct } = existing;
    this.requiredText(struct, PDFA_SCHEMA_NS, "schema");
    const prefix = this.requiredText(struct, PDFA_SCHEMA_NS, "prefix");

    if (prefix !== schema.prefix) {
      throw new XmpError(
        `XMP declares ${schema.namespaceURI} with prefix ${prefix}, not ${schema.prefix}`,
      );
    }

    const propertyFields = struct.fields.get(fieldKey(PDFA_SCHEMA_NS, "property")) ?? [];

    if (propertyFields.length > 1) {
      throw new XmpError("XMP extension schema states property more than once");
    }

    let seq: XmlElement | undefined;
    const declared = new Map<string, XmpStruct>();
    const [field] = propertyFields;

    if (field) {
      seq = "children" in field ? arrayOf(field) : undefined;

      if (!seq || !isRdf(seq, "Seq")) {
        throw new XmpError("XMP extension schema property is not a Seq");
      }

      for (const item of childElements(seq)) {
        const p = this.readStruct(item);

        if (!p) {
          throw new XmpError("XMP extension schema has a property that is not a structure");
        }

        const name = this.requiredText(p, PDFA_PROPERTY_NS, "name");

        if (declared.has(name)) {
          throw new XmpError(`XMP extension schema describes ${name} more than once`);
        }

        declared.set(name, p);
      }
    }

    const missing: ExtensionProperty[] = [];

    for (const wanted of schema.properties) {
      const p = declared.get(wanted.name);

      if (!p) {
        missing.push(wanted);
        continue;
      }

      const valueType = this.requiredText(p, PDFA_PROPERTY_NS, "valueType");
      const category = this.requiredText(p, PDFA_PROPERTY_NS, "category");
      this.requiredText(p, PDFA_PROPERTY_NS, "description");

      if (valueType !== wanted.valueType || category !== wanted.category) {
        throw new XmpError(
          `XMP extension schema describes ${wanted.name} as ${valueType}/${category}, not ${wanted.valueType}/${wanted.category}`,
        );
      }
    }

    if (missing.length === 0) return;

    if (!seq) {
      seq = this.addRdfChild(this.addField(struct.container, PDFA_SCHEMA_NS, "property"), "Seq");
    }

    for (const p of missing) this.addExtensionProperty(seq, p);
  }

  private addResourceItem(array: XmlElement): XmlElement {
    const item = this.addRdfChild(array, "li");
    item.attributes.push({
      name: this.rdfName(item, "parseType", true),
      ns: RDF_NS,
      local: "parseType",
      value: "Resource",
    });

    return item;
  }

  private addExtensionProperty(seq: XmlElement, p: ExtensionProperty) {
    const item = this.addResourceItem(seq);
    this.addTextField(item, PDFA_PROPERTY_NS, "name", p.name);
    this.addTextField(item, PDFA_PROPERTY_NS, "valueType", p.valueType);
    this.addTextField(item, PDFA_PROPERTY_NS, "category", p.category);
    this.addTextField(item, PDFA_PROPERTY_NS, "description", p.description);
  }

  serialize(): Uint8Array {
    return new TextEncoder().encode(serializeXml(this.doc));
  }
}

/** Refuse a value XML 1.0 cannot hold before anything is changed. */
export const assertXmlValue = (value: string): void => {
  if (!isXmlText(value)) {
    throw new XmpError(
      "The value contains characters XML cannot represent (a control character or an unpaired surrogate)",
    );
  }
};

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** An XMP date (ISO 8601) at whole-second precision in UTC. */
export const formatXmpDate = (date: Date): string =>
  `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
  `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}Z`;

/** Parse an XMP date; undefined when it is not one. */
export const parseXmpDate = (text: string): Date | undefined => {
  const m =
    /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})?)?)?)?$/.exec(
      text.trim(),
    );

  if (!m) return undefined;

  const [, y, mo = "01", d = "01", h = "00", mi = "00", s = "00", frac = "", tz] = m;

  const ms = frac ? Math.floor(Number(`0.${frac}`) * 1000) : 0;
  // setUTCFullYear keeps years below 100 as written; the component check
  // refuses dates Date would otherwise roll over (February 31).
  const date = new Date(0);
  date.setUTCFullYear(+y!, +mo - 1, +d);
  date.setUTCHours(+h, +mi, +s, ms);

  if (
    date.getUTCFullYear() !== +y! ||
    date.getUTCMonth() !== +mo - 1 ||
    date.getUTCDate() !== +d ||
    date.getUTCHours() !== +h ||
    date.getUTCMinutes() !== +mi ||
    date.getUTCSeconds() !== +s
  ) {
    return undefined;
  }

  let time = date.getTime();

  if (tz && tz !== "Z") {
    if (Number(tz.slice(1, 3)) > 23 || Number(tz.slice(4, 6)) > 59) {
      return undefined;
    }

    const sign = tz[0] === "-" ? -1 : 1;
    time -= sign * (Number(tz.slice(1, 3)) * 60 + Number(tz.slice(4, 6))) * 60_000;
  }

  return Number.isNaN(time) ? undefined : new Date(time);
};
