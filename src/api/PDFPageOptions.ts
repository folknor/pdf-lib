import type { AnnotationTypes } from "../core/annotation/AnnotationTypes.js";
import type { Space, TransformationMatrix } from "../types/index.js";
import type { Color, PaintColor } from "./colors.js";
import type { FillRule, LineCapStyle, TextRenderingMode } from "./operators.js";
import type PDFFont from "./PDFFont.js";
import type { Rotation } from "./rotations.js";

interface SvgOptions {
  matrix?: TransformationMatrix;
  clipSpaces?: Space[];
}

export enum BlendMode {
  Normal = "Normal",
  Multiply = "Multiply",
  Screen = "Screen",
  Overlay = "Overlay",
  Darken = "Darken",
  Lighten = "Lighten",
  ColorDodge = "ColorDodge",
  ColorBurn = "ColorBurn",
  HardLight = "HardLight",
  SoftLight = "SoftLight",
  Difference = "Difference",
  Exclusion = "Exclusion",
}

/** Overprint mode (`OPM`, ISO 32000-1 8.6.7). */
export type OverprintMode = 0 | 1;

export interface PDFPageDrawTextOptions extends SvgOptions {
  color?: PaintColor;
  opacity?: number;
  blendMode?: BlendMode;
  /**
   * Overprint the text fill drawn with `color` (`op`) instead of knocking out what lies beneath. When
   * any overprint option is given, the ones left out are written as false.
   * Needs PDF 1.3 or later.
   */
  overprint?: boolean;
  /**
   * Overprint the text outline drawn with `strokeColor` (`OP`). When any
   * overprint option is given, the ones left out are written as false.
   * Needs PDF 1.3 or later.
   */
  strokeOverprint?: boolean;
  /**
   * Overprint mode (`OPM`). With 1, overprinting a DeviceCMYK colour leaves
   * the plates of its zero components untouched, so `cmyk(0, 0, 0, 1)` over
   * a background prints black on top of it; with 0 every process plate is
   * painted and only spot plates survive. Default: 1 when an overprint
   * option is true, otherwise unchanged. The zero-component rule does not
   * apply to images. One mode covers both fill and stroke.
   */
  overprintMode?: OverprintMode;
  font?: PDFFont;
  size?: number;
  rotate?: Rotation;
  xSkew?: Rotation;
  ySkew?: Rotation;
  x?: number;
  y?: number;
  lineHeight?: number;
  maxWidth?: number;
  wordBreaks?: string[];
  strokeWidth?: number;
  strokeColor?: PaintColor;
  renderMode?: TextRenderingMode;
  /**
   * Extra spacing after each glyph in PDF points (before horizontal
   * scaling). Positive values increase spacing, negative decrease it. Marks
   * take none and stay on the glyph they are attached to; a ligature takes
   * it once. It is drawn as glyph positions (`TJ`), not with `Tc`, and
   * `maxWidth` line breaking measures it.
   * Default: 0 (normal character spacing)
   */
  characterSpacing?: number;
  /**
   * Extra spacing after each space in PDF points (before horizontal
   * scaling), in addition to the normal space width and `characterSpacing`.
   * It applies to each U+0020 in the text, with standard and embedded fonts
   * alike, and not to other characters the font draws with the same glyph
   * (U+00A0). A font loaded through another fontkit build that reports no
   * per-glyph code points applies it to the font's glyph for U+0020.
   * It is drawn as glyph positions (`TJ`), not with `Tw`, and `maxWidth`
   * line breaking measures it.
   * Default: 0 (normal word spacing)
   */
  wordSpacing?: number;
  /**
   * Horizontal scaling of text as a percentage (`Tz`).
   * 100 = normal width, 50 = half width, 200 = double width.
   * `maxWidth` line breaking measures it.
   * Default: 100
   *
   * Text is measured assuming the content stream has character and word
   * spacing 0 and, without this option, scaling 100 when it is drawn; the
   * library never leaves them otherwise, but operators pushed by hand can.
   */
  horizontalScaling?: number;
  /**
   * Text rise (superscript/subscript offset) in PDF points.
   * Positive values move text up, negative move it down.
   * Default: 0 (baseline)
   */
  textRise?: number;
}

