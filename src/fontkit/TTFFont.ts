import DecodeStream from '../core/streams/DecodeStream.js';
import type * as r from '../vendors/restructure/index.js';
import * as fontkit from './base.js';
import CmapProcessor from './CmapProcessor.js';
import { cacheValue } from './decorators.js';
import BBox from './glyph/BBox.js';
import CBDTGlyph from './glyph/CBDTGlyph.js';
import CFFGlyph from './glyph/CFFGlyph.js';
import COLRGlyph from './glyph/COLRGlyph.js';
import type Glyph from './glyph/Glyph.js';
import GlyphVariationProcessor from './glyph/GlyphVariationProcessor.js';
import SBIXGlyph from './glyph/SBIXGlyph.js';
import TTFGlyph from './glyph/TTFGlyph.js';
import type GlyphRun from './layout/GlyphRun.js';
import LayoutEngine from './layout/LayoutEngine.js';
import CFFSubset from './subset/CFFSubset.js';
import type Subset from './subset/Subset.js';
import TTFSubset from './subset/TTFSubset.js';
import Directory from './tables/directory.js';
import tables from './tables/index.js';
import { asciiDecoder } from './utils.js';

/** Options accepted by `create()` and every font format's constructor. */
export interface FontOptions {
  /**
   * Largest decompressed table space, in bytes, a WOFF or WOFF2 container
   * may declare. Defaults to `DecodeStream.maxDecodedSize` at construction.
   */
  maxDecodedSize?: number | undefined;
}

/**
 * Whether a cached glyph carries outlines (glyf/CFF, including SBIX and WOFF2
 * glyphs, which extend TTFGlyph), as opposed to a COLR or CBDT wrapper.
 */
export const isOutlineGlyph = (
  glyph: Glyph | undefined,
): glyph is TTFGlyph | CFFGlyph =>
  glyph instanceof TTFGlyph || glyph instanceof CFFGlyph;

/**
 * This is the base class for all SFNT-based font formats in fontkit.
 * It supports TrueType, and PostScript glyphs, and several color glyph formats.
 */
export default class TTFFont {
  type: string = 'TTF';
  defaultLanguage: string | null;
  stream: r.DecodeStream;
  variationCoords: number[] | null;
  directory: any;
  _directoryPos: number;
  _tables: Record<string, any>;
  _glyphs: Record<number, Glyph>;

  // Table properties (lazily parsed)
  [key: string]: any;

  static probe(buffer: Uint8Array): boolean {
    const format = asciiDecoder.decode(buffer.slice(0, 4));
    return (
      format === 'true' ||
      format === 'OTTO' ||
      format === String.fromCharCode(0, 1, 0, 0)
    );
  }

  constructor(stream: r.DecodeStream, options: FontOptions = {}) {
    this.defaultLanguage = null;
    this.stream = stream;
    this.variationCoords = null;

    this._directoryPos = this.stream.pos;
    this._tables = {};
    this._glyphs = {};
    this._decodeDirectory();
    // Eager, so that a font that exists has its table space, and so that a
    // decompression failure (notably the size cap) propagates from create()
    // instead of being swallowed by _getTable into missing tables.
    this._decompress(options.maxDecodedSize ?? DecodeStream.maxDecodedSize);
    this._installTableGetters();
  }

  // Defines a lazily-parsing property per table. Configurable so that
  // getVariation() can re-bind them on an instance cloned from this one.
  _installTableGetters(): void {
    for (const tag in this.directory.tables) {
      const table = this.directory.tables[tag];
      if (tables[tag] && table.length > 0) {
        Object.defineProperty(this, tag, {
          get: this._getTable.bind(this, table),
          configurable: true,
        });
      }
    }
  }

  /**
   * Establishes the invariant every table reader relies on: `this.stream`
   * holds each table at `directory.tables[tag].offset`, so offsets a table
   * resolves (gvar glyph data, sbix images, glyf via loca) index `this.stream`.
   * A plain SFNT already satisfies it. WOFF and WOFF2 override this to
   * decompress every table into one buffer and rewrite the offsets, refusing
   * (DecodedStreamTooLargeError) a declared table space over `maxDecodedSize`.
   * Called once, from the constructor.
   */
  _decompress(_maxDecodedSize: number): void {}

