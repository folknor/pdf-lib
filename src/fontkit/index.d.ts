export as namespace fontkit;

/**
 * Represents a glyph bounding box
 */
export interface BoundingBox {
  minX: number /** The minimum X position in the bounding box */;
  minY: number /** The minimum Y position in the bounding box */;
  maxX: number /** The maxmimum X position in the bounding box */;
  maxY: number /** The maxmimum Y position in the bounding box */;
  width: number /** The width of the bounding box */;
  height: number /** The height of the bounding box */;
}

/**
 * Path objects are returned by glyphs and represent the actual vector outlines
 * for each glyph in the font. Paths can be converted to SVG path data strings,
 * or to functions that can be applied to render the path to a graphics context.
 */
export interface Path {
  /**
   * This property represents the path’s bounding box, i.e. the smallest
   * rectangle that contains the entire path shape. This is the exact
   * bounding box, taking into account control points that may be outside the
   * visible shape.
   */
  bbox: BoundingBox;

  /**
   * This property represents the path’s control box. It is like the
   * bounding box, but it includes all points of the path, including control
   * points of bezier segments. It is much faster to compute than the real
   * bounding box, but less accurate if there are control points outside of the
   * visible shape.
   */
  cbox: BoundingBox;

  /**
   * Moves the virtual pen to the given x, y coordinates.
   */
  moveTo(x: number, y: number): void;

  /**
   * Adds a line to the path from the current point to the
   * given x, y coordinates.
   */
  lineTo(x: number, y: number): void;

  /**
   * Adds a quadratic curve to the path from the current point to the
   * given x, y coordinates using cpx, cpy as a control point.
   */
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;

  /**
   * Adds a bezier curve to the path from the current point to the
   * given x, y coordinates using cp1x, cp1y and cp2x, cp2y as control points.
   */
  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ): void;

  /**
   * Closes the current sub-path by drawing a straight line back to the
   * starting point.
   */
  closePath(): void;

  /**
   * Compiles the path to a JavaScript function that can be applied with a
   * graphics context in order to render the path.
   */
  toFunction(): (...args: unknown[]) => unknown;

  /**
   * Converts the path to an SVG path data string.
   */
  toSVG(): string;
}

/**
 * Glyph objects represent a glyph in the font. They have various properties for
 * accessing metrics and the actual vector path the glyph represents, and
 * methods for rendering the glyph to a graphics context.
 *
 * You do not create glyph objects directly. They are created by various methods
 * on the Font object. There are several subclasses of the base Glyph class
 * internally that may be returned depending on the font format, but they all
 * include the following API.
 */
export interface Glyph {
  // Properties
  id: number /** The glyph's id in the font */;
  /**
   * An array of unicode code points that are represented by this glyph. There
   * can be multiple code points in the case of ligatures and other glyphs that
   * represent multiple visual characters.
   */
  codePoints: number[];
  path: Path /** Vector Path object representing the glyph */;
  /**
   * The Glyph’s bounding box, i.e. the rectangle that encloses the glyph
   * outline as tightly as possible.
   */
  bbox: BoundingBox;
  /**
   * The Glyph’s control box. This is often the same as the bounding box, but is
   * faster to compute. Because of the way bezier curves are defined, some of
   * the control points can be outside of the bounding box. Where bbox takes
   * this into account, cbox does not. Thus, cbox is less accurate, but faster
   * to compute.
   */
  cbox: BoundingBox;
  advanceWidth: number /** The Glyph's advance width */;

  // Methods
  /**
   * Renders the glyph to the given graphics context, at the specified
   * font size.
   */
  render(context: any, size: number): void;

  // Color Glyph Properties/Methods
  /**
   * For SBIX glyphs, which are bitmap based, this returns an object containing
   * some properties about the image, along with the image data itself
   * (usually PNG).
   */
  getImageForSize(size: number): Uint8Array;

  /**
   * For COLR glyphs, which are vector based, this returns an array of objects
   * representing the glyphs and colors for each layer in render order.
   */
  layers: any[];
}

