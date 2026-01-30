/**
 * Represents positioning information for a glyph in a GlyphRun.
 */
export default class GlyphPosition {
    /**
     * The amount to move the virtual pen in the X direction after rendering this glyph.
     */
    xAdvance;
    /**
     * The amount to move the virtual pen in the Y direction after rendering this glyph.
     */
    yAdvance;
    /**
     * The offset from the pen position in the X direction at which to render this glyph.
     */
    xOffset;
    /**
     * The offset from the pen position in the Y direction at which to render this glyph.
     */
    yOffset;
    constructor(xAdvance = 0, yAdvance = 0, xOffset = 0, yOffset = 0) {
        this.xAdvance = xAdvance;
        this.yAdvance = yAdvance;
        this.xOffset = xOffset;
        this.yOffset = yOffset;
    }
}
//# sourceMappingURL=GlyphPosition.js.map