  setDefaultLanguage(lang: string | null = null): void {
    this.defaultLanguage = lang;
  }

  _getTable(table: any): any {
    if (!(table.tag in this._tables)) {
      try {
        this._tables[table.tag] = this._decodeTable(table);
      } catch (e: any) {
        if (fontkit.logErrors) {
          console.error(`Error decoding table ${table.tag}`);
          console.error(e.stack);
        }
      }
    }

    return this._tables[table.tag];
  }

  _getTableStream(tag: string): r.DecodeStream | null {
    const table = this.directory.tables[tag];
    if (table) {
      this.stream.pos = table.offset;
      return this.stream;
    }

    return null;
  }

  _decodeDirectory(): any {
    return (this.directory = Directory.decode(this.stream, {
      _startOffset: 0,
    }));
  }

  _decodeTable(table: any): any {
    const pos = this.stream.pos;

    // Only reached for directory entries with a codec (_installTableGetters),
    // so the stream is never null here; no guard needed.
    const stream = this._getTableStream(table.tag);
    const result = tables[table.tag].decode(stream, this, table.length);

    this.stream.pos = pos;
    return result;
  }

  /**
   * Gets a string from the font's `name` table
   * `lang` is a BCP-47 language code.
   * @return {string}
   */
  getName(
    key: string,
    lang: string = this.defaultLanguage || fontkit.defaultLanguage,
  ): string | null {
    const record = this['name']?.records[key];
    if (record) {
      // Attempt to retrieve the entry, depending on which translation is available:
      const firstKey = Object.keys(record)[0];
      return (
        record[lang] ||
        (this.defaultLanguage ? record[this.defaultLanguage] : null) ||
        record[fontkit.defaultLanguage] ||
        record['en'] ||
        (firstKey ? record[firstKey] : null) || // Seriously, ANY language would be fine
        null
      );
    }

    return null;
  }

  /**
   * The unique PostScript name for this font, e.g. "Helvetica-Bold"
   * @type {string}
   */
  get postscriptName() {
    return this.getName('postscriptName');
  }

  /**
   * The font's full name, e.g. "Helvetica Bold"
   * @type {string}
   */
  get fullName() {
    return this.getName('fullName');
  }

  /**
   * The font's family name, e.g. "Helvetica"
   * @type {string}
   */
  get familyName() {
    return this.getName('fontFamily');
  }

  /**
   * The font's sub-family, e.g. "Bold".
   * @type {string}
   */
  get subfamilyName() {
    return this.getName('fontSubfamily');
  }

  /**
   * The font's copyright information
   * @type {string}
   */
  get copyright() {
    return this.getName('copyright');
  }

  /**
   * The font's version number
   * @type {string}
   */
  get version() {
    return this.getName('version');
  }

  /**
   * The font's [ascender](https://en.wikipedia.org/wiki/Ascender_(typography))
   * @type {number}
   */
  get ascent() {
    return this['hhea'].ascent;
  }

  /**
   * The font's [descender](https://en.wikipedia.org/wiki/Descender)
   * @type {number}
   */
  get descent() {
    return this['hhea'].descent;
  }

  /**
   * The amount of space that should be included between lines
   * @type {number}
   */
  get lineGap() {
    return this['hhea'].lineGap;
  }

  /**
   * The offset from the normal underline position that should be used
   * @type {number}
   */
  get underlinePosition() {
    return this['post'].underlinePosition;
  }

  /**
   * The weight of the underline that should be used
   * @type {number}
   */
  get underlineThickness() {
    return this['post'].underlineThickness;
  }

  /**
   * If this is an italic font, the angle the cursor should be drawn at to match the font design
   * @type {number}
   */
  get italicAngle() {
    return this['post'].italicAngle;
  }

