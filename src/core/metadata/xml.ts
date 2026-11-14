/**
 * A small namespace-aware XML 1.0 parser and serializer, enough for XMP
 * packets (ISO 16684-1). It builds a mutable element tree whose element and
 * attribute names are resolved to namespace URIs, so readers never depend on
 * the prefixes a packet happens to use.
 *
 * Deliberately not supported: document type declarations. A DOCTYPE is
 * refused outright, so there are no external entities and no entity
 * expansion beyond the five predefined entities and character references.
 * Parsing is bounded in nesting depth and node count; callers bound the
 * input size.
 */

export const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
export const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';

export class XmlError extends Error {}

export interface XmlAttribute {
  /** The qualified name as written, e.g. `rdf:about`. */
  name: string;
  /** The namespace URI; undefined for unprefixed attributes. */
  ns: string | undefined;
  local: string;
  value: string;
}

export interface XmlElement {
  kind: 'element';
  name: string;
  ns: string | undefined;
  local: string;
  attributes: XmlAttribute[];
  children: XmlNode[];
  parent: XmlElement | undefined;
}

export interface XmlText {
  kind: 'text';
  value: string;
}

export interface XmlComment {
  kind: 'comment';
  value: string;
}

export interface XmlProcessingInstruction {
  kind: 'pi';
  target: string;
  data: string;
}

export type XmlNode =
  | XmlElement
  | XmlText
  | XmlComment
  | XmlProcessingInstruction;

export interface XmlDocument {
  /** Comments, processing instructions and whitespace before the root. */
  prolog: XmlNode[];
  root: XmlElement;
  /** Comments, processing instructions and whitespace after the root. */
  epilog: XmlNode[];
}

export interface XmlLimits {
  maxDepth: number;
  maxNodes: number;
}

const defaultLimits: XmlLimits = { maxDepth: 256, maxNodes: 200_000 };

// XML 1.0 (fifth edition) Char production. With the `u` flag a lone
// surrogate is its own code point, outside every range, so it matches.
const invalidCharacter =
  /[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u;

/** Whether `text` can be represented in an XML 1.0 document. */
export const isXmlText = (text: string): boolean =>
  !invalidCharacter.test(text);

const nameStartRanges =
  ':A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u{10000}-\\u{EFFFF}';

const nameStart = new RegExp(`[${nameStartRanges}]`, 'u');

const nameChar = new RegExp(
  `[${nameStartRanges}\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]`,
  'u',
);

const isWhitespace = (c: string | undefined) =>
  c === ' ' || c === '\t' || c === '\n' || c === '\r';

const predefinedEntities: Record<string, string> = {
  lt: '<',
  gt: '>',
  amp: '&',
  apos: "'",
  quot: '"',
};

// XML 1.0 production 23 (XMLDecl), without the leading '<?xml'.
const xmlDeclaration =
  /^version\s*=\s*(["'])1\.[0-9]+\1(\s+encoding\s*=\s*(["'])[A-Za-z][A-Za-z0-9._-]*\3)?(\s+standalone\s*=\s*(["'])(yes|no)\5)?\s*$/;

interface RawAttribute {
  name: string;
  value: string;
}

class Parser {
  private pos = 0;
  private nodes = 0;
  private readonly text: string;
  private readonly limits: XmlLimits;

  constructor(text: string, limits: XmlLimits) {
    // XML 1.0 section 2.11: every CRLF and lone CR is read as LF.
    this.text = text.replace(/\r\n?/g, '\n');
    this.limits = limits;
  }

  parse(): XmlDocument {
    if (!isXmlText(this.text)) {
      throw new XmlError('XML contains characters outside the XML 1.0 range');
    }

    const prolog = this.misc(true);

    if (this.peek() !== '<') throw this.error('expected the root element');
    const root = this.element(undefined, 1);
    const epilog = this.misc(false);

    if (this.pos !== this.text.length) {
      throw this.error('content after the root element');
    }

    return { prolog, root, epilog };
  }

  private error(message: string) {
    return new XmlError(`XML: ${message} at offset ${this.pos}`);
  }

  private peek(offset = 0) {
    return this.text[this.pos + offset];
  }

  private startsWith(s: string) {
    return this.text.startsWith(s, this.pos);
  }

  private count() {
    this.nodes += 1;

    if (this.nodes > this.limits.maxNodes) {
      throw new XmlError('XML: too many nodes');
    }
  }