/**
 * Represents positioning information for a glyph in a GlyphRun.
 */
export interface GlyphPosition {
  /**
   * The amount to move the virtual pen in the X direction after rendering
   * this glyph.
   */
  xAdvance: number;

  /**
   * The amount to move the virtual pen in the Y direction after rendering
   * this glyph.
   */
  yAdvance: number;

  /**
   * The offset from the pen position in the X direction at which to render
   * this glyph.
   */
  xOffset: number;

  /**
   * The offset from the pen position in the Y direction at which to render
   * this glyph.
   */
  yOffset: number;
}

/**
 * Represents a run of Glyph and GlyphPosition objects.
 * Returned by the Font.layout method.
 */
export interface GlyphRun {
  /**
   * An array of Glyph objects in the run
   */
  glyphs: Glyph[];

  /**
   * An array of GlyphPosition objects for each glyph in the run
   */
  positions: GlyphPosition[];

  /**
   * The script that was requested for shaping. This was either passed in or detected automatically.
   */
  script: string;

  /**
   * The language requested for shaping, as passed in. If `null`, the default language for the
   * script was used.
   */
  language: string | null;

  /**
   * The direction requested for shaping, as passed in (either ltr or rtl).
   * If `null`, the default direction of the script is used.
   */
  direction: 'ltr' | 'rtl' | null;

  /**
   * The features requested during shaping. This is a combination of user
   * specified features and features chosen by the shaper.
   */
  features: object;

  /**
   * The total advance width of the run.
   */
  advanceWidth: number;

  /**
   * The total advance height of the run.
   */
  advanceHeight: number;

  /**
   * The bounding box containing all glyphs in the run.
   */
  bbox: BoundingBox;
}

export interface SubsetStream {
  on: (
    eventType: 'data' | 'end',
    callback: (data: Uint8Array) => any,
  ) => SubsetStream;
}

export interface Subset {
  /**
   * Includes the given glyph object or glyph ID in the subset.
   * Returns the glyph's new ID in the subset.
   */
  includeGlyph(glyph: number | Glyph): number;

  /**
   * Returns a stream containing the encoded font file that can be piped to a
   * destination, such as a file.
   */
  encodeStream(): SubsetStream;
}

/**
 * `true`/`false` enable or disable a feature; a number N >= 2 also selects
 * the Nth alternate (1-based) where the feature reaches a GSUB alternate
 * substitution, as in HarfBuzz (`{ aalt: 2 }`, `{ salt: 3 }`). Other
 * non-zero numbers mean `true`, `0` means `false`. AAT fonts treat any
 * non-zero number as `true`.
 */
export type FeatureValue = boolean | number;

/**
 * A map of OpenType features as described in OpenType's spec:
 * https://docs.microsoft.com/en-gb/typography/opentype/spec/featurelist.
 */
