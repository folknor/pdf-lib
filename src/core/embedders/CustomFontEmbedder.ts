import type {
  Font,
  Fontkit,
  Glyph,
  GlyphPosition,
  Subset,
  TypeFeatures,
} from '../../types/fontkit.js';
import { mergeUint8Arrays, toHexStringOfMinLength } from '../../utils/index.js';
import type PDFRef from '../objects/PDFRef.js';
import PDFString from '../objects/PDFString.js';
import type PDFContext from '../PDFContext.js';
import { createCmap, type ToUnicodeEntry } from './CMap.js';
import EncodedText, {
  type GlyphSpacing,
  spacingExtras,
  type TextSpacing,
} from './EncodedText.js';
import { deriveFontFlags } from './FontFlags.js';

/**
 * A note of thanks to the developers of https://github.com/foliojs/pdfkit, as
 * this class borrows from:
 *   https://github.com/devongovett/pdfkit/blob/e71edab0dd4657b5a767804ba86c94c58d01fbca/lib/image/jpeg.coffee
 */
class CustomFontEmbedder {
  static async for(
    fontkit: Fontkit,
    fontData: Uint8Array,
    customName?: string,
    fontFeatures?: TypeFeatures,
    postscriptName?: string,
    maxDecodedSize?: number,
  ) {
    const font = asFont(
      await fontkit.create(fontData, postscriptName, { maxDecodedSize }),
    );
    return new CustomFontEmbedder(font, fontData, customName, fontFeatures);
  }

  readonly font: Font;
  readonly scale: number;
  readonly fontData: Uint8Array;
  readonly fontName: string;
  readonly customName: string | undefined;
  readonly fontFeatures: TypeFeatures | undefined;

  protected baseFontName: string;

  // ToUnicode state (see embedUnicodeCmap): every code encodeText emitted,
  // and the text of the first eligible occurrence of each.
  private readonly encodedCodes = new Set<number>();
  private readonly firstText = new Map<number, number[]>();

  // Track refs to embedded objects to avoid orphans on re-embedding
  protected cidFontDictRef?: PDFRef;
  protected fontDescriptorRef?: PDFRef;
  protected fontStreamRef?: PDFRef;
  protected unicodeCmapRef?: PDFRef;

  protected constructor(
    font: Font,
    fontData: Uint8Array,
    customName?: string,
    fontFeatures?: TypeFeatures,
  ) {
    this.font = font;
    this.scale = 1000 / this.font.unitsPerEm;
    this.fontData = fontData;
    this.fontName = this.font.postscriptName || 'Font';
    this.customName = customName;
    this.fontFeatures = fontFeatures;

    this.baseFontName = '';
  }

  /**
   * Encode the JavaScript string into this font. (JavaScript encodes strings in
   * Unicode, but embedded fonts use their own custom encodings)
   */
  encodeText(text: string): EncodedText {
    const {
      glyphs,
      positions,
      codePoints,
      text: glyphText,
    } = this.positionedLayout(text);
    const { scale } = this;
    const count = glyphs.length;
    const codes = new Array<string>(count);
    const advances = new Array<number>(count);
    const widths = new Array<number>(count);
    const xOffsets = new Array<number>(count);
    const yOffsets = new Array<number>(count);
    for (let idx = 0; idx < count; idx++) {
      const glyph = glyphs[idx]!;
      const position = positions[idx]!;
      const code = this.codeForGlyph(glyph);
      codes[idx] = toHexStringOfMinLength(code, 4);
      this.recordText(code, glyphText[idx]!, position);
      advances[idx] = position.xAdvance * scale;
      widths[idx] = this.pdfWidthOf(glyph);
      xOffsets[idx] = position.xOffset * scale;
      yOffsets[idx] = position.yOffset * scale;
    }
    return new EncodedText(
      codes,
      advances,
      widths,
      xOffsets,
      yOffsets,
      this.glyphSpacing(glyphs, positions, codePoints),
      positions.map((position) => position.attachedTo ?? null),
    );
  }