export interface PDFPageDrawImageOptions extends SvgOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotate?: Rotation;
  xSkew?: Rotation;
  ySkew?: Rotation;
  opacity?: number;
  blendMode?: BlendMode;
  /**
   * Overprint the image (`op`) instead of knocking out what lies beneath. When
   * any overprint option is given, the ones left out are written as false.
   * Needs PDF 1.3 or later.
   */
  overprint?: boolean;
  /**
   * Overprint mode (`OPM`). With 1, overprinting a DeviceCMYK colour leaves
   * the plates of its zero components untouched, so `cmyk(0, 0, 0, 1)` over
   * a background prints black on top of it; with 0 every process plate is
   * painted and only spot plates survive. Default: 1 when an overprint
   * option is true, otherwise unchanged. The zero-component rule does not
   * apply to images. One mode covers both fill and stroke.
   */
  overprintMode?: OverprintMode;
}

export interface PDFPageDrawPageOptions {
  x?: number;
  y?: number;
  xScale?: number;
  yScale?: number;
  width?: number;
  height?: number;
  rotate?: Rotation;
  xSkew?: Rotation;
  ySkew?: Rotation;
  opacity?: number;
  blendMode?: BlendMode;
  /**
   * Overprint the embedded page's fills and strokes (`op` and `OP`). These
   * are defaults the page's own content inherits and may replace with
   * graphics states of its own. Mode 1 (see `overprintMode`) conflicts with
   * PDF/A-2 and later if that content paints in an ICC-based CMYK space.
   * Needs PDF 1.3 or later.
   */
  overprint?: boolean;
  /**
   * Overprint mode (`OPM`). With 1, overprinting a DeviceCMYK colour leaves
   * the plates of its zero components untouched, so `cmyk(0, 0, 0, 1)` over
   * a background prints black on top of it; with 0 every process plate is
   * painted and only spot plates survive. Default: 1 when an overprint
   * option is true, otherwise unchanged. The zero-component rule does not
   * apply to images. One mode covers both fill and stroke.
   */
  overprintMode?: OverprintMode;
}

export interface PDFPageDrawSVGOptions extends SvgOptions {
  x?: number;
  y?: number;
  scale?: number;
  rotate?: Rotation;
  borderWidth?: number;
  color?: PaintColor;
  opacity?: number;
  borderColor?: PaintColor;
  borderOpacity?: number;
  borderDashArray?: number[];
  borderDashPhase?: number;
  borderLineCap?: LineCapStyle;
  blendMode?: BlendMode;
  /**
   * Overprint the fill drawn with `color` (`op`) instead of knocking out what lies beneath. When
   * any overprint option is given, the ones left out are written as false.
   * Needs PDF 1.3 or later.
   */
  overprint?: boolean;
  /**
   * Overprint the border (`OP`) instead of knocking out what lies beneath.
   * When any overprint option is given, the ones left out are written as
   * false. Needs PDF 1.3 or later.
   */
  borderOverprint?: boolean;
  /**
   * Overprint mode (`OPM`). With 1, overprinting a DeviceCMYK colour leaves
   * the plates of its zero components untouched, so `cmyk(0, 0, 0, 1)` over
   * a background prints black on top of it; with 0 every process plate is
   * painted and only spot plates survive. Default: 1 when an overprint
   * option is true, otherwise unchanged. The zero-component rule does not
   * apply to images. One mode covers both fill and stroke.
   */
  overprintMode?: OverprintMode;
  fillRule?: FillRule;
}

