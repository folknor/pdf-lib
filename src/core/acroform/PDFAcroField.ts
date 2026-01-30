import { findLastMatch } from '../../utils/index.js';
import PDFArray from '../objects/PDFArray.js';
import PDFDict from '../objects/PDFDict.js';
import PDFHexString from '../objects/PDFHexString.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';
import type PDFObject from '../objects/PDFObject.js';
import PDFRef from '../objects/PDFRef.js';
import PDFString from '../objects/PDFString.js';

// Examples:
//   `/Helv 12 Tf` -> ['Helv', '12']
//   `/HeBo 8.00 Tf` -> ['HeBo', '8.00']
//   `/HeBo Tf` -> ['HeBo', undefined]
const tfRegex =
  /\/([^\0\t\n\f\r ]+)[\0\t\n\f\r ]*(\d*\.\d+|\d+)?[\0\t\n\f\r ]+Tf/;
class PDFAcroField {
  readonly dict: PDFDict;
  readonly ref: PDFRef;

  protected constructor(dict: PDFDict, ref: PDFRef) {
    this.dict = dict;
    this.ref = ref;
  }

  T(): PDFString | PDFHexString | undefined {
    return this.dict.lookupMaybe(PDFName.of('T'), PDFString, PDFHexString);
  }

  Ff(): PDFNumber | undefined {
    const numberOrRef = this.getInheritableAttribute(PDFName.of('Ff'));
    return this.dict.context.lookupMaybe(numberOrRef, PDFNumber);
  }

  V(): PDFObject | undefined {
    const valueOrRef = this.getInheritableAttribute(PDFName.of('V'));
    return this.dict.context.lookup(valueOrRef);
  }

  Kids(): PDFArray | undefined {
    return this.dict.lookupMaybe(PDFName.of('Kids'), PDFArray);
  }

  // Parent(): PDFDict | undefined {
  //   return this.dict.lookupMaybe(PDFName.of('Parent'), PDFDict);
  // }

  DA(): PDFString | PDFHexString | undefined {
    const da = this.dict.lookup(PDFName.of('DA'));
    if (da instanceof PDFString || da instanceof PDFHexString) return da;
    return;
  }

  setKids(kids: PDFObject[]) {
    this.dict.set(PDFName.of('Kids'), this.dict.context.obj(kids));
  }

  getParent(): PDFAcroField | undefined {
    // const parent = this.Parent();
    // if (!parent) return undefined;
    // return new PDFAcroField(parent);

    const parentRef = this.dict.get(PDFName.of('Parent'));
    if (parentRef instanceof PDFRef) {
      const parent = this.dict.lookup(PDFName.of('Parent'), PDFDict);
      return new PDFAcroField(parent, parentRef);
    }

    return;
  }

  setParent(parent: PDFRef | undefined) {
    if (!parent) this.dict.delete(PDFName.of('Parent'));
    else this.dict.set(PDFName.of('Parent'), parent);
  }

  getFullyQualifiedName(): string | undefined {
    const parent = this.getParent();
    if (!parent) return this.getPartialName();
    return `${parent.getFullyQualifiedName()}.${this.getPartialName()}`;
  }

  getPartialName(): string | undefined {
    return this.T()?.decodeText();
  }

  setPartialName(partialName: string | undefined) {
    if (!partialName) this.dict.delete(PDFName.of('T'));
    else this.dict.set(PDFName.of('T'), PDFHexString.fromText(partialName));
  }

  setDefaultAppearance(appearance: string) {
    this.dict.set(PDFName.of('DA'), PDFString.of(appearance));
  }

  getDefaultAppearance(): string | undefined {
    const DA = this.DA();

    if (DA instanceof PDFHexString) {
      return DA.decodeText();
    }

    return DA?.asString();
  }

  /**
   * Get the font name from the default appearance (DA) string.
   * @returns The font name (e.g., "Helv", "F1") or undefined if not found.
   */
  getDefaultAppearanceFontName(): string | undefined {
    const da = this.getDefaultAppearance();
    if (!da) return;
    const match = findLastMatch(da, tfRegex);
    return match.match?.[1];
  }

  /**
   * Get the font size from the default appearance (DA) string.
   * @returns The font size or undefined if not found.
   */
  getDefaultAppearanceFontSize(): number | undefined {
    const da = this.getDefaultAppearance();
    if (!da) return;
    const match = findLastMatch(da, tfRegex);
    const sizeStr = match.match?.[2];
    return sizeStr ? parseFloat(sizeStr) : undefined;
  }

  setFontSize(fontSize: number) {
    const da = this.getDefaultAppearance();
    if (!da) {
      this.setDefaultAppearance(`/Helv ${fontSize} Tf 0 g`);
      return;
    }

    const daMatch = findLastMatch(da, tfRegex);
    if (!daMatch.match) {
      this.setDefaultAppearance(`/Helv ${fontSize} Tf 0 g`);
      return;
    }

    const daStart = da.slice(0, daMatch.pos - daMatch.match[0].length);
    const daEnd = daMatch.pos <= da.length ? da.slice(daMatch.pos) : '';
    const fontName = daMatch.match[1];
    const modifiedDa = `${daStart} /${fontName} ${fontSize} Tf ${daEnd}`;

    this.setDefaultAppearance(modifiedDa);
  }

  getFlags(): number {
    return this.Ff()?.asNumber() ?? 0;
  }

  setFlags(flags: number) {
    this.dict.set(PDFName.of('Ff'), PDFNumber.of(flags));
  }

  hasFlag(flag: number): boolean {
    const flags = this.getFlags();
    return (flags & flag) !== 0;
  }

  setFlag(flag: number) {
    const flags = this.getFlags();
    this.setFlags(flags | flag);
  }

  clearFlag(flag: number) {
    const flags = this.getFlags();
    this.setFlags(flags & ~flag);
  }

  setFlagTo(flag: number, enable: boolean) {
    if (enable) this.setFlag(flag);
    else this.clearFlag(flag);
  }

  getInheritableAttribute(name: PDFName): PDFObject | undefined {
    let attribute: PDFObject | undefined;
    this.ascend((node) => {
      if (!attribute) attribute = node.dict.get(name);
    });
    return attribute;
  }

  ascend(visitor: (node: PDFAcroField) => any): void {
    visitor(this);
    const parent = this.getParent();
    if (parent) parent.ascend(visitor);
  }
}

export default PDFAcroField;