export interface OpenTypeFeatures {
  aalt?: FeatureValue;
  abvf?: FeatureValue;
  abvm?: FeatureValue;
  abvs?: FeatureValue;
  afrc?: FeatureValue;
  akhn?: FeatureValue;
  blwf?: FeatureValue;
  blwm?: FeatureValue;
  blws?: FeatureValue;
  calt?: FeatureValue;
  case?: FeatureValue;
  ccmp?: FeatureValue;
  cfar?: FeatureValue;
  cjct?: FeatureValue;
  clig?: FeatureValue;
  cpct?: FeatureValue;
  cpsp?: FeatureValue;
  cswh?: FeatureValue;
  curs?: FeatureValue;
  cv01?: FeatureValue;
  cv02?: FeatureValue;
  cv03?: FeatureValue;
  cv04?: FeatureValue;
  cv05?: FeatureValue;
  cv06?: FeatureValue;
  cv07?: FeatureValue;
  cv08?: FeatureValue;
  cv09?: FeatureValue;
  cv10?: FeatureValue;
  cv11?: FeatureValue;
  cv22?: FeatureValue;
  cv23?: FeatureValue;
  cv24?: FeatureValue;
  cv25?: FeatureValue;
  cv26?: FeatureValue;
  cv27?: FeatureValue;
  cv28?: FeatureValue;
  cv29?: FeatureValue;
  cv30?: FeatureValue;
  cv31?: FeatureValue;
  cv32?: FeatureValue;
  cv33?: FeatureValue;
  cv34?: FeatureValue;
  cv35?: FeatureValue;
  cv36?: FeatureValue;
  cv37?: FeatureValue;
  cv38?: FeatureValue;
  cv39?: FeatureValue;
  cv40?: FeatureValue;
  cv41?: FeatureValue;
  cv42?: FeatureValue;
  cv43?: FeatureValue;
  cv44?: FeatureValue;
  cv45?: FeatureValue;
  cv46?: FeatureValue;
  cv47?: FeatureValue;
  cv48?: FeatureValue;
  cv49?: FeatureValue;
  cv50?: FeatureValue;
  cv51?: FeatureValue;
  cv52?: FeatureValue;
  cv53?: FeatureValue;
  cv54?: FeatureValue;
  cv55?: FeatureValue;
  cv56?: FeatureValue;
  cv57?: FeatureValue;
  cv58?: FeatureValue;
  cv59?: FeatureValue;
  cv60?: FeatureValue;
  cv61?: FeatureValue;
  cv62?: FeatureValue;
  cv63?: FeatureValue;
  cv64?: FeatureValue;
  cv65?: FeatureValue;
  cv66?: FeatureValue;
  cv67?: FeatureValue;
  cv68?: FeatureValue;
  cv69?: FeatureValue;
  cv70?: FeatureValue;
  cv71?: FeatureValue;
  cv72?: FeatureValue;
  cv73?: FeatureValue;
  cv74?: FeatureValue;
  cv75?: FeatureValue;
  cv76?: FeatureValue;
  cv77?: FeatureValue;
  cv78?: FeatureValue;
  cv79?: FeatureValue;
  cv80?: FeatureValue;
  cv81?: FeatureValue;
  cv82?: FeatureValue;
  cv83?: FeatureValue;
  cv84?: FeatureValue;
  cv85?: FeatureValue;
  cv86?: FeatureValue;
  cv87?: FeatureValue;
  cv88?: FeatureValue;
  cv89?: FeatureValue;
  cv90?: FeatureValue;
  cv91?: FeatureValue;
  cv92?: FeatureValue;
  cv93?: FeatureValue;
  cv94?: FeatureValue;
  cv95?: FeatureValue;
  cv96?: FeatureValue;
  cv97?: FeatureValue;
  cv98?: FeatureValue;
  cv99?: FeatureValue;
  c2pc?: FeatureValue;
  c2sc?: FeatureValue;
  dist?: FeatureValue;
  dlig?: FeatureValue;
  dnom?: FeatureValue;
  dtls?: FeatureValue;
  expt?: FeatureValue;
  falt?: FeatureValue;
  fin2?: FeatureValue;
  fin3?: FeatureValue;
  fina?: FeatureValue;
  flac?: FeatureValue;
  frac?: FeatureValue;
  fwid?: FeatureValue;
  half?: FeatureValue;
  haln?: FeatureValue;
  halt?: FeatureValue;
  hist?: FeatureValue;
  hkna?: FeatureValue;
  hlig?: FeatureValue;
  hngl?: FeatureValue;
  hojo?: FeatureValue;
  hwid?: FeatureValue;
  init?: FeatureValue;
  isol?: FeatureValue;
  ital?: FeatureValue;
  jalt?: FeatureValue;
  jp78?: FeatureValue;
  jp83?: FeatureValue;
  jp90?: FeatureValue;
  jp04?: FeatureValue;
  kern?: FeatureValue;
  lfbd?: FeatureValue;
  liga?: FeatureValue;
  ljmo?: FeatureValue;
  lnum?: FeatureValue;
  locl?: FeatureValue;
  ltra?: FeatureValue;
  ltrm?: FeatureValue;
  mark?: FeatureValue;
  med2?: FeatureValue;
  medi?: FeatureValue;
  mgrk?: FeatureValue;
  mkmk?: FeatureValue;
  mset?: FeatureValue;
  nalt?: FeatureValue;
  nlck?: FeatureValue;
  nukt?: FeatureValue;
  numr?: FeatureValue;
  onum?: FeatureValue;
  opbd?: FeatureValue;
  ordn?: FeatureValue;
  ornm?: FeatureValue;
  palt?: FeatureValue;
  pcap?: FeatureValue;
  pkna?: FeatureValue;
  pnum?: FeatureValue;
  pref?: FeatureValue;
  pres?: FeatureValue;
  pstf?: FeatureValue;
  psts?: FeatureValue;
  pwid?: FeatureValue;
  qwid?: FeatureValue;
  rand?: FeatureValue;
  rclt?: FeatureValue;
  rkrf?: FeatureValue;
  rlig?: FeatureValue;
  rphf?: FeatureValue;
  rtbd?: FeatureValue;
  rtla?: FeatureValue;
  rtlm?: FeatureValue;
  ruby?: FeatureValue;
  rvrn?: FeatureValue;
  salt?: FeatureValue;
  sinf?: FeatureValue;
  size?: FeatureValue;
  smcp?: FeatureValue;
  smpl?: FeatureValue;
  ss01?: FeatureValue;
  ss02?: FeatureValue;
  ss03?: FeatureValue;
  ss04?: FeatureValue;
  ss05?: FeatureValue;
  ss06?: FeatureValue;
  ss07?: FeatureValue;
  ss08?: FeatureValue;
  ss09?: FeatureValue;
  ss10?: FeatureValue;
  ss11?: FeatureValue;
  ss12?: FeatureValue;
  ss13?: FeatureValue;
  ss14?: FeatureValue;
  ss15?: FeatureValue;
  ss16?: FeatureValue;
  ss17?: FeatureValue;
  ss18?: FeatureValue;
  ss19?: FeatureValue;
  ss20?: FeatureValue;
  ssty?: FeatureValue;
  stch?: FeatureValue;
  subs?: FeatureValue;
  sups?: FeatureValue;
  swsh?: FeatureValue;
  titl?: FeatureValue;
  tjmo?: FeatureValue;
  tnam?: FeatureValue;
  tnum?: FeatureValue;
  trad?: FeatureValue;
  twid?: FeatureValue;
  unic?: FeatureValue;
  valt?: FeatureValue;
  vatu?: FeatureValue;
  vert?: FeatureValue;
  vhal?: FeatureValue;
  vjmo?: FeatureValue;
  vkna?: FeatureValue;
  vkrn?: FeatureValue;
  vpal?: FeatureValue;
  vrt2?: FeatureValue;
  vrtr?: FeatureValue;
  zero?: FeatureValue;
}
/**
 * A map of Apple Advanced Typography (AAT) as decribed by Apple’s TrueType
 * Reference manual:
 * https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6AATIntro.html
 */
