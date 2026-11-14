import {
  type EncodedText,
  PDFOperatorNames as Ops,
  PDFHexString,
  type PDFName,
  type PDFNumber,
  PDFOperator,
} from "../core/index.js";
import { numberToString } from "../utils/index.js";
import { asNumber, asPDFName, asPDFNumber } from "./objects.js";
import { degreesToRadians } from "./rotations.js";

/* ==================== Clipping Path Operators ==================== */

export const clip = () => PDFOperator.of(Ops.ClipNonZero);
export const clipEvenOdd = () => PDFOperator.of(Ops.ClipEvenOdd);

/* ==================== Graphics State Operators ==================== */

const { cos, sin, tan } = Math;

export const concatTransformationMatrix = (
  a: number | PDFNumber,
  b: number | PDFNumber,
  c: number | PDFNumber,
  d: number | PDFNumber,
  e: number | PDFNumber,
  f: number | PDFNumber,
) =>
  PDFOperator.of(Ops.ConcatTransformationMatrix, [
    asPDFNumber(a),
    asPDFNumber(b),
    asPDFNumber(c),
    asPDFNumber(d),
    asPDFNumber(e),
    asPDFNumber(f),
  ]);

export const translate = (xPos: number | PDFNumber, yPos: number | PDFNumber) =>
  concatTransformationMatrix(1, 0, 0, 1, xPos, yPos);

export const scale = (xPos: number | PDFNumber, yPos: number | PDFNumber) =>
  concatTransformationMatrix(xPos, 0, 0, yPos, 0, 0);

export const rotateRadians = (angle: number | PDFNumber) =>
  concatTransformationMatrix(
    cos(asNumber(angle)),
    sin(asNumber(angle)),
    -sin(asNumber(angle)),
    cos(asNumber(angle)),
    0,
    0,
  );

export const rotateDegrees = (angle: number | PDFNumber) =>
  rotateRadians(degreesToRadians(asNumber(angle)));

export const skewRadians = (xSkewAngle: number | PDFNumber, ySkewAngle: number | PDFNumber) =>
  concatTransformationMatrix(1, tan(asNumber(xSkewAngle)), tan(asNumber(ySkewAngle)), 1, 0, 0);

export const skewDegrees = (xSkewAngle: number | PDFNumber, ySkewAngle: number | PDFNumber) =>
  skewRadians(degreesToRadians(asNumber(xSkewAngle)), degreesToRadians(asNumber(ySkewAngle)));

export const setDashPattern = (dashArray: (number | PDFNumber)[], dashPhase: number | PDFNumber) =>
  PDFOperator.of(Ops.SetLineDashPattern, [
    `[${dashArray.map(asPDFNumber).join(" ")}]`,
    asPDFNumber(dashPhase),
  ]);

export const restoreDashPattern = () => setDashPattern([], 0);

export enum LineCapStyle {
  Butt = 0,
  Round = 1,
  Projecting = 2,
}

export const setLineCap = (style: LineCapStyle) =>
  PDFOperator.of(Ops.SetLineCapStyle, [asPDFNumber(style)]);

export enum LineJoinStyle {
  Miter = 0,
  Round = 1,
  Bevel = 2,
}

export const setLineJoin = (style: LineJoinStyle) =>
  PDFOperator.of(Ops.SetLineJoinStyle, [asPDFNumber(style)]);

export const setGraphicsState = (state: string | PDFName) =>
  PDFOperator.of(Ops.SetGraphicsStateParams, [asPDFName(state)]);

export const pushGraphicsState = () => PDFOperator.of(Ops.PushGraphicsState);

export const popGraphicsState = () => PDFOperator.of(Ops.PopGraphicsState);

export const setLineWidth = (width: number | PDFNumber) =>
  PDFOperator.of(Ops.SetLineWidth, [asPDFNumber(width)]);

/* ==================== Path Construction Operators ==================== */

export const appendBezierCurve = (
  x1: number | PDFNumber,
  y1: number | PDFNumber,
  x2: number | PDFNumber,
  y2: number | PDFNumber,
  x3: number | PDFNumber,
  y3: number | PDFNumber,
) =>
  PDFOperator.of(Ops.AppendBezierCurve, [
    asPDFNumber(x1),
    asPDFNumber(y1),
    asPDFNumber(x2),
    asPDFNumber(y2),
    asPDFNumber(x3),
    asPDFNumber(y3),
  ]);

