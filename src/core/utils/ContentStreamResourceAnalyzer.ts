import {
  type ContentOperand,
  type ContentOperation,
  parseContentStream,
} from '../content/ContentStreamParser.js';
import { getEffectiveVersion } from '../document/pdfVersion.js';
import PDFArray from '../objects/PDFArray.js';
import PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import type PDFObject from '../objects/PDFObject.js';
import PDFRawStream from '../objects/PDFRawStream.js';
import PDFRef from '../objects/PDFRef.js';
import PDFStream from '../objects/PDFStream.js';
import type PDFContext from '../PDFContext.js';
import DecodeStream from '../streams/DecodeStream.js';
import { decodePDFRawStream } from '../streams/decode.js';
import PDFContentStream from '../structures/PDFContentStream.js';
import type PDFPageLeaf from '../structures/PDFPageLeaf.js';

/**
 * Resource pruning for copyPages({ optimizeResources: true }).
 *
 * The contract is a superset: a resource entry is dropped only when the
 * analysis establishes nothing copied with the page can use it. Any
 * uncertainty (undecodable or malformed content, an operator this does not
 * know, a budget exceeded) keeps the page's resources whole.
 *
 * One rule finds what uses the page's resources: a content stream with no
 * resource dictionary of its own resolves names in the page's (ISO 32000-1
 * 7.8.3), so it is parsed in page scope. That covers the page's /Contents;
 * Form XObjects and tiling patterns without /Resources; Type 3 glyph streams
 * when neither glyph nor font has /Resources; and annotation appearance
 * streams without /Resources. Such streams are found by walking everything
 * the copy keeps (selected entries, retained entries, the page's other
 * entries such as /Annots), so they are found however deep they sit, also
 * below a Form or font that has resources of its own, or a Type 3 font set
 * through an ExtGState /Font. Names they use select more entries, which are
 * walked in turn, until nothing new is selected.
 */

const FILTERABLE: ReadonlyMap<PDFName, string> = new Map([
  [PDFName.Font, 'Font'],
  [PDFName.XObject, 'XObject'],
  [PDFName.ExtGState, 'ExtGState'],
  [PDFName.ColorSpace, 'ColorSpace'],
  [PDFName.of('Pattern'), 'Pattern'],
  [PDFName.of('Shading'), 'Shading'],
  [PDFName.of('Properties'), 'Properties'],
]);

/** Used implicitly by the device colour operators (ISO 32000-1 8.6.5.6). */
const DEFAULT_COLOR_SPACES = ['DefaultGray', 'DefaultRGB', 'DefaultCMYK'];

/** Every operator of ISO 32000-1 Table A.1, less ID and EI (part of BI). */
const KNOWN_OPERATORS = new Set(
  (
    'b B b* B* BDC BI BMC BT BX c cm CS cs d d0 d1 Do DP EMC ET EX f F f* G ' +
    'g gs h i j J K k l m M MP n q Q re RG rg ri s S SC sc SCN scn sh T* Tc ' +
    'Td TD Tf Tj TJ TL Tm Tr Ts Tw Tz v w W W* y \' "'
  ).split(' '),
);

/** Upper bound on objects walked per page. */
const MAX_WALKED_OBJECTS = 200_000;

class GiveUp extends Error {}

const isName = (
  v: ContentOperand | undefined,
): v is { type: 'name'; name: PDFName } =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && v.type === 'name';

const nameOperand = (v: ContentOperand | undefined): PDFName => {
  if (!isName(v)) throw new GiveUp();

  return v.name;
};

class PageResourceAnalysis {
  private readonly used = new Map<string, Set<PDFName>>();
  private readonly walked = new Set<PDFObject>();
  private readonly parsed = new Set<PDFStream>();
  private readonly pending: PDFObject[] = [];
  private budget: number;

  constructor(
    private readonly context: PDFContext,
    private readonly resources: PDFDict,
  ) {
    this.budget = context.maxDecodedStreamSize ?? DecodeStream.maxDecodedSize;
  }