  /**
   * Notes the text one encoded occurrence stands for, for ToUnicode. The
   * first eligible occurrence of a code wins: one with text, not a hidden
   * default-ignorable (drawn as the space glyph) and not code 0 (.notdef,
   * which stands for no character whatever it was shown for). Encoding, not
   * drawing, is what votes; measuring does not.
   */
  private recordText(
    code: number,
    text: readonly number[],
    position: GlyphPosition,
  ): void {
    this.encodedCodes.add(code);
    if (code === 0 || position.hidden || text.length === 0) return;
    if (!this.firstText.has(code)) this.firstText.set(code, [...text]);
  }

  // Marks and hidden default-ignorables take no spacing; an occurrence of
  // U+0020 takes word spacing, so U+00A0 drawn with the same glyph does not.
  // A fontkit that reports no per-occurrence code points falls back to the
  // identity of the font's glyph for U+0020.
  private glyphSpacing(
    glyphs: Glyph[],
    positions: GlyphPosition[],
    codePoints: readonly (readonly number[])[] | undefined,
  ): GlyphSpacing[] {
    const spaceId =
      codePoints === undefined && this.font.hasGlyphForCodePoint(0x20)
        ? this.font.glyphForCodePoint(0x20).id
        : -1;
    return glyphs.map((glyph, idx) => {
      const position = positions[idx]!;
      if (position.isMark || position.hidden) return 'none';
      const isSpace = codePoints
        ? codePoints[idx]!.length === 1 && codePoints[idx]![0] === 0x20
        : glyph.id === spaceId;
      return isSpace ? 'space' : 'base';
    });
  }

  // Measures exactly what encodeText() draws: the sum of the positioned
  // advances of the shaped glyphs (GPOS and kern-table kerning, zeroed mark
  // advances, hidden default-ignorables), which the drawing operators
  // reproduce against the /W widths. Measuring unshaped cmap glyphs instead
  // goes wrong wherever shaping substitutes - Arabic joining forms, Hangul
  // jamo composition, Indic conjuncts, ligatures - by up to a factor of two.
  // Measuring does not add glyphs to a subset.
  // With spacing, it measures what encodeText(text).withSpacing() draws.
  widthOfTextAtSize(
    text: string,
    size: number,
    spacing: TextSpacing = {},
  ): number {
    const { glyphs, positions, codePoints } = this.positionedLayout(text);
    let total = 0;
    for (let idx = 0, len = positions.length; idx < len; idx++) {
      total += positions[idx]!.xAdvance;
    }
    let width = (total * size) / this.font.unitsPerEm;
    const { characterSpacing = 0, wordSpacing = 0 } = spacing;
    if (characterSpacing !== 0 || wordSpacing !== 0) {
      for (const extra of spacingExtras(
        this.glyphSpacing(glyphs, positions, codePoints),
        characterSpacing,
        wordSpacing,
        size,
      )) {
        width += (extra * size) / 1000;
      }
    }
    return width;
  }

  /**
   * The font's layout of `text`, checked before anything is encoded from it.
   * Built-in layout always returns one glyph object and one position per
   * glyph; anything else (a fontkit with no glyph source) is refused rather
   * than drawn with made-up metrics.
   */
  protected positionedLayout(text: string): {
    glyphs: Glyph[];
    positions: GlyphPosition[];
    /** Per-occurrence shaping code points; undefined if the fontkit has none. */
    codePoints: number[][] | undefined;
    /** Per-occurrence text for ToUnicode. */
    text: readonly (readonly number[])[];
  } {
    const run = this.font.layout(text, this.fontFeatures);
    const glyphs = run.glyphs as (Glyph | null | undefined)[];
    const positions = (run.positions ?? []) as (
      | GlyphPosition
      | null
      | undefined
    )[];
    if (positions.length !== glyphs.length) {
      throw new Error(
        `Font layout returned ${glyphs.length} glyphs but ${positions.length} positions`,
      );
    }
    for (let idx = 0, len = glyphs.length; idx < len; idx++) {
      const position = positions[idx];
      if (!glyphs[idx] || !position) {
        throw new Error(`Font layout returned no glyph at index ${idx}`);
      }
      // yAdvance is not honoured: text is laid out horizontally only.
      if (
        !Number.isFinite(position.xAdvance) ||
        !Number.isFinite(position.xOffset) ||
        !Number.isFinite(position.yOffset)
      ) {
        throw new Error(`Font layout returned a non-finite position at ${idx}`);
      }
    }
    const { codePoints } = run;
    // Another fontkit build may report no per-occurrence text; its glyph
    // objects' codePoints are then the best there is.
    const occurrenceText =
      run.text ?? glyphs.map((glyph) => glyph!.codePoints ?? []);
    if (
      occurrenceText.length !== glyphs.length ||
      (codePoints !== undefined && codePoints.length !== glyphs.length)
    ) {
      throw new Error('Font layout returned code points for other glyphs');
    }
    return {
      glyphs: glyphs as Glyph[],
      positions: positions as GlyphPosition[],
      codePoints,
      text: occurrenceText,
    };
  }