  private misc(isProlog: boolean): XmlNode[] {
    const nodes: XmlNode[] = [];
    let first = true;

    while (this.pos < this.text.length) {
      if (isWhitespace(this.peek())) {
        const start = this.pos;

        while (isWhitespace(this.peek())) this.pos++;
        nodes.push({ kind: 'text', value: this.text.slice(start, this.pos) });
      } else if (this.startsWith('<?')) {
        const pi = this.processingInstruction();

        if (pi.target.toLowerCase() === 'xml') {
          if (!(isProlog && first) || pi.target !== 'xml') {
            throw this.error('misplaced XML declaration');
          }

          if (!xmlDeclaration.test(pi.data)) {
            throw this.error('malformed XML declaration');
          }
        }

        nodes.push(pi);
      } else if (this.startsWith('<!--')) {
        nodes.push(this.comment());
      } else if (this.startsWith('<!')) {
        throw this.error('document type declarations are not accepted');
      } else {
        break;
      }

      first = false;
    }

    return nodes;
  }

  private name(): string {
    const start = this.pos;
    const first = this.text.codePointAt(this.pos);

    if (first === undefined || !nameStart.test(String.fromCodePoint(first))) {
      throw this.error('expected a name');
    }

    this.pos += first > 0xffff ? 2 : 1;

    for (;;) {
      const cp = this.text.codePointAt(this.pos);

      if (cp === undefined || !nameChar.test(String.fromCodePoint(cp))) break;
      this.pos += cp > 0xffff ? 2 : 1;
    }

    return this.text.slice(start, this.pos);
  }

  private skipWhitespace(): boolean {
    const start = this.pos;

    while (isWhitespace(this.peek())) this.pos++;

    return this.pos > start;
  }

  private processingInstruction(): XmlProcessingInstruction {
    this.count();
    this.pos += 2;
    const target = this.name();
    let data = '';

    if (!this.startsWith('?>')) {
      if (!this.skipWhitespace())
        throw this.error('malformed processing instruction');
      const end = this.text.indexOf('?>', this.pos);

      if (end < 0) throw this.error('unterminated processing instruction');
      data = this.text.slice(this.pos, end);
      this.pos = end;
    }

    this.pos += 2;

    return { kind: 'pi', target, data };
  }

  private comment(): XmlComment {
    this.count();
    this.pos += 4;
    const end = this.text.indexOf('--', this.pos);

    if (end < 0) throw this.error('unterminated comment');

    if (this.text[end + 2] !== '>') throw this.error("'--' inside a comment");
    const value = this.text.slice(this.pos, end);
    this.pos = end + 3;

    return { kind: 'comment', value };
  }

  private reference(): string {
    // At '&'.
    const end = this.text.indexOf(';', this.pos);

    if (end < 0) throw this.error('unterminated reference');
    const body = this.text.slice(this.pos + 1, end);
    this.pos = end + 1;

    if (body.startsWith('#')) {
      const code = /^#x[0-9a-fA-F]+$/.test(body)
        ? parseInt(body.slice(2), 16)
        : /^#[0-9]+$/.test(body)
          ? parseInt(body.slice(1), 10)
          : Number.NaN;

      if (!Number.isFinite(code) || code > 0x10ffff) {
        throw this.error('malformed character reference');
      }

      const char = String.fromCodePoint(code);

      if (!isXmlText(char))
        throw this.error('character reference to a non-character');

      return char;
    }

    const entity = Object.hasOwn(predefinedEntities, body)
      ? predefinedEntities[body]
      : undefined;

    if (entity === undefined) throw this.error(`undeclared entity '${body}'`);

    return entity;
  }

  private attributeValue(): string {
    const quote = this.peek();

    if (quote !== '"' && quote !== "'")
      throw this.error('expected a quoted value');
    this.pos++;
    let value = '';

    for (;;) {
      const c = this.peek();

      if (c === undefined) throw this.error('unterminated attribute value');

      if (c === quote) {
        this.pos++;

        return value;
      }

      if (c === '<') throw this.error("'<' in an attribute value");

      if (c === '&') {
        value += this.reference();
      } else {
        // Attribute-value normalization (XML 1.0 3.3.3) for CDATA attributes.
        value += c === '\t' || c === '\n' ? ' ' : c;
        this.pos++;
      }
    }
  }