  run(page: PDFPageLeaf): PDFDict {
    const contents = page.get(PDFName.Contents);
    const resolved = this.context.lookup(contents);

    if (resolved instanceof PDFStream) {
      this.parseInPageScope([resolved]);
    } else if (resolved instanceof PDFArray) {
      const streams: PDFStream[] = [];

      for (let i = 0; i < resolved.size(); i++) {
        const s = this.context.lookup(resolved.get(i));

        if (!(s instanceof PDFStream)) throw new GiveUp();
        streams.push(s);
      }

      this.parseInPageScope(streams);
    } else if (resolved !== undefined) {
      throw new GiveUp();
    }

    for (const [key, value] of page.entries()) {
      if (key === PDFName.Resources || key === PDFName.Parent) continue;
      this.pending.push(value);
    }

    for (const name of DEFAULT_COLOR_SPACES) {
      this.select('ColorSpace', PDFName.of(name));
    }

    for (const [key, value] of this.resources.entries()) {
      const category = FILTERABLE.get(key);

      if (!category || !(this.context.lookup(value) instanceof PDFDict)) {
        this.pending.push(value);
      }
    }

    this.drain();

    return this.filtered();
  }

  private categoryDict(category: string): PDFDict | undefined {
    for (const [key, cat] of FILTERABLE) {
      if (cat === category) {
        const d = this.context.lookup(this.resources.get(key));

        return d instanceof PDFDict ? d : undefined;
      }
    }

    return;
  }

  private select(category: string, name: PDFName) {
    let set = this.used.get(category);

    if (!set) {
      set = new Set();
      this.used.set(category, set);
    }

    if (set.has(name)) return;
    set.add(name);
    const value = this.categoryDict(category)?.get(name);

    if (value !== undefined) this.pending.push(value);
  }

  private drain() {
    while (this.pending.length > 0) {
      let obj: PDFObject | undefined = this.pending.pop()!;

      if (obj instanceof PDFRef) obj = this.context.lookup(obj);

      if (obj === undefined || this.walked.has(obj)) continue;
      this.walked.add(obj);

      if (this.walked.size > MAX_WALKED_OBJECTS) throw new GiveUp();

      if (obj instanceof PDFArray) {
        for (let i = 0; i < obj.size(); i++) this.pending.push(obj.get(i));
      } else if (obj instanceof PDFStream) {
        this.visitDict(obj.dict, obj);
      } else if (obj instanceof PDFDict) {
        this.visitDict(obj);
      }
    }
  }

  private ownResources(dict: PDFDict): boolean {
    return this.context.lookup(dict.get(PDFName.Resources)) instanceof PDFDict;
  }

  private visitDict(dict: PDFDict, stream?: PDFStream) {
    if (stream && !this.ownResources(dict)) {
      const subtype = this.context.lookup(dict.get(PDFName.Subtype));

      const patternType = this.context.lookup(
        dict.get(PDFName.of('PatternType')),
      );

      if (
        subtype === PDFName.Form ||
        (patternType instanceof PDFNumber && patternType.asNumber() === 1)
      ) {
        this.parseInPageScope([stream]);
      }
    }

    const subtype = this.context.lookup(dict.get(PDFName.Subtype));

    if (subtype === PDFName.of('Type3')) {
      const charProcs = this.context.lookup(dict.get(PDFName.of('CharProcs')));

      if (charProcs !== undefined && !(charProcs instanceof PDFDict)) {
        throw new GiveUp();
      }

      if (charProcs && !this.ownResources(dict)) {
        for (const [, value] of charProcs.entries()) {
          this.contentWithoutCaller(value);
        }
      }
    }

    const ap = this.context.lookup(dict.get(PDFName.of('AP')));

    if (ap instanceof PDFDict) {
      for (const key of ['N', 'R', 'D']) {
        const appearance = this.context.lookup(ap.get(PDFName.of(key)));

        if (appearance instanceof PDFStream) {
          this.contentWithoutCaller(appearance);
        } else if (appearance instanceof PDFDict) {
          for (const [, state] of appearance.entries()) {
            this.contentWithoutCaller(state);
          }
        } else if (appearance !== undefined) {
          throw new GiveUp();
        }
      }
    } else if (ap !== undefined) {
      throw new GiveUp();
    }

    for (const [, value] of dict.entries()) this.pending.push(value);
  }

  /** A glyph or appearance stream: page scope unless it has resources. */
  private contentWithoutCaller(value: PDFObject) {
    const stream = this.context.lookup(value);

    if (stream === undefined) return;

    if (!(stream instanceof PDFStream)) throw new GiveUp();

    if (!this.ownResources(stream.dict)) this.parseInPageScope([stream]);
  }

  private decoded(stream: PDFStream): Uint8Array {
    try {
      if (stream instanceof PDFRawStream) {
        return decodePDFRawStream(stream).decode();
      }

      if (stream instanceof PDFContentStream) {
        return stream.getUnencodedContents();
      }
    } catch {
      throw new GiveUp();
    }

    throw new GiveUp();
  }

