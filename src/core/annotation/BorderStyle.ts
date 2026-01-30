import PDFArray from '../objects/PDFArray.js';
import type PDFDict from '../objects/PDFDict.js';
import PDFName from '../objects/PDFName.js';
import PDFNumber from '../objects/PDFNumber.js';

/**
 * Border style types as defined in the PDF specification.
 * - S: Solid border (default)
 * - D: Dashed border
 * - B: Beveled (3D raised) border
 * - I: Inset (3D depressed) border
 * - U: Underline border
 */
export enum BorderStyleType {
  Solid = 'S',
  Dashed = 'D',
  Beveled = 'B',
  Inset = 'I',
  Underline = 'U',
}

class BorderStyle {
  readonly dict: PDFDict;

  static fromDict = (dict: PDFDict): BorderStyle => new BorderStyle(dict);

  protected constructor(dict: PDFDict) {
    this.dict = dict;
  }

  W(): PDFNumber | undefined {
    const W = this.dict.lookup(PDFName.of('W'));
    if (W instanceof PDFNumber) return W;
    return;
  }

  S(): PDFName | undefined {
    const S = this.dict.lookup(PDFName.of('S'));
    if (S instanceof PDFName) return S;
    return;
  }

  D(): PDFArray | undefined {
    const D = this.dict.lookup(PDFName.of('D'));
    if (D instanceof PDFArray) return D;
    return;
  }

  getWidth(): number | undefined {
    return this.W()?.asNumber() ?? 1;
  }

  setWidth(width: number) {
    const W = this.dict.context.obj(width);
    this.dict.set(PDFName.of('W'), W);
  }

  /**
   * Get the border style type.
   * @returns The border style type, defaults to Solid if not specified.
   */
  getStyle(): BorderStyleType {
    const S = this.S();
    if (!S) return BorderStyleType.Solid;
    const value = S.decodeText();
    if (value === 'D') return BorderStyleType.Dashed;
    if (value === 'B') return BorderStyleType.Beveled;
    if (value === 'I') return BorderStyleType.Inset;
    if (value === 'U') return BorderStyleType.Underline;
    return BorderStyleType.Solid;
  }

  /**
   * Set the border style type.
   * @param style The border style to set.
   */
  setStyle(style: BorderStyleType) {
    this.dict.set(PDFName.of('S'), PDFName.of(style));
  }

  /**
   * Get the dash pattern for dashed borders.
   * @returns An array of [dashLength, gapLength] or undefined if not set.
   *          Default is [3] per PDF spec.
   */
  getDashPattern(): number[] | undefined {
    const D = this.D();
    if (!D) return;

    const pattern: number[] = [];
    for (let i = 0; i < D.size(); i++) {
      const item = D.get(i);
      if (item instanceof PDFNumber) {
        pattern.push(item.asNumber());
      }
    }
    return pattern.length > 0 ? pattern : undefined;
  }

  /**
   * Set the dash pattern for dashed borders.
   * @param pattern An array of dash lengths, e.g., [3, 2] for 3-unit dash, 2-unit gap.
   */
  setDashPattern(pattern: number[]) {
    const D = this.dict.context.obj(pattern);
    this.dict.set(PDFName.of('D'), D);
  }
}

export default BorderStyle;