export const appendQuadraticCurve = (
  x1: number | PDFNumber,
  y1: number | PDFNumber,
  x2: number | PDFNumber,
  y2: number | PDFNumber,
) =>
  PDFOperator.of(Ops.CurveToReplicateInitialPoint, [
    asPDFNumber(x1),
    asPDFNumber(y1),
    asPDFNumber(x2),
    asPDFNumber(y2),
  ]);

export const closePath = () => PDFOperator.of(Ops.ClosePath);

export const moveTo = (xPos: number | PDFNumber, yPos: number | PDFNumber) =>
  PDFOperator.of(Ops.MoveTo, [asPDFNumber(xPos), asPDFNumber(yPos)]);

export const lineTo = (xPos: number | PDFNumber, yPos: number | PDFNumber) =>
  PDFOperator.of(Ops.LineTo, [asPDFNumber(xPos), asPDFNumber(yPos)]);

/**
 * @param xPos x coordinate for the lower left corner of the rectangle
 * @param yPos y coordinate for the lower left corner of the rectangle
 * @param width width of the rectangle
 * @param height height of the rectangle
 */
export const rectangle = (
  xPos: number | PDFNumber,
  yPos: number | PDFNumber,
  width: number | PDFNumber,
  height: number | PDFNumber,
) =>
  PDFOperator.of(Ops.AppendRectangle, [
    asPDFNumber(xPos),
    asPDFNumber(yPos),
    asPDFNumber(width),
    asPDFNumber(height),
  ]);

/**
 * @param xPos x coordinate for the lower left corner of the square
 * @param yPos y coordinate for the lower left corner of the square
 * @param size width and height of the square
 */
export const square = (xPos: number, yPos: number, size: number) =>
  rectangle(xPos, yPos, size, size);

/* ==================== Path Painting Operators ==================== */

export const stroke = () => PDFOperator.of(Ops.StrokePath);

export enum FillRule {
  NonZero = "f",
  EvenOdd = "f*",
}

export const fill = () => PDFOperator.of(Ops.FillNonZero);

export const fillEvenOdd = () => PDFOperator.of(Ops.FillEvenOdd);

export const fillAndStroke = () => PDFOperator.of(Ops.FillNonZeroAndStroke);

export const endPath = () => PDFOperator.of(Ops.EndPath);

/* ==================== Text Positioning Operators ==================== */

export const nextLine = () => PDFOperator.of(Ops.NextLine);

export const moveText = (x: number | PDFNumber, y: number | PDFNumber) =>
  PDFOperator.of(Ops.MoveText, [asPDFNumber(x), asPDFNumber(y)]);

/* ==================== Text Showing Operators ==================== */

export const showText = (text: PDFHexString) => PDFOperator.of(Ops.ShowText, [text]);

/** `TJ` with an already serialised array, e.g. `[<0041> -80 <0056>]`. */
const showTextAdjusted = (array: string) => PDFOperator.of(Ops.ShowTextAdjusted, [array]);

// Four decimals of a thousandth of an em: far below a device pixel, and it
// keeps float noise (1e-13) out of the content stream.
const roundPosition = (value: number) => {
  const rounded = Math.round(value * 10000) / 10000;

  return rounded === 0 ? 0 : rounded;
};

/**
 * Shows encoded text from the current text position, drawing every glyph
 * where the font's layout placed it and leaving the pen at the end of its
 * measured advance (plus any `Tc`/`Tw` in effect, which the library's own
 * drawing never sets: its spacing is in the advances).
 *
 * Text that needs no positioning is a single `Tj`. Otherwise horizontal
 * placement is written as `TJ` adjustments, which are in thousandths of an em
 * and so hold at any font size and horizontal scaling: before a glyph drawn
 * `xOffset` from the pen, `-xOffset`; after it, whatever brings the pen from
 * where its PDF width left it to its advance. Glyphs drawn above or below the
 * baseline change the text rise (`Ts`, in unscaled text space units) around
 * them, which is why the font size is needed, and set it back to `rise`
 * after them. `rise` must therefore be the text rise in effect when this is
 * shown; callers that do not know it set it first.
 *
 * Glyph ranges with `actualText` are wrapped in `/Span <</ActualText ..>>
 * BDC ... EMC`, which nests inside the caller's `BT ... ET` (and any marked
 * content around it).
 */