export interface AATFeatures {
  acnt?: boolean;
  ankr?: boolean;
  avar?: boolean;
  bdat?: boolean;
  bhed?: boolean;
  bloc?: boolean;
  bsln?: boolean;
  cmap?: boolean;
  cvar?: boolean;
  cvt?: boolean;
  EBSC?: boolean;
  fdsc?: boolean;
  feat?: boolean;
  fmtx?: boolean;
  fond?: boolean;
  fpgm?: boolean;
  fvar?: boolean;
  gasp?: boolean;
  gcid?: boolean;
  glyf?: boolean;
  gvar?: boolean;
  hdmx?: boolean;
  head?: boolean;
  hhea?: boolean;
  hmtx?: boolean;
  just?: boolean;
  kern?: FeatureValue; // shared with OpenTypeFeatures, so same type
  kerx?: boolean;
  lcar?: boolean;
  loca?: boolean;
  ltag?: boolean;
  maxp?: boolean;
  meta?: boolean;
  mort?: boolean;
  morx?: boolean;
  name?: boolean;
  opbd?: FeatureValue; // shared with OpenTypeFeatures, so same type
  'OS/2'?: boolean;
  post?: boolean;
  prep?: boolean;
  prop?: boolean;
  sbix?: boolean;
  trak?: boolean;
  vhea?: boolean;
  vmtx?: boolean;
  xref?: boolean;
  Zapf?: boolean;
}