  private element(parent: XmlElement | undefined, depth: number): XmlElement {
    if (depth > this.limits.maxDepth)
      throw new XmlError('XML: nesting too deep');
    this.count();
    this.pos++; // '<'
    const name = this.name();
    const raw: RawAttribute[] = [];

    for (;;) {
      const hadSpace = this.skipWhitespace();
      const c = this.peek();

      if (c === '>' || c === '/') break;

      if (!hadSpace) throw this.error('expected whitespace between attributes');
      const attrName = this.name();
      this.skipWhitespace();

      if (this.peek() !== '=') throw this.error("expected '='");
      this.pos++;
      this.skipWhitespace();
      const value = this.attributeValue();

      if (raw.some((a) => a.name === attrName)) {
        throw this.error(`duplicate attribute '${attrName}'`);
      }

      raw.push({ name: attrName, value });
      this.count();
    }

    const element: XmlElement = {
      kind: 'element',
      name,
      ns: undefined,
      local: name,
      attributes: [],
      children: [],
      parent,
    };

    // Namespace declarations first, so the element's own names see them.
    element.attributes = raw.map((a) => ({
      name: a.name,
      ns: undefined,
      local: a.name,
      value: a.value,
    }));

    for (const attr of element.attributes) {
      if (attr.name === 'xmlns' || attr.name.startsWith('xmlns:')) {
        attr.ns = XMLNS_NAMESPACE;
        attr.local = attr.name === 'xmlns' ? '' : attr.name.slice(6);

        if (attr.local === 'xmlns' || attr.local.includes(':')) {
          throw this.error('malformed namespace declaration');
        }

        if (attr.local !== '' && attr.value === '') {
          throw this.error('a prefix cannot be undeclared in XML 1.0');
        }

        // Namespaces in XML 1.0, section 3: reserved bindings.
        if (
          (attr.local === 'xml') !== (attr.value === XML_NAMESPACE) ||
          attr.value === XMLNS_NAMESPACE
        ) {
          throw this.error('reserved namespace bound wrongly');
        }
      }
    }

    const [ns, local] = resolveName(element, name, true);
    element.ns = ns;
    element.local = local;
    const seen = new Set<string>();

    for (const attr of element.attributes) {
      if (attr.ns === XMLNS_NAMESPACE) continue;
      const [attrNs, attrLocal] = resolveName(element, attr.name, false);
      attr.ns = attrNs;
      attr.local = attrLocal;
      const key = `${attrNs ?? ''}\u0000${attrLocal}`;

      if (seen.has(key)) throw this.error(`duplicate attribute '${attr.name}'`);
      seen.add(key);
    }

    if (this.peek() === '/') {
      this.pos++;

      if (this.peek() !== '>') throw this.error("expected '>'");
      this.pos++;

      return element;
    }

    this.pos++; // '>'

    let text = '';

    const flushText = () => {
      if (text) {
        this.count();
        element.children.push({ kind: 'text', value: text });
        text = '';
      }
    };

    for (;;) {
      const c = this.peek();

      if (c === undefined) throw this.error(`unclosed element '${name}'`);

      if (c === '<') {
        if (this.startsWith('</')) {
          flushText();
          this.pos += 2;
          const closing = this.name();
          this.skipWhitespace();

          if (closing !== name || this.peek() !== '>') {
            throw this.error(`mismatched closing tag for '${name}'`);
          }

          this.pos++;

          return element;
        }

        if (this.startsWith('<![CDATA[')) {
          const end = this.text.indexOf(']]>', this.pos);

          if (end < 0) throw this.error('unterminated CDATA section');
          text += this.text.slice(this.pos + 9, end);
          this.pos = end + 3;
        } else if (this.startsWith('<!--')) {
          flushText();
          element.children.push(this.comment());
        } else if (this.startsWith('<?')) {
          flushText();
          const pi = this.processingInstruction();

          if (pi.target.toLowerCase() === 'xml') {
            throw this.error('misplaced XML declaration');
          }

          element.children.push(pi);
        } else if (this.startsWith('<!')) {
          throw this.error('markup declarations are not accepted');
        } else {
          flushText();
          element.children.push(this.element(element, depth + 1));
        }
      } else if (c === '&') {
        text += this.reference();
      } else {
        if (c === ']' && this.startsWith(']]>')) {
          throw this.error("']]>' in content");
        }

        text += c;
        this.pos++;
      }
    }
  }
}

