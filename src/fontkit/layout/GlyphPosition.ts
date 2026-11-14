/**
 * Represents positioning information for a glyph in a GlyphRun.
 */
export default class GlyphPosition {
  /**
   * The amount to move the virtual pen in the X direction after rendering this glyph.
   */
  xAdvance: number;

  /**
   * The amount to move the virtual pen in the Y direction after rendering this glyph.
   */
  yAdvance: number;

  /**
   * The offset from the pen position in the X direction at which to render this glyph.
   */
  xOffset: number;

  /**
   * The offset from the pen position in the Y direction at which to render this glyph.
   */
  yOffset: number;

  /**
   * Index in the run of the glyph this one is attached to by GPOS mark
   * positioning (its offsets are relative to that glyph's placement), or null.
   * Only the OpenType engine sets it.
   */
  attachedTo: number | null = null;

  /** True when the font classifies this glyph as a mark (OpenType engine only). */
  isMark = false;

  /** True when this glyph stands for a hidden default-ignorable character. */
  hidden = false;

  constructor(
    xAdvance: number = 0,
    yAdvance: number = 0,
    xOffset: number = 0,
    yOffset: number = 0,
  ) {
    this.xAdvance = xAdvance;
    this.yAdvance = yAdvance;
    this.xOffset = xOffset;
    this.yOffset = yOffset;
  }
}