  /** Parses the exact concatenation of `streams` and selects what it uses. */
  private parseInPageScope(streams: PDFStream[]) {
    const fresh = streams.filter((s) => !this.parsed.has(s));

    if (fresh.length === 0) return;

    for (const s of fresh) this.parsed.add(s);

    const parts: Uint8Array[] = [];
    let total = 0;

    for (const s of fresh) {
      const bytes = this.decoded(s);
      total += bytes.length;
      this.budget -= bytes.length;

      if (this.budget < 0) throw new GiveUp();
      parts.push(bytes);
    }

    let joined: Uint8Array;

    if (parts.length === 1) {
      joined = parts[0]!;
    } else {
      joined = new Uint8Array(total);
      let offset = 0;

      for (const p of parts) {
        joined.set(p, offset);
        offset += p.length;
      }
    }

    const { operations, complete } = parseContentStream(joined);

    if (!complete) throw new GiveUp();

    for (const op of operations) this.useOperation(op);
  }

  /** Every name in an inline image colour space may be a resource name. */
  private selectColorSpaceNames(value: ContentOperand | undefined) {
    if (isName(value)) {
      this.select('ColorSpace', value.name);
    } else if (Array.isArray(value)) {
      for (const item of value) this.selectColorSpaceNames(item);
    }
  }

  private useOperation({ operator, operands, inlineImage }: ContentOperation) {
    if (!KNOWN_OPERATORS.has(operator)) throw new GiveUp();

    if (inlineImage) {
      this.selectColorSpaceNames(inlineImage.dict.get(PDFName.of('CS')));
      this.selectColorSpaceNames(
        inlineImage.dict.get(PDFName.of('ColorSpace')),
      );
    }

    switch (operator) {
      case 'Tf':
        if (operands.length !== 2 || typeof operands[1] !== 'number') {
          throw new GiveUp();
        }

        this.select('Font', nameOperand(operands[0]));

        return;
      case 'Do':
      case 'gs':
      case 'cs':
      case 'CS':
      case 'sh': {
        if (operands.length !== 1) throw new GiveUp();

        const category =
          operator === 'Do'
            ? 'XObject'
            : operator === 'gs'
              ? 'ExtGState'
              : operator === 'sh'
                ? 'Shading'
                : 'ColorSpace';

        this.select(category, nameOperand(operands[0]));

        return;
      }

      case 'scn':
      case 'SCN': {
        const last = operands[operands.length - 1];
        const numbers = isName(last) ? operands.slice(0, -1) : operands;

        if (numbers.some((n) => typeof n !== 'number')) throw new GiveUp();

        if (isName(last)) this.select('Pattern', last.name);

        return;
      }

      case 'BDC':
      case 'DP': {
        if (operands.length !== 2) throw new GiveUp();
        nameOperand(operands[0]);
        const props = operands[1];

        if (isName(props)) {
          this.select('Properties', props.name);
        } else if (
          typeof props !== 'object' ||
          props === null ||
          Array.isArray(props) ||
          props.type !== 'dict'
        ) {
          throw new GiveUp();
        }

        return;
      }

      default:
        return;
    }
  }

  private filtered(): PDFDict {
    const out = this.context.obj({});

    for (const [key, value] of this.resources.entries()) {
      const category = FILTERABLE.get(key);
      const dict = this.context.lookup(value);

      if (!category || !(dict instanceof PDFDict)) {
        out.set(key, value);
        continue;
      }

      const keep = this.context.obj({});

      for (const name of this.used.get(category) ?? []) {
        const entry = dict.get(name);

        if (entry !== undefined) keep.set(name, entry);
      }

      if (keep.entries().length > 0) out.set(key, keep);
    }

    return out;
  }
}

/**
 * The page's resource dictionary with every entry nothing copied with the
 * page can use removed, or undefined when that cannot be established (the
 * caller then copies the resources whole).
 */
export function pruneResources(
  page: PDFPageLeaf,
  context: PDFContext,
): PDFDict | undefined {
  const resources = page.Resources();

  if (!resources) return;
  // PDF 1.1 Forms with resources of their own still required their names in
  // the page's resources.
  const [major, minor] = getEffectiveVersion(context);

  if (major < 1 || (major === 1 && minor < 2)) return;

  try {
    return new PageResourceAnalysis(context, resources).run(page);
  } catch (e) {
    if (e instanceof GiveUp) return;
    throw e;
  }
}