/** The namespace URI bound to `prefix` ('' for the default) at `element`. */
export const lookupNamespace = (
  element: XmlElement | undefined,
  prefix: string,
): string | undefined => {
  if (prefix === 'xml') return XML_NAMESPACE;

  if (prefix === 'xmlns') return XMLNS_NAMESPACE;

  for (let e = element; e; e = e.parent) {
    for (const attr of e.attributes) {
      if (attr.ns === XMLNS_NAMESPACE && attr.local === prefix) {
        return attr.value === '' ? undefined : attr.value;
      }
    }
  }

  return undefined;
};

const resolveName = (
  element: XmlElement,
  name: string,
  isElement: boolean,
): [string | undefined, string] => {
  const colon = name.indexOf(':');

  if (colon < 0) {
    return [isElement ? lookupNamespace(element, '') : undefined, name];
  }

  const prefix = name.slice(0, colon);
  const local = name.slice(colon + 1);

  if (!prefix || !local || local.includes(':')) {
    throw new XmlError(`XML: malformed qualified name '${name}'`);
  }

  const ns = lookupNamespace(element, prefix);

  if (ns === undefined) {
    throw new XmlError(`XML: unbound namespace prefix '${prefix}'`);
  }

  return [ns, local];
};

export const parseXml = (
  text: string,
  limits: XmlLimits = defaultLimits,
): XmlDocument => new Parser(text, limits).parse();

/**
 * Decode XML bytes: UTF-8 (with or without a byte order mark) or UTF-16 with
 * a byte order mark. Malformed byte sequences throw.
 */
export const decodeXmlBytes = (bytes: Uint8Array): string => {
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be', { fatal: true }).decode(
      bytes.subarray(2),
    );
  }

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le', { fatal: true }).decode(
      bytes.subarray(2),
    );
  }

  // TextDecoder drops a leading UTF-8 byte order mark itself.
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
};

const escapeText = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r/g, '&#xD;');

const escapeAttribute = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/\t/g, '&#x9;')
    .replace(/\n/g, '&#xA;')
    .replace(/\r/g, '&#xD;');

const serializeNode = (node: XmlNode, out: string[]): void => {
  switch (node.kind) {
    case 'text':
      out.push(escapeText(node.value));

      return;
    case 'comment':
      out.push(`<!--${node.value}-->`);

      return;
    case 'pi':
      out.push(
        node.data ? `<?${node.target} ${node.data}?>` : `<?${node.target}?>`,
      );

      return;
    case 'element': {
      out.push(`<${node.name}`);

      for (const attr of node.attributes) {
        out.push(` ${attr.name}="${escapeAttribute(attr.value)}"`);
      }

      if (node.children.length === 0) {
        out.push('/>');

        return;
      }

      out.push('>');

      for (const child of node.children) serializeNode(child, out);
      out.push(`</${node.name}>`);

      return;
    }
  }
};

/**
 * Serialize a document as UTF-8 text. An XML declaration is dropped, since
 * the output is always UTF-8 and any `encoding` it named may no longer hold.
 * Values are escaped so that reading the output gives back the same tree.
 */
export const serializeXml = (doc: XmlDocument): string => {
  const out: string[] = [];

  for (const node of doc.prolog) {
    if (node.kind === 'pi' && node.target.toLowerCase() === 'xml') continue;
    serializeNode(node, out);
  }

  serializeNode(doc.root, out);

  for (const node of doc.epilog) serializeNode(node, out);

  return out.join('');
};

/** Create an element with the given qualified name, namespace and parent. */
export const createElement = (
  name: string,
  ns: string | undefined,
  parent: XmlElement | undefined,
): XmlElement => {
  const colon = name.indexOf(':');

  return {
    kind: 'element',
    name,
    ns,
    local: colon < 0 ? name : name.slice(colon + 1),
    attributes: [],
    children: [],
    parent,
  };
};

/** The concatenated text of an element's text children. */
export const textContent = (element: XmlElement): string =>
  element.children
    .filter((c): c is XmlText => c.kind === 'text')
    .map((c) => c.value)
    .join('');

export const childElements = (element: XmlElement): XmlElement[] =>
  element.children.filter((c): c is XmlElement => c.kind === 'element');