  /**
   * The height of capital letters above the baseline.
   * See [here](https://en.wikipedia.org/wiki/Cap_height) for more details.
   * @type {number}
   */
  get capHeight() {
    const os2 = this['OS/2'];
    // OS/2 v0 and v1 have no capHeight field.
    return os2?.capHeight ?? this.ascent;
  }

  /**
   * The height of lower case letters in the font.
   * See [here](https://en.wikipedia.org/wiki/X-height) for more details.
   * @type {number}
   */
  get xHeight() {
    const os2 = this['OS/2'];
    // OS/2 v0 and v1 have no xHeight field.
    return os2?.xHeight ?? 0;
  }

  /**
   * The number of glyphs in the font.
   * @type {number}
   */
  get numGlyphs() {
    return this['maxp'].numGlyphs;
  }

  /**
   * The size of the font's internal coordinate grid
   * @type {number}
   */
  get unitsPerEm() {
    return this['head'].unitsPerEm;
  }

  /**
   * The font's bounding box, i.e. the box that encloses all glyphs in the font.
   * @type {BBox}
   */
  get bbox() {
    return cacheValue(
      this,
      'bbox',
      Object.freeze(
        new BBox(
          this['head'].xMin,
          this['head'].yMin,
          this['head'].xMax,
          this['head'].yMax,
        ),
      ),
    );
  }

  get _cmapProcessor() {
    return cacheValue(this, '_cmapProcessor', new CmapProcessor(this['cmap']));
  }

  /**
   * An array of all of the unicode code points supported by the font.
   * @type {number[]}
   */
  get characterSet() {
    return cacheValue(
      this,
      'characterSet',
      this._cmapProcessor.getCharacterSet(),
    );
  }

  /**
   * Returns whether there is glyph in the font for the given unicode code point.
   *
   * @param {number} codePoint
   * @return {boolean}
   */
  hasGlyphForCodePoint(codePoint: number): boolean {
    return !!this._cmapProcessor.lookup(codePoint);
  }

  /**
   * Maps a single unicode code point to a Glyph object.
   * Does not perform any advanced substitutions (there is no context to do so).
   *
   * @param {number} codePoint
   * @return {Glyph}
   */
  glyphForCodePoint(codePoint: number): Glyph | null {
    return this.getGlyph(this._cmapProcessor.lookup(codePoint), [codePoint]);
  }

  /**
   * Returns an array of Glyph objects for the given string.
   * This is only a one-to-one mapping from characters to glyphs.
   * For most uses, you should use font.layout (described below), which
   * provides a much more advanced mapping supporting AAT and OpenType shaping.
   *
   * @param {string} string
   * @return {Glyph[]}
   */
  glyphsForString(string: string): (Glyph | null)[] {
    const glyphs: (Glyph | null)[] = [];
    const len = string.length;
    let idx = 0;
    let last = -1;
    let state = -1;

    while (idx <= len) {
      let code = 0;
      let nextState = 0;

      if (idx < len) {
        // Decode the next codepoint from UTF 16
        code = string.charCodeAt(idx++);
        if (0xd800 <= code && code <= 0xdbff && idx < len) {
          const next = string.charCodeAt(idx);
          if (0xdc00 <= next && next <= 0xdfff) {
            idx++;
            code = ((code & 0x3ff) << 10) + (next & 0x3ff) + 0x10000;
          }
        }

        // Compute the next state: 1 if the next codepoint is a variation selector, 0 otherwise.
        nextState =
          (0xfe00 <= code && code <= 0xfe0f) ||
          (0xe0100 <= code && code <= 0xe01ef)
            ? 1
            : 0;
      } else {
        idx++;
      }

      if (state === 0 && nextState === 1) {
        // Variation selector following normal codepoint.
        glyphs.push(
          this.getGlyph(this._cmapProcessor.lookup(last, code), [last, code]),
        );
      } else if (state === 0 && nextState === 0) {
        // Normal codepoint following normal codepoint.
        glyphs.push(this.glyphForCodePoint(last));
      }

      last = code;
      state = nextState;
    }

    return glyphs;
  }