/**
 * The features is an object mapping OpenType features to a FeatureValue
 * enabling or disabling each (and optionally choosing an alternate). If this
 * is an AAT font, the OpenType feature tags are mapped to AAT features.
 */
export interface TypeFeatures extends OpenTypeFeatures, AATFeatures {
  [key: string]: FeatureValue;
}

/**
 * There are several different types of font objects that are returned by
 * fontkit depending on the font format. They all inherit from the TTFFont class
 * and have the same public API.
 */
export interface Font {
  // Metadata properties
  postscriptName: string | null;
  fullName: string | null;
  familyName: string | null;
  subfamilyName: string | null;
  copyright: string | null;
  version: string | null;

  // Metrics properties
  unitsPerEm: number /** Size of the font’s internal coordinate grid */;
  ascent: number /** The font’s ascender */;
  descent: number /** The font’s descender */;
  lineGap: number /** Amount of space that should be included between lines */;
  underlinePosition: number /** Offset from the normal underline position that should be used */;
  underlineThickness: number /** Weight of the underline that should be used */;
  italicAngle: number /** If this is an italic font, the angle the cursor should be drawn at to match the font design */;
  capHeight: number /** Height of capital letters above the baseline. */;
  xHeight: number /** Height of lower case letters. */;
  bbox: BoundingBox /** Font’s bounding box, i.e. the box that encloses all glyphs in the font */;

  // Other properties
  numGlyphs: number /** Number of glyphs in the font */;
  characterSet: number[] /** Array of all of the unicode code points supported by the font */;
  availableFeatures: (keyof TypeFeatures)[] /** OpenType feature tags (or mapped AAT tags) supported by the font */;
  cff: any;
  'OS/2': { sFamilyClass: number };
  head: { macStyle: { italic: boolean } };
  post: { isFixedPitch: boolean };

  // Character to Glyph Mapping Methods

  /**
   * Maps a single unicode code point (number) to a Glyph object.
   * Does not perform any advanced substitutions (there is no context to do so).
   */
  glyphForCodePoint(codePoint: number): Glyph;

  /**
   * Returns whether there is glyph in the font for the given
   * unicode code point.
   */
  hasGlyphForCodePoint(codePoint: number): boolean;

  /**
   * This method returns an array of Glyph objects for the given string.
   * This is only a one-to-one mapping from characters to glyphs. For most uses,
   * you should use Font.layout, which provides a much more advanced mapping
   * supporting AAT and OpenType shaping.
   */
  glyphsForString(string: string): Glyph[];

  // Glyph Metrics and Layout Methods

  /**
   * Returns the advance width (described above) for a single glyph id.
   */
  widthOfGlyph(glyphId: number): number;

  /**
   * This method returns a GlyphRun object, which includes an array of Glyphs
   * and GlyphPositions for the given string. Glyph objects are described below.
   * GlyphPosition objects include 4 properties: xAdvance, yAdvance, xOffset,
   * and yOffset.
   *
   * The features parameter is an array of OpenType feature tags to be applied
   * in addition to the default set. If this is an AAT font, the OpenType
   * feature tags are mapped to AAT features.
   */
  layout(
    string: string,
    features?: TypeFeatures | (keyof TypeFeatures)[],
  ): GlyphRun;

  // Other Methods

  /**
   * Returns a glyph object for the given glyph id. You can pass the array of
   * code points this glyph represents for your use later, and it will be
   * stored in the glyph object.
   */
  getGlyph(glyphId: number, codePoints?: number[]): Glyph;

  /**
   * Returns a Subset object for this font.
   */
  createSubset(): Subset;
}

export function create(buffer: Uint8Array, postscriptName?: string): Font;