export const showEncodedText = (
  text: EncodedText,
  fontSize: number | PDFNumber,
  rise: number | PDFNumber = 0,
): PDFOperator[] => {
  const spans = text.actualText;

  if (spans.length === 0 && text.isUnpositioned()) {
    return [showText(text.toHexString())];
  }

  const size = asNumber(fontSize);
  const baseRise = asNumber(rise);
  const operators: PDFOperator[] = [];
  let parts: string[] = [];
  let pendingCodes = "";
  let pendingAdjust = 0;
  let currentRise = roundPosition(baseRise);

  const flushCodes = () => {
    if (pendingCodes !== "") parts.push(`<${pendingCodes}>`);
    pendingCodes = "";
  };

  const flushAdjust = () => {
    const adjust = roundPosition(pendingAdjust);

    if (adjust !== 0) {
      flushCodes();
      parts.push(numberToString(adjust));
    }

    pendingAdjust = 0;
  };

  const flushArray = () => {
    flushAdjust();
    flushCodes();

    if (parts.length > 0) {
      operators.push(showTextAdjusted(`[${parts.join(" ")}]`));
    }

    parts = [];
  };

  // Each /ActualText span holds exactly its glyphs: the shows are split at
  // its edges, with the adjustment after its last glyph inside it.
  let span = 0;

  for (let idx = 0, len = text.codes.length; idx < len; idx++) {
    if (spans[span] !== undefined && spans[span]!.start === idx) {
      flushArray();
      operators.push(beginActualText(spans[span]!.text));
    }

    const xOffset = text.xOffsets[idx]!;

    const glyphRise = roundPosition(baseRise + (text.yOffsets[idx]! * size) / 1000);

    if (glyphRise !== currentRise) {
      flushArray();
      operators.push(setTextRise(glyphRise));
      currentRise = glyphRise;
    }

    // A TJ number n moves the pen by -n/1000 em.
    pendingAdjust -= xOffset;
    flushAdjust();
    pendingCodes += text.codes[idx]!;
    pendingAdjust += text.widths[idx]! + xOffset - text.advances[idx]!;

    if (spans[span] !== undefined && spans[span]!.end === idx + 1) {
      flushArray();
      operators.push(endMarkedContent());
      span++;
    }
  }

  flushArray();

  if (currentRise !== roundPosition(baseRise)) {
    operators.push(setTextRise(baseRise));
  }

  return operators;
};

/* ==================== Text State Operators ==================== */

export const beginText = () => PDFOperator.of(Ops.BeginText);
export const endText = () => PDFOperator.of(Ops.EndText);

export const setFontAndSize = (name: string | PDFName, size: number | PDFNumber) =>
  PDFOperator.of(Ops.SetFontAndSize, [asPDFName(name), asPDFNumber(size)]);

export const setCharacterSpacing = (spacing: number | PDFNumber) =>
  PDFOperator.of(Ops.SetCharacterSpacing, [asPDFNumber(spacing)]);

export const setWordSpacing = (spacing: number | PDFNumber) =>
  PDFOperator.of(Ops.SetWordSpacing, [asPDFNumber(spacing)]);

/** @param squeeze horizontal scaling (`Tz`), percent of normal width */
export const setCharacterSqueeze = (squeeze: number | PDFNumber) =>
  PDFOperator.of(Ops.SetTextHorizontalScaling, [asPDFNumber(squeeze)]);

export const setLineHeight = (lineHeight: number | PDFNumber) =>
  PDFOperator.of(Ops.SetTextLineHeight, [asPDFNumber(lineHeight)]);

export const setTextRise = (rise: number | PDFNumber) =>
  PDFOperator.of(Ops.SetTextRise, [asPDFNumber(rise)]);

export enum TextRenderingMode {
  Fill = 0,
  Outline = 1,
  FillAndOutline = 2,
  Invisible = 3,
  FillAndClip = 4,
  OutlineAndClip = 5,
  FillAndOutlineAndClip = 6,
  Clip = 7,
}

export const setTextRenderingMode = (mode: TextRenderingMode) =>
  PDFOperator.of(Ops.SetTextRenderingMode, [asPDFNumber(mode)]);

export const setTextMatrix = (
  a: number | PDFNumber,
  b: number | PDFNumber,
  c: number | PDFNumber,
  d: number | PDFNumber,
  e: number | PDFNumber,
  f: number | PDFNumber,
) =>
  PDFOperator.of(Ops.SetTextMatrix, [
    asPDFNumber(a),
    asPDFNumber(b),
    asPDFNumber(c),
    asPDFNumber(d),
    asPDFNumber(e),
    asPDFNumber(f),
  ]);