  get _layoutEngine() {
    return cacheValue(this, '_layoutEngine', new LayoutEngine(this));
  }

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
  layout(
    string: string,
    userFeatures?: string[] | Record<string, boolean>,
    script?: string,
    language?: string,
    direction?: string,
  ): GlyphRun {
    return this._layoutEngine.layout(
      string,
      userFeatures,
      script,
      language,
      direction,
    );
  }

  /**
   * Returns an array of strings that map to the given glyph id.
   * @param {number} gid - glyph id
   */
  stringsForGlyph(gid: number): string[] {
    return this._layoutEngine.stringsForGlyph(gid);
  }

  /**
   * An array of all [OpenType feature tags](https://www.microsoft.com/typography/otspec/featuretags.htm)
   * (or mapped AAT tags) supported by the font.
   * The features parameter is an array of OpenType feature tags to be applied in addition to the default set.
   * If this is an AAT font, the OpenType feature tags are mapped to AAT features.
   *
   * @type {string[]}
   */
  get availableFeatures() {
    return this._layoutEngine.getAvailableFeatures('DFLT', 'dflt');
  }

  getAvailableFeatures(
    script: string = 'DFLT',
    language: string = 'dflt',
  ): string[] {
    return this._layoutEngine.getAvailableFeatures(script, language);
  }

  /**
   * Returns the outline (glyf/CFF) glyph for the given id. The glyph cache may
   * already hold a color or bitmap glyph (COLR, CBDT) for this id; that one is
   * kept in the cache, and a fresh outline glyph is returned instead.
   */
  _getBaseGlyph(glyph: number, characters: number[] = []): Glyph | null {
    const cached = this._glyphs[glyph];
    if (isOutlineGlyph(cached)) {
      return cached;
    }

    let outline: Glyph | null = null;
    if (this.directory.tables.glyf) {
      outline = new TTFGlyph(glyph, characters, this);
    } else if (this.directory.tables['CFF '] || this.directory.tables.CFF2) {
      outline = new CFFGlyph(glyph, characters, this);
    }

    if (outline && !cached) {
      this._glyphs[glyph] = outline;
    }

    return outline;
  }

  /**
   * Returns a glyph object for the given glyph id.
   * You can pass the array of code points this glyph represents for
   * your use later, and it will be stored in the glyph object.
   *
   * @param {number} glyph
   * @param {number[]} characters
   * @return {Glyph}
   */
  // Null only for a font with no glyph source at all (no glyf, CFF, CFF2,
  // sbix, COLR+CPAL or bitmap tables). Layout and shaper code deliberately
  // does not null-check every getGlyph/glyphForCodePoint result for that case.
  getGlyph(glyph: number, characters: number[] = []): Glyph | null {
    if (!this._glyphs[glyph]) {
      if (this.directory.tables.sbix) {
        this._glyphs[glyph] = new SBIXGlyph(glyph, characters, this);
      } else if (this.directory.tables.COLR && this.directory.tables.CPAL) {
        this._glyphs[glyph] = new COLRGlyph(glyph, characters, this);
      } else if (
        (this.directory.tables.CBLC || this.directory.tables.EBLC) &&
        !this.directory.tables.glyf &&
        !this.directory.tables['CFF '] &&
        !this.directory.tables.CFF2
      ) {
        // Bitmap-only fonts have no outlines, so _getBaseGlyph would yield
        // null; a stub glyph still carries the hmtx metrics. Fonts that ship
        // embedded bitmaps next to outlines keep their outline glyphs.
        this._glyphs[glyph] = new CBDTGlyph(glyph, characters, this);
      } else {
        this._getBaseGlyph(glyph, characters);
      }
    }

    return this._glyphs[glyph] || null;
  }

  /**
   * Returns a Subset for this font.
   * @return {Subset}
   */
  createSubset(): Subset {
    if (this.directory.tables['CFF ']) {
      return new CFFSubset(this);
    }

    return new TTFSubset(this);
  }

