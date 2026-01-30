import * as r from '../vendors/restructure/index.js';
import CmapProcessor from './CmapProcessor.js';
import BBox from './glyph/BBox.js';
import type Glyph from './glyph/Glyph.js';
import GlyphVariationProcessor from './glyph/GlyphVariationProcessor.js';
import type GlyphRun from './layout/GlyphRun.js';
import LayoutEngine from './layout/LayoutEngine.js';
import type Subset from './subset/Subset.js';
/**
 * This is the base class for all SFNT-based font formats in fontkit.
 * It supports TrueType, and PostScript glyphs, and several color glyph formats.
 */
export default class TTFFont {
    type: string;
    defaultLanguage: string | null;
    stream: r.DecodeStream;
    variationCoords: number[] | null;
    directory: any;
    _directoryPos: number;
    _tables: Record<string, any>;
    _glyphs: Record<number, Glyph>;
    [key: string]: any;
    static probe(buffer: Uint8Array): boolean;
    constructor(stream: r.DecodeStream, variationCoords?: number[] | null);
    setDefaultLanguage(lang?: string | null): void;
    _getTable(table: any): any;
    _getTableStream(tag: string): r.DecodeStream | null;
    _decodeDirectory(): any;
    _decodeTable(table: any): any;
    /**
     * Gets a string from the font's `name` table
     * `lang` is a BCP-47 language code.
     * @return {string}
     */
    getName(key: string, lang?: string): string | null;
    /**
     * The unique PostScript name for this font, e.g. "Helvetica-Bold"
     * @type {string}
     */
    get postscriptName(): string | null;
    /**
     * The font's full name, e.g. "Helvetica Bold"
     * @type {string}
     */
    get fullName(): string | null;
    /**
     * The font's family name, e.g. "Helvetica"
     * @type {string}
     */
    get familyName(): string | null;
    /**
     * The font's sub-family, e.g. "Bold".
     * @type {string}
     */
    get subfamilyName(): string | null;
    /**
     * The font's copyright information
     * @type {string}
     */
    get copyright(): string | null;
    /**
     * The font's version number
     * @type {string}
     */
    get version(): string | null;
    /**
     * The font’s [ascender](https://en.wikipedia.org/wiki/Ascender_(typography))
     * @type {number}
     */
    get ascent(): any;
    /**
     * The font’s [descender](https://en.wikipedia.org/wiki/Descender)
     * @type {number}
     */
    get descent(): any;
    /**
     * The amount of space that should be included between lines
     * @type {number}
     */
    get lineGap(): any;
    /**
     * The offset from the normal underline position that should be used
     * @type {number}
     */
    get underlinePosition(): any;
    /**
     * The weight of the underline that should be used
     * @type {number}
     */
    get underlineThickness(): any;
    /**
     * If this is an italic font, the angle the cursor should be drawn at to match the font design
     * @type {number}
     */
    get italicAngle(): any;
    /**
     * The height of capital letters above the baseline.
     * See [here](https://en.wikipedia.org/wiki/Cap_height) for more details.
     * @type {number}
     */
    get capHeight(): any;
    /**
     * The height of lower case letters in the font.
     * See [here](https://en.wikipedia.org/wiki/X-height) for more details.
     * @type {number}
     */
    get xHeight(): any;
    /**
     * The number of glyphs in the font.
     * @type {number}
     */
    get numGlyphs(): any;
    /**
     * The size of the font’s internal coordinate grid
     * @type {number}
     */
    get unitsPerEm(): any;
    /**
     * The font’s bounding box, i.e. the box that encloses all glyphs in the font.
     * @type {BBox}
     */
    get bbox(): Readonly<BBox>;
    get _cmapProcessor(): CmapProcessor;
    /**
     * An array of all of the unicode code points supported by the font.
     * @type {number[]}
     */
    get characterSet(): number[];
    /**
     * Returns whether there is glyph in the font for the given unicode code point.
     *
     * @param {number} codePoint
     * @return {boolean}
     */
    hasGlyphForCodePoint(codePoint: number): boolean;
    /**
     * Maps a single unicode code point to a Glyph object.
     * Does not perform any advanced substitutions (there is no context to do so).
     *
     * @param {number} codePoint
     * @return {Glyph}
     */
    glyphForCodePoint(codePoint: number): Glyph | null;
    /**
     * Returns an array of Glyph objects for the given string.
     * This is only a one-to-one mapping from characters to glyphs.
     * For most uses, you should use font.layout (described below), which
     * provides a much more advanced mapping supporting AAT and OpenType shaping.
     *
     * @param {string} string
     * @return {Glyph[]}
     */
    glyphsForString(string: string): Glyph[];
    get _layoutEngine(): LayoutEngine;
    /**
     * Returns a GlyphRun object, which includes an array of Glyphs and GlyphPositions for the given string.
     *
     * @param {string} string
     * @param {string[]} [userFeatures]
     * @param {string} [script]
     * @param {string} [language]
     * @param {string} [direction]
     * @return {GlyphRun}
     */
    layout(string: string, userFeatures?: string[] | Record<string, boolean>, script?: string, language?: string, direction?: string): GlyphRun;
    /**
     * Returns an array of strings that map to the given glyph id.
     * @param {number} gid - glyph id
     */
    stringsForGlyph(gid: number): Set<string>;
    /**
     * An array of all [OpenType feature tags](https://www.microsoft.com/typography/otspec/featuretags.htm)
     * (or mapped AAT tags) supported by the font.
     * The features parameter is an array of OpenType feature tags to be applied in addition to the default set.
     * If this is an AAT font, the OpenType feature tags are mapped to AAT features.
     *
     * @type {string[]}
     */
    get availableFeatures(): string[];
    getAvailableFeatures(script?: string, language?: string): string[];
    _getBaseGlyph(glyph: number, characters?: number[]): Glyph | null;
    /**
     * Returns a glyph object for the given glyph id.
     * You can pass the array of code points this glyph represents for
     * your use later, and it will be stored in the glyph object.
     *
     * @param {number} glyph
     * @param {number[]} characters
     * @return {Glyph}
     */
    getGlyph(glyph: number, characters?: number[]): Glyph | null;
    /**
     * Returns a Subset for this font.
     * @return {Subset}
     */
    createSubset(): Subset;
    /**
     * Returns an object describing the available variation axes
     * that this font supports. Keys are setting tags, and values
     * contain the axis name, range, and default value.
     *
     * @type {object}
     */
    get variationAxes(): {};
    /**
     * Returns an object describing the named variation instances
     * that the font designer has specified. Keys are variation names
     * and values are the variation settings for this instance.
     *
     * @type {object}
     */
    get namedVariations(): {};
    /**
     * Returns a new font with the given variation settings applied.
     * Settings can either be an instance name, or an object containing
     * variation tags as specified by the `variationAxes` property.
     *
     * @param {object} settings
     * @return {TTFFont}
     */
    getVariation(settings: string | Record<string, number>): TTFFont;
    get _variationProcessor(): GlyphVariationProcessor | null;
    getFont(name: string): TTFFont;
}
//# sourceMappingURL=TTFFont.d.ts.map