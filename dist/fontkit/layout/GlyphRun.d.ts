import BBox from '../glyph/BBox.js';
import type Glyph from '../glyph/Glyph.js';
import type GlyphPosition from './GlyphPosition.js';
/**
 * Represents a run of Glyph and GlyphPosition objects.
 * Returned by the font layout method.
 */
export default class GlyphRun {
    /**
     * An array of Glyph objects in the run
     */
    glyphs: Glyph[];
    /**
     * An array of GlyphPosition objects for each glyph in the run
     */
    positions: GlyphPosition[] | null;
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
    direction: string;
    /**
     * The features requested during shaping. This is a combination of user
     * specified features and features chosen by the shaper.
     */
    features: Record<string, boolean>;
    constructor(glyphs: Glyph[], features: string[] | Record<string, boolean>, script: string, language: string | null, direction: string | null);
    /**
     * The total advance width of the run.
     */
    get advanceWidth(): number;
    /**
     * The total advance height of the run.
     */
    get advanceHeight(): number;
    /**
     * The bounding box containing all glyphs in the run.
     */
    get bbox(): BBox;
}
//# sourceMappingURL=GlyphRun.d.ts.map