  /**
   * Returns an object describing the available variation axes
   * that this font supports. Keys are setting tags, and values
   * contain the axis name, range, and default value.
   *
   * @type {object}
   */
  get variationAxes(): Record<string, any> {
    const res: Record<string, any> = {};
    if (!this['fvar']) {
      return cacheValue(this, 'variationAxes', res);
    }

    for (const axis of this['fvar'].axis) {
      res[axis.axisTag.trim()] = {
        // fvar name IDs can point at strings the name table lacks.
        name: axis.name?.en,
        min: axis.minValue,
        default: axis.defaultValue,
        max: axis.maxValue,
      };
    }

    return cacheValue(this, 'variationAxes', res);
  }

  /**
   * Returns an object describing the named variation instances
   * that the font designer has specified. Keys are variation names
   * and values are the variation settings for this instance.
   *
   * @type {object}
   */
  get namedVariations(): Record<string, any> {
    const res: Record<string, any> = {};
    if (!this['fvar']) {
      return cacheValue(this, 'namedVariations', res);
    }

    for (const instance of this['fvar'].instance) {
      // An instance with no English name string cannot be keyed or selected.
      const name = instance.name?.en;
      if (name == null) {
        continue;
      }

      const settings: Record<string, any> = {};
      for (let i = 0; i < this['fvar'].axis.length; i++) {
        const axis = this['fvar'].axis[i];
        settings[axis.axisTag.trim()] = instance.coord[i];
      }

      res[name] = settings;
    }

    return cacheValue(this, 'namedVariations', res);
  }

  /**
   * Returns a new font with the given variation settings applied.
   * Settings can either be an instance name, or an object containing
   * variation tags as specified by the `variationAxes` property.
   *
   * @param {object} settings
   * @return {TTFFont}
   */
  getVariation(settings: string | Record<string, number>): TTFFont {
    if (
      !(
        this.directory.tables.fvar &&
        ((this.directory.tables.gvar && this.directory.tables.glyf) ||
          this.directory.tables.CFF2)
      )
    ) {
      throw new Error(
        'Variations require a font with the fvar, gvar and glyf, or CFF2 tables.',
      );
    }

    if (typeof settings === 'string') {
      settings = this.namedVariations[settings];
    }

    if (typeof settings !== 'object') {
      throw new Error(
        'Variation settings must be either a variation name or settings object.',
      );
    }

    // normalize the coordinates
    const coords = this['fvar'].axis.map((axis: any, _i: number) => {
      const axisTag = axis.axisTag.trim();
      if (axisTag in (settings as Record<string, number>)) {
        return Math.max(
          axis.minValue,
          Math.min(
            axis.maxValue,
            (settings as Record<string, number>)[axisTag]!,
          ),
        );
      } else {
        return axis.defaultValue;
      }
    });

    // The instance is a clone, not a re-parse of the source bytes: it keeps
    // the subclass (and so the WOFF/WOFF2 table access), the decompressed
    // stream and the decoded tables. Re-parsing `this.stream` would read a
    // WOFF/WOFF2 container as a plain SFNT directory. The source was
    // decompressed at construction, so source and clone share one table space.
    const font: TTFFont = Object.create(Object.getPrototypeOf(this));
    // Own enumerable fields only: memoised getters (cacheValue) are
    // non-enumerable, so the clone recomputes them - notably
    // _variationProcessor from its own coords.
    Object.assign(font, this);
    font.variationCoords = coords;
    font._glyphs = {};
    font._installTableGetters();

    return font;
  }

  get _variationProcessor() {
    if (!this['fvar']) {
      return cacheValue(this, '_variationProcessor', null);
    }

    let variationCoords = this.variationCoords;

    // Ignore if no variation coords and not CFF2
    if (!variationCoords && !this['CFF2']) {
      return cacheValue(this, '_variationProcessor', null);
    }

    if (!variationCoords) {
      variationCoords = this['fvar'].axis.map((axis: any) => axis.defaultValue);
    }

    return cacheValue(
      this,
      '_variationProcessor',
      new GlyphVariationProcessor(this, variationCoords!),
    );
  }

  // Standardized format plugin API
  getFont(name: string): TTFFont {
    return this.getVariation(name);
  }
}