export const rotateAndSkewTextRadiansAndTranslate = (
  rotationAngle: number | PDFNumber,
  xSkewAngle: number | PDFNumber,
  ySkewAngle: number | PDFNumber,
  x: number | PDFNumber,
  y: number | PDFNumber,
) =>
  setTextMatrix(
    cos(asNumber(rotationAngle)),
    sin(asNumber(rotationAngle)) + tan(asNumber(xSkewAngle)),
    -sin(asNumber(rotationAngle)) + tan(asNumber(ySkewAngle)),
    cos(asNumber(rotationAngle)),
    x,
    y,
  );

export const rotateAndSkewTextDegreesAndTranslate = (
  rotationAngle: number | PDFNumber,
  xSkewAngle: number | PDFNumber,
  ySkewAngle: number | PDFNumber,
  x: number | PDFNumber,
  y: number | PDFNumber,
) =>
  rotateAndSkewTextRadiansAndTranslate(
    degreesToRadians(asNumber(rotationAngle)),
    degreesToRadians(asNumber(xSkewAngle)),
    degreesToRadians(asNumber(ySkewAngle)),
    x,
    y,
  );

/* ==================== XObject Operator ==================== */

export const drawObject = (name: string | PDFName) =>
  PDFOperator.of(Ops.DrawObject, [asPDFName(name)]);

/* ==================== Color Operators ==================== */

export const setFillingGrayscaleColor = (gray: number | PDFNumber) =>
  PDFOperator.of(Ops.NonStrokingColorGray, [asPDFNumber(gray)]);

export const setStrokingGrayscaleColor = (gray: number | PDFNumber) =>
  PDFOperator.of(Ops.StrokingColorGray, [asPDFNumber(gray)]);

export const setFillingRgbColor = (
  red: number | PDFNumber,
  green: number | PDFNumber,
  blue: number | PDFNumber,
) =>
  PDFOperator.of(Ops.NonStrokingColorRgb, [
    asPDFNumber(red),
    asPDFNumber(green),
    asPDFNumber(blue),
  ]);

export const setStrokingRgbColor = (
  red: number | PDFNumber,
  green: number | PDFNumber,
  blue: number | PDFNumber,
) =>
  PDFOperator.of(Ops.StrokingColorRgb, [asPDFNumber(red), asPDFNumber(green), asPDFNumber(blue)]);

export const setFillingCmykColor = (
  cyan: number | PDFNumber,
  magenta: number | PDFNumber,
  yellow: number | PDFNumber,
  key: number | PDFNumber,
) =>
  PDFOperator.of(Ops.NonStrokingColorCmyk, [
    asPDFNumber(cyan),
    asPDFNumber(magenta),
    asPDFNumber(yellow),
    asPDFNumber(key),
  ]);

export const setStrokingCmykColor = (
  cyan: number | PDFNumber,
  magenta: number | PDFNumber,
  yellow: number | PDFNumber,
  key: number | PDFNumber,
) =>
  PDFOperator.of(Ops.StrokingColorCmyk, [
    asPDFNumber(cyan),
    asPDFNumber(magenta),
    asPDFNumber(yellow),
    asPDFNumber(key),
  ]);

/** `cs`: select the non-stroking colour space named in the resources. */
export const setFillingColorSpace = (name: string | PDFName) =>
  PDFOperator.of(Ops.NonStrokingColorspace, [asPDFName(name)]);

/** `CS`: select the stroking colour space named in the resources. */
export const setStrokingColorSpace = (name: string | PDFName) =>
  PDFOperator.of(Ops.StrokingColorspace, [asPDFName(name)]);

/** `scn`: set the non-stroking colour components in the current space. */
export const setFillingColorComponents = (...components: (number | PDFNumber)[]) =>
  PDFOperator.of(Ops.NonStrokingColorN, components.map(asPDFNumber));

/** `SCN`: set the stroking colour components in the current space. */
export const setStrokingColorComponents = (...components: (number | PDFNumber)[]) =>
  PDFOperator.of(Ops.StrokingColorN, components.map(asPDFNumber));

/* ==================== Marked Content Operators ==================== */

export const beginMarkedContent = (tag: string | PDFName) =>
  PDFOperator.of(Ops.BeginMarkedContent, [asPDFName(tag)]);

export const endMarkedContent = () => PDFOperator.of(Ops.EndMarkedContent);

/**
 * `/Span <</ActualText ...>> BDC`: what follows, up to the matching `EMC`,
 * extracts as `text` (ISO 32000-1 14.9.4), written as a UTF-16BE text
 * string.
 */
export const beginActualText = (text: string) =>
  PDFOperator.of(Ops.BeginMarkedContentSequence, [
    asPDFName("Span"),
    `<</ActualText ${PDFHexString.fromText(text).toString()}>>`,
  ]);