  /** The code (CID) a shown glyph is written as; Identity, so its id. */
  protected codeForGlyph(glyph: Glyph): number {
    return glyph.id;
  }

  /**
   * The width the PDF gives a glyph's code (its /W entry, see computeWidths),
   * in thousandths of an em.
   */
  protected pdfWidthOf(glyph: Glyph): number {
    // A variation instance's advance can be fractional; the embedded
    // font's hmtx holds it rounded (TTFSubset._pushGlyph), and /W agrees.
    return Math.round(glyph.advanceWidth) * this.scale;
  }

  heightOfFontAtSize(
    size: number,
    options: { descender?: boolean } = {},
  ): number {
    const { descender = true } = options;

    const { ascent, descent, bbox } = this.font;
    const yTop = (ascent || bbox.maxY) * this.scale;
    const yBottom = (descent || bbox.minY) * this.scale;

    let height = yTop - yBottom;
    if (!descender) height -= Math.abs(descent) || 0;

    return (height / 1000) * size;
  }

  sizeOfFontAtHeight(height: number): number {
    const { ascent, descent, bbox } = this.font;
    const yTop = (ascent || bbox.maxY) * this.scale;
    const yBottom = (descent || bbox.minY) * this.scale;
    return (1000 * height) / (yTop - yBottom);
  }

  embedIntoContext(context: PDFContext, ref?: PDFRef): Promise<PDFRef> {
    this.baseFontName =
      this.customName || context.addRandomSuffix(this.fontName);
    return this.embedFontDict(context, ref);
  }

  protected async embedFontDict(
    context: PDFContext,
    ref?: PDFRef,
  ): Promise<PDFRef> {
    const cidFontDictRef = await this.embedCIDFontDict(context);
    const unicodeCMapRef = this.embedUnicodeCmap(context);

    const fontDict = context.obj({
      Type: 'Font',
      Subtype: 'Type0',
      BaseFont: this.baseFontName,
      Encoding: 'Identity-H',
      DescendantFonts: [cidFontDictRef],
      ToUnicode: unicodeCMapRef,
    });

    if (ref) {
      context.assign(ref, fontDict);
      return ref;
    } else {
      return context.register(fontDict);
    }
  }

  // Our fontkit has no `font.cff` (other fontkit builds may); it exposes the
  // table as 'CFF ', so look in the table directory, which avoids decoding it.
  // CFF2 is deliberately not CFF here: it embeds converted to TrueType.
  protected isCFF(): boolean {
    const font = this.font as {
      cff?: unknown;
      directory?: { tables?: Record<string, unknown> };
    };
    return !!(font.cff || font.directory?.tables?.['CFF ']);
  }

  /**
   * /Subtype of the font file stream. CFF fonts are always written as a bare
   * CID-keyed CFF (see serializeFont), TrueType needs none.
   */
  protected fontFileSubtype(): string | undefined {
    return this.isCFF() ? 'CIDFontType0C' : undefined;
  }

  protected async embedCIDFontDict(context: PDFContext): Promise<PDFRef> {
    const fontDescriptorRef = await this.embedFontDescriptor(context);

    const cidFontDict = context.obj({
      Type: 'Font',
      Subtype: this.isCFF() ? 'CIDFontType0' : 'CIDFontType2',
      CIDToGIDMap: 'Identity',
      BaseFont: this.baseFontName,
      CIDSystemInfo: {
        Registry: PDFString.of('Adobe'),
        Ordering: PDFString.of('Identity'),
        Supplement: 0,
      },
      FontDescriptor: fontDescriptorRef,
      W: this.computeWidths(),
    });

    // Reuse existing ref to avoid orphans on re-embedding
    if (this.cidFontDictRef) {
      context.assign(this.cidFontDictRef, cidFontDict);
    } else {
      this.cidFontDictRef = context.register(cidFontDict);
    }
    return this.cidFontDictRef;
  }

  protected async embedFontDescriptor(context: PDFContext): Promise<PDFRef> {
    const { ref: fontStreamRef, bbox } = await this.embedFontStream(context);

    const { scale } = this;
    const { italicAngle, ascent, descent, capHeight, xHeight } = this.font;

    const fontDescriptor = context.obj({
      Type: 'FontDescriptor',
      FontName: this.baseFontName,
      Flags: deriveFontFlags(this.font),
      FontBBox: bbox,
      ItalicAngle: italicAngle,
      Ascent: ascent * scale,
      Descent: descent * scale,
      CapHeight: (capHeight || ascent) * scale,
      XHeight: (xHeight || 0) * scale,

      // Not sure how to compute/find this, nor is anybody else really:
      // https://stackoverflow.com/questions/35485179/stemv-value-of-the-truetype-font
      StemV: 0,

      [this.isCFF() ? 'FontFile3' : 'FontFile2']: fontStreamRef,
    });

    // Reuse existing ref to avoid orphans on re-embedding
    if (this.fontDescriptorRef) {
      context.assign(this.fontDescriptorRef, fontDescriptor);
    } else {
      this.fontDescriptorRef = context.register(fontDescriptor);
    }
    return this.fontDescriptorRef;
  }

  /**
   * TrueType files are embedded as is. Everything else is re-encoded with
   * every glyph kept in order (glyph ids unchanged):
   * - WOFF/WOFF2 bytes are compressed web containers a PDF cannot hold;
   * - CFF-flavoured OpenType: a CIDFontType0 selects glyphs by CID through the
   *   CFF charset, but text, /W and ToUnicode use glyph ids. The original
   *   charset of a CID-keyed font maps them differently (Source Han: GID 365
   *   is CID 621), so the re-encoded CFF gets an identity charset (CID ==
   *   GID). This also avoids FontFile3 /OpenType, which needs PDF 1.6.
   * - CFF2 (variable PostScript-outline) OpenType: converted to a TrueType
   *   font (see TTFSubset._fromCFF2), so it is a FontFile2 like any other
   *   TrueType, from the instance's own outlines when it is a variation.
   */
  protected async serializeFont(): Promise<Uint8Array> {
    if (isWebFont(this.font) || this.isCFF() || isCFF2(this.font)) {
      return encodeWholeFont(this.font);
    }
    return this.fontData;
  }

  /**
   * Embeds the font program and returns its ref with the FontBBox (glyph
   * space) that belongs to exactly these bytes.
   *
   * A TrueType program's box is its own head box: a variation instance, a
   * converted CFF2 font or a WOFF2-transformed font is re-encoded and its head
   * recomputed from the glyphs written (TTFSubset._updateExtents), so the
   * source font's head can be smaller than the outlines embedded. A raw-copied
   * static subset keeps the source head, which contains its glyphs given valid
   * source metadata and glyf coordinates placed at hmtx lsb == xMin (a glyph
   * whose lsb differs is shifted by renderers that place it by its bearing).
   * ISO 32000-1 Table 122 only recommends the smallest box, so that superset
   * stands. A CFF program keeps the source head box, as before; nothing here
   * checks it against the CFF top DICT FontBBox.
   */
  protected async embedFontStream(
    context: PDFContext,
  ): Promise<{ ref: PDFRef; bbox: number[] }> {
    const fontProgram = await this.serializeFont();
    let bbox: number[];
    if (this.isCFF()) {
      const { scale } = this;
      const { minX, minY, maxX, maxY } = this.font.bbox;
      bbox = [minX * scale, minY * scale, maxX * scale, maxY * scale];
    } else {
      bbox = sfntFontBBox(fontProgram);
    }

    const fontStream = context.flateStream(fontProgram, {
      // Table 127 requires the decoded program length for FontFile2 only.
      Length1: this.isCFF() ? undefined : fontProgram.length,
      Subtype: this.fontFileSubtype(),
    });

    // Reuse existing ref to avoid orphans on re-embedding
    if (this.fontStreamRef) {
      context.assign(this.fontStreamRef, fontStream);
    } else {
      this.fontStreamRef = context.register(fontStream);
    }
    return { ref: this.fontStreamRef, bbox };
  }

  /**
   * ToUnicode maps each code to one string, while one glyph can stand for
   * different text in different places, so the map is a lossy projection:
   * a code encodeText emitted takes the text of its first eligible
   * occurrence (see recordText) - the spelling it was shaped from, so a
   * glyph only shaping reaches (ligature, joining form, Thai small tone mark)
   * is mapped, as its characters rather than as a presentation form the cmap
   * may also map to it - and a code emitted only without text gets none.
   * What one string per code cannot say is lost: a second meaning of the
   * same glyph (U+0020 and U+00A0), and the typed order and spelling where
   * shaping split or reordered characters (SARA AM, reph).
   */
  protected recordedEntries(): ToUnicodeEntry[] {
    return [...this.firstText].sort(([a], [b]) => a - b);
  }

  /**
   * A full embed also maps every glyph never encoded through the cmap, as
   * before; a glyph encoded only without text stays unmapped.
   */
  protected toUnicodeEntries(): ToUnicodeEntry[] {
    return withCmapFill(this.font, this.recordedEntries(), (code) =>
      this.encodedCodes.has(code),
    );
  }

  protected embedUnicodeCmap(context: PDFContext): PDFRef {
    const cmap = createCmap(this.toUnicodeEntries());
    const cmapStream = context.flateStream(cmap);

    // Reuse existing ref to avoid orphans on re-embedding
    if (this.unicodeCmapRef) {
      context.assign(this.unicodeCmapRef, cmapStream);
    } else {
      this.unicodeCmapRef = context.register(cmapStream);
    }
    return this.unicodeCmapRef;
  }

  protected glyphId(glyph?: Glyph): number {
    return glyph ? glyph.id : -1;
  }

  /**
   * The glyphs whose widths go into /W. For a full (non-subset) embed this is
   * every glyph in the font, so glyphs reachable only through shaping
   * (ligatures, alternates) still get their real width instead of /DW.
   */
  protected glyphsForWidths(): Glyph[] {
    const glyphs: Glyph[] = [];
    for (let id = 0, len = this.font.numGlyphs; id < len; id++) {
      const glyph = this.font.getGlyph(id);
      if (glyph) glyphs.push(glyph);
    }
    return glyphs;
  }

  protected computeWidths(): (number | number[])[] {
    return compressWidths(
      this.glyphsForWidths().map((glyph) => [
        this.glyphId(glyph),
        this.pdfWidthOf(glyph),
      ]),
    );
  }
}

/**
 * The full embed's ToUnicode: the encoded codes as recorded, plus, for every
 * glyph encodeText never emitted, the lowest code point the cmap maps to it
 * (code == glyph id). Built from code point -> glyph pairs, so no glyph object's
 * history enters it.
 */
const withCmapFill = (
  font: Font,
  recorded: ToUnicodeEntry[],
  wasEncoded: (code: number) => boolean,
): ToUnicodeEntry[] => {
  const entries = new Map<number, readonly number[]>(recorded);
  const characterSet = [...font.characterSet].sort((a, b) => a - b);
  for (const codePoint of characterSet) {
    // fontkit returns null when it cannot build a glyph object for the
    // code point; the declared return type omits that.
    const glyph = font.glyphForCodePoint(codePoint) as Glyph | null;
    if (!glyph || glyph.id === 0) continue;
    if (wasEncoded(glyph.id) || entries.has(glyph.id)) continue;
    entries.set(glyph.id, [codePoint]);
  }
  return [...entries].sort(([a], [b]) => a - b);
};

/**
 * Narrow a `fontkit.create()` result to a single face. Font collections
 * (.ttc/.dfont) and unresolved faces (`null`) get a clear error instead of
 * failing later on a missing method.
 */
export const asFont = (font: unknown): Font => {
  if (!font || typeof font !== 'object') {
    throw new Error(
      'fontkit.create() returned no font. Check the font bytes, or the PostScript name used to select a face from a collection.',
    );
  }
  const candidate = font as Partial<Font> & { fonts?: unknown };
  if (
    typeof candidate.layout !== 'function' ||
    typeof candidate.glyphForCodePoint !== 'function'
  ) {
    if (Array.isArray(candidate.fonts)) {
      throw new Error(
        'fontkit.create() returned a font collection (e.g. .ttc/.dfont). Select a face by its PostScript name, or embed a single-font file.',
      );
    }
    throw new Error('fontkit.create() did not return a usable font.');
  }
  return font as Font;
};

const isCFF2 = (font: Font): boolean => {
  const { directory } = font as {
    directory?: { tables?: Record<string, unknown> };
  };
  return !!directory?.tables?.['CFF2'];
};

const isWebFont = (font: Font): boolean => {
  const { type } = font as { type?: unknown };
  return type === 'WOFF' || type === 'WOFF2';
};

/**
 * WOFF/WOFF2 bytes are a compressed web container, not something a PDF
 * FontFile2/FontFile3 stream may hold. Re-encode the decoded font through a
 * subset that keeps every glyph, in order, so glyph ids (and therefore the
 * Identity CID mapping, /W and ToUnicode) are unchanged. Like the subset path,
 * the result carries only the tables PDF needs (TrueType: glyf, loca, hmtx,
 * head, hhea, maxp, cvt, prep, fpgm; CFF: a bare CFF table).
 */
const encodeWholeFont = (font: Font): Promise<Uint8Array> => {
  const subset = font.createSubset();
  for (let id = 1, len = font.numGlyphs; id < len; id++) {
    if (subset.includeGlyph(id) !== id) {
      throw new Error(`Glyph ${id} was renumbered while re-encoding the font`);
    }
  }
  return encodeSubset(subset);
};

export const encodeSubset = (subset: Subset): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const parts: Uint8Array[] = [];
    subset
      .encodeStream()
      .on('data', (bytes) => parts.push(bytes))
      .on('end', () => resolve(mergeUint8Arrays(parts)))
      .on('error' as any, (err) => reject(err));
  });

/**
 * The head box of a TrueType program in PDF glyph space, scaled by the
 * program's own unitsPerEm (the bytes may come from any fontkit).
 */
export const sfntFontBBox = (bytes: Uint8Array): number[] => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 12) throw new Error('Font program has no sfnt directory');
  const numTables = view.getUint16(4);
  if (12 + 16 * numTables > bytes.length) {
    throw new Error('Font program sfnt directory is truncated');
  }
  for (let i = 0; i < numTables; i++) {
    const record = 12 + 16 * i;
    const tag = String.fromCharCode(...bytes.subarray(record, record + 4));
    if (tag !== 'head') continue;
    const offset = view.getUint32(record + 8);
    if (view.getUint32(record + 12) < 54 || offset + 54 > bytes.length) {
      throw new Error('Font program head table is truncated');
    }
    const unitsPerEm = view.getUint16(offset + 18);
    if (unitsPerEm === 0) throw new Error('Font program head has unitsPerEm 0');
    const scale = 1000 / unitsPerEm;
    return [36, 38, 40, 42].map((at) => view.getInt16(offset + at) * scale);
  }
  throw new Error('Font program has no head table');
};

/** Runs of at least this many equal widths are written as `first last w`. */
const MIN_WIDTH_RANGE = 4;

/**
 * Build a CIDFont /W array from `[cid, width]` pairs (sorted by ascending,
 * unique cid). Consecutive cids go into `c [w1 w2 ...]` sections, and runs of
 * identical widths use the `cFirst cLast w` form (PDF 32000-1:2008 9.7.4.3),
 * which keeps /W small for large fonts with many same-width glyphs (CJK).
 */
export const compressWidths = (
  entries: [number, number][],
): (number | number[])[] => {
  const widths: (number | number[])[] = [];
  let section: number[] | undefined;
  let prevId = Number.NaN;

  let idx = 0;
  while (idx < entries.length) {
    const [id, width] = entries[idx]!;

    let end = idx;
    while (
      end + 1 < entries.length &&
      entries[end + 1]![0] === entries[end]![0] + 1 &&
      entries[end + 1]![1] === width
    ) {
      end++;
    }

    if (end - idx + 1 >= MIN_WIDTH_RANGE) {
      widths.push(id, entries[end]![0], width);
      section = undefined;
      prevId = entries[end]![0];
      idx = end + 1;
      continue;
    }

    if (section === undefined || id !== prevId + 1) {
      section = [];
      widths.push(id, section);
    }
    section.push(width);
    prevId = id;
    idx++;
  }

  return widths;
};

export default CustomFontEmbedder;