export interface PDFPageDrawLineOptions extends SvgOptions {
  start: { x: number; y: number };
  end: { x: number; y: number };
  thickness?: number;
  color?: PaintColor;
  opacity?: number;
  lineCap?: LineCapStyle;
  dashArray?: number[];
  dashPhase?: number;
  blendMode?: BlendMode;
  /**
   * Overprint the line (`OP`) instead of knocking out what lies beneath.
   * Needs PDF 1.3 or later.
   */
  overprint?: boolean;
  /**
   * Overprint mode (`OPM`). With 1, overprinting a DeviceCMYK colour leaves
   * the plates of its zero components untouched, so `cmyk(0, 0, 0, 1)` over
   * a background prints black on top of it; with 0 every process plate is
   * painted and only spot plates survive. Default: 1 when an overprint
   * option is true, otherwise unchanged. The zero-component rule does not
   * apply to images. One mode covers both fill and stroke.
   */
  overprintMode?: OverprintMode;
}

export interface PDFPageDrawRectangleOptions extends SvgOptions {
  x?: number;
  y?: number;
  rx?: number;
  ry?: number;
  width?: number;
  height?: number;
  rotate?: Rotation;
  xSkew?: Rotation;
  ySkew?: Rotation;
  borderWidth?: number;
  color?: PaintColor;
  opacity?: number;
  borderColor?: PaintColor;
  borderOpacity?: number;
  borderDashArray?: number[];
  borderDashPhase?: number;
  borderLineCap?: LineCapStyle;
  blendMode?: BlendMode;
  /**
   * Overprint the fill drawn with `color` (`op`) instead of knocking out what lies beneath. When
   * any overprint option is given, the ones left out are written as false.
   * Needs PDF 1.3 or later.
   */
  overprint?: boolean;
  /**
   * Overprint the border (`OP`) instead of knocking out what lies beneath.
   * When any overprint option is given, the ones left out are written as
   * false. Needs PDF 1.3 or later.
   */
  borderOverprint?: boolean;
  /**
   * Overprint mode (`OPM`). With 1, overprinting a DeviceCMYK colour leaves
   * the plates of its zero components untouched, so `cmyk(0, 0, 0, 1)` over
   * a background prints black on top of it; with 0 every process plate is
   * painted and only spot plates survive. Default: 1 when an overprint
   * option is true, otherwise unchanged. The zero-component rule does not
   * apply to images. One mode covers both fill and stroke.
   */
  overprintMode?: OverprintMode;
}

export interface PDFPageDrawSquareOptions extends SvgOptions {
  x?: number;
  y?: number;
  size?: number;
  rotate?: Rotation;
  xSkew?: Rotation;
  ySkew?: Rotation;
  borderWidth?: number;
  color?: PaintColor;
  opacity?: number;
  borderColor?: PaintColor;
  borderOpacity?: number;
  borderDashArray?: number[];
  borderDashPhase?: number;
  borderLineCap?: LineCapStyle;
  blendMode?: BlendMode;
  /**
   * Overprint the fill drawn with `color` (`op`) instead of knocking out what lies beneath. When
   * any overprint option is given, the ones left out are written as false.
   * Needs PDF 1.3 or later.
   */
  overprint?: boolean;
  /**
   * Overprint the border (`OP`) instead of knocking out what lies beneath.
   * When any overprint option is given, the ones left out are written as
   * false. Needs PDF 1.3 or later.
   */
  borderOverprint?: boolean;
  /**
   * Overprint mode (`OPM`). With 1, overprinting a DeviceCMYK colour leaves
   * the plates of its zero components untouched, so `cmyk(0, 0, 0, 1)` over
   * a background prints black on top of it; with 0 every process plate is
   * painted and only spot plates survive. Default: 1 when an overprint
   * option is true, otherwise unchanged. The zero-component rule does not
   * apply to images. One mode covers both fill and stroke.
   */
  overprintMode?: OverprintMode;
}

