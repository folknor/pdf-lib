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
    constructor(xAdvance?: number, yAdvance?: number, xOffset?: number, yOffset?: number);
}
//# sourceMappingURL=GlyphPosition.d.ts.map