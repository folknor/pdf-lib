import type { PDFRef } from '../core/index.js';
import PDFName from '../core/objects/PDFName.js';
import { utf8Encode } from '../utils/unicode.js';
import { type Color, ColorTypes, colorToComponents } from './colors.js';
import type PDFDocument from './PDFDocument.js';

const alternateSpace = (color: Color): string =>
  color.type === ColorTypes.Grayscale
    ? 'DeviceGray'
    : color.type === ColorTypes.RGB
      ? 'DeviceRGB'
      : 'DeviceCMYK';

/** The alternate-space value of tint 0: no ink, so the paper shows. */
const noInk = (color: Color): number[] =>
  color.type === ColorTypes.Grayscale
    ? [1]
    : color.type === ColorTypes.RGB
      ? [1, 1, 1]
      : [0, 0, 0, 0];

/**
 * The PDF name for a colourant given as text: UTF-8 bytes, each held as one
 * code unit, which is what `PDFName.fromDecoded` escapes byte by byte. Handing
 * it the text itself would escape a code unit above 0xFF as more than two hex
 * digits, which a reader parses as a different name.
 */
export const colorantName = (name: string): PDFName => {
  if (name.length === 0) throw new Error('A colourant name cannot be empty');

  if (name.includes('\0')) {
    throw new Error('A colourant name cannot contain NUL');
  }

  if (
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(
      name,
    )
  ) {
    throw new Error('A colourant name cannot contain an unpaired surrogate');
  }

  let bytes = '';

  for (const byte of utf8Encode(name, false))
    bytes += String.fromCharCode(byte);

  return PDFName.fromDecoded(bytes);
};

/**
 * A Separation colour space (ISO 32000-1 8.6.6.4): one named colourant, such
 * as a brand ink, a varnish or a cutting contour, printed on its own plate.
 * Made by `PDFDocument.embedSeparation`; paint with it through
 * `separation(space, tint)` in the `PDFPage` drawing methods.
 *
 * The definition is written into the document when this object is made, as
 * `[/Separation name alternateSpace tintTransform]`. The tint transform is a
 * linear (type 2) function from tint 0, the alternate space's no-ink value,
 * to tint 1, the alternate colour; it is only what a device without the
 * colourant shows, not a colour-managed simulation of the ink.
 */
export default class PDFSeparation {
  /** The colourant name, as given. */
  readonly name: string;
  readonly ref: PDFRef;
  readonly doc: PDFDocument;
  /** The alternate colour's space and components, copied at creation. */
  readonly alternateSpace: string;
  readonly alternateComponents: readonly number[];

  /** @internal Use `PDFDocument.embedSeparation`. */
  static create(doc: PDFDocument, name: string, alternate: Color) {
    return new PDFSeparation(doc, name, alternate);
  }

  private constructor(doc: PDFDocument, name: string, alternate: Color) {
    const space = alternateSpace(alternate);
    const components = colorToComponents(alternate);

    for (const c of components) {
      if (!(Number.isFinite(c) && c >= 0 && c <= 1)) {
        throw new Error(
          `Alternate colour components must be in [0, 1]: ${JSON.stringify(alternate)}`,
        );
      }
    }

    const pdfName = colorantName(name);

    this.name = name;
    this.doc = doc;
    this.alternateSpace = space;
    this.alternateComponents = Object.freeze([...components]);

    const { context } = doc;

    const tintTransform = context.obj({
      FunctionType: 2,
      Domain: [0, 1],
      C0: noInk(alternate),
      C1: [...components],
      N: 1,
    });

    this.ref = context.register(
      context.obj([
        PDFName.of('Separation'),
        pdfName,
        PDFName.of(space),
        tintTransform,
      ]),
    );
  }

  /** Whether `alternate` is the colour this space was made with. */
  hasAlternate(alternate: Color): boolean {
    const components = colorToComponents(alternate);

    return (
      alternateSpace(alternate) === this.alternateSpace &&
      components.length === this.alternateComponents.length &&
      components.every((c, i) => c === this.alternateComponents[i])
    );
  }
}