export interface PDFPageDrawEllipseOptions extends SvgOptions {
  x?: number;
  y?: number;
  xScale?: number;
  yScale?: number;
  rotate?: Rotation;
  color?: PaintColor;
  opacity?: number;
  borderColor?: PaintColor;
  borderOpacity?: number;
  borderWidth?: number;
  borderDashArray?: number[];
  borderDashPhase?: number;
  borderLineCap?: LineCapStyle;
  blendMode?: BlendMode;
  /**
   * Overprint the fill drawn with `color` (`op`) instead of knocking out what lies beneath. When
   * any overprint option is given, the ones left out are written as false.
   * Needs PDF 1.3 or later.
   */
  overprint?: boolean;
  /**
   * Overprint the border (`OP`) instead of knocking out what lies beneath.
   * When any overprint option is given, the ones left out are written as
   * false. Needs PDF 1.3 or later.
   */
  borderOverprint?: boolean;
  /**
   * Overprint mode (`OPM`). With 1, overprinting a DeviceCMYK colour leaves
   * the plates of its zero components untouched, so `cmyk(0, 0, 0, 1)` over
   * a background prints black on top of it; with 0 every process plate is
   * painted and only spot plates survive. Default: 1 when an overprint
   * option is true, otherwise unchanged. The zero-component rule does not
   * apply to images. One mode covers both fill and stroke.
   */
  overprintMode?: OverprintMode;
}

export interface PDFPageDrawCircleOptions extends SvgOptions {
  x?: number;
  y?: number;
  size?: number;
  color?: PaintColor;
  opacity?: number;
  borderColor?: PaintColor;
  borderOpacity?: number;
  borderWidth?: number;
  borderDashArray?: number[];
  borderDashPhase?: number;
  borderLineCap?: LineCapStyle;
  blendMode?: BlendMode;
  /**
   * Overprint the fill drawn with `color` (`op`) instead of knocking out what lies beneath. When
   * any overprint option is given, the ones left out are written as false.
   * Needs PDF 1.3 or later.
   */
  overprint?: boolean;
  /**
   * Overprint the border (`OP`) instead of knocking out what lies beneath.
   * When any overprint option is given, the ones left out are written as
   * false. Needs PDF 1.3 or later.
   */
  borderOverprint?: boolean;
  /**
   * Overprint mode (`OPM`). With 1, overprinting a DeviceCMYK colour leaves
   * the plates of its zero components untouched, so `cmyk(0, 0, 0, 1)` over
   * a background prints black on top of it; with 0 every process plate is
   * painted and only spot plates survive. Default: 1 when an overprint
   * option is true, otherwise unchanged. The zero-component rule does not
   * apply to images. One mode covers both fill and stroke.
   */
  overprintMode?: OverprintMode;
}

export interface PDFPageDrawSVGElementOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fonts?: { [fontName: string]: PDFFont };
  blendMode?: BlendMode;
}

/**
 * Options for adding an annotation to a PDF page.
 */
export interface PDFPageAddAnnotationOptions {
  subtype: AnnotationTypes;
  rect: { x: number; y: number; width: number; height: number };
  contents?: string;
  name?: string;
  flags?: number;
  color?: number[];
  border?: number[];
  modificationDate?: Date;
}

/**
 * Options for adding a markup annotation to a PDF page.
 *
 * Markup annotations refers:
 * - Highlight
 * - Underline
 * - Squiggly
 * - StrikeOut
 * annotations.
 */
export interface PDFPageAddTextMarkupAnnotationOptions extends PDFPageAddAnnotationOptions {
  /**
   * The quad points that define the region(s) to be marked up.
   */
  quadPoints: {
    lefttopX: number;
    lefttopY: number;
    righttopX: number;
    righttopY: number;
    rightbottomX: number;
    rightbottomY: number;
    leftbottomX: number;
    leftbottomY: number;
  };
}

/**
 * Options for drawing a hyperlink on a PDF page.
 */
export interface PDFPageDrawLinkOptions {
  /** The URL to link to */
  url: string;
  /** The x-coordinate of the lower-left corner of the link rectangle */
  x: number;
  /** The y-coordinate of the lower-left corner of the link rectangle */
  y: number;
  /** The width of the link rectangle */
  width: number;
  /** The height of the link rectangle */
  height: number;
  /** The border width (default: 0, invisible) */
  borderWidth?: number;
  /** The border color (default: none) */
  borderColor?: Color;
}
