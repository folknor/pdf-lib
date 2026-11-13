import type { Font, Fontkit, Glyph, Subset, TypeFeatures } from '../../types/fontkit.js';
import { Cache } from '../../utils/index.js';
import PDFHexString from '../objects/PDFHexString.js';
import type PDFRef from '../objects/PDFRef.js';
import type PDFContext from '../PDFContext.js';
/**
 * A note of thanks to the developers of https://github.com/foliojs/pdfkit, as
 * this class borrows from:
 *   https://github.com/devongovett/pdfkit/blob/e71edab0dd4657b5a767804ba86c94c58d01fbca/lib/image/jpeg.coffee
 */
declare class CustomFontEmbedder {
    static for(fontkit: Fontkit, fontData: Uint8Array, customName?: string, fontFeatures?: TypeFeatures, postscriptName?: string): Promise<CustomFontEmbedder>;
    readonly font: Font;
    readonly scale: number;
    readonly fontData: Uint8Array;
    readonly fontName: string;
    readonly customName: string | undefined;
    readonly fontFeatures: TypeFeatures | undefined;
    protected baseFontName: string;
    protected glyphCache: Cache<Glyph[]>;
    protected cidFontDictRef?: PDFRef;
    protected fontDescriptorRef?: PDFRef;
    protected fontStreamRef?: PDFRef;
    protected unicodeCmapRef?: PDFRef;
    protected constructor(font: Font, fontData: Uint8Array, customName?: string, fontFeatures?: TypeFeatures);
    /**
     * Encode the JavaScript string into this font. (JavaScript encodes strings in
     * Unicode, but embedded fonts use their own custom encodings)
     */
    encodeText(text: string): PDFHexString;
    widthOfTextAtSize(text: string, size: number): number;
    heightOfFontAtSize(size: number, options?: {
        descender?: boolean;
    }): number;
    sizeOfFontAtHeight(height: number): number;
    embedIntoContext(context: PDFContext, ref?: PDFRef): Promise<PDFRef>;
    protected embedFontDict(context: PDFContext, ref?: PDFRef): Promise<PDFRef>;
    protected isCFF(): boolean;
    /**
     * /Subtype of the font file stream. CFF fonts are always written as a bare
     * CID-keyed CFF (see serializeFont), TrueType needs none.
     */
    protected fontFileSubtype(): string | undefined;
    protected embedCIDFontDict(context: PDFContext): Promise<PDFRef>;
    protected embedFontDescriptor(context: PDFContext): Promise<PDFRef>;
    /**
     * TrueType files are embedded as is. Everything else is re-encoded with
     * every glyph kept in order (glyph ids unchanged):
     * - WOFF/WOFF2 bytes are compressed web containers a PDF cannot hold;
     * - CFF-flavoured OpenType: a CIDFontType0 selects glyphs by CID through the
     *   CFF charset, but text, /W and ToUnicode use glyph ids. The original
     *   charset of a CID-keyed font maps them differently (Source Han: GID 365
     *   is CID 621), so the re-encoded CFF gets an identity charset (CID ==
     *   GID). This also avoids FontFile3 /OpenType, which needs PDF 1.6.
     */
    protected serializeFont(): Promise<Uint8Array>;
    protected embedFontStream(context: PDFContext): Promise<PDFRef>;
    protected embedUnicodeCmap(context: PDFContext): PDFRef;
    protected glyphId(glyph?: Glyph): number;
    /**
     * The glyphs whose widths go into /W. For a full (non-subset) embed this is
     * every glyph in the font, so glyphs reachable only through shaping
     * (ligatures, alternates) still get their real width instead of /DW.
     */
    protected glyphsForWidths(): Glyph[];
    protected computeWidths(): (number | number[])[];
    private allGlyphsInFontSortedById;
}
/**
 * Narrow a `fontkit.create()` result to a single face. Font collections
 * (.ttc/.dfont) and unresolved faces (`null`) get a clear error instead of
 * failing later on a missing method.
 */
export declare const asFont: (font: unknown) => Font;
export declare const encodeSubset: (subset: Subset) => Promise<Uint8Array>;
/**
 * Build a CIDFont /W array from `[cid, width]` pairs (sorted by ascending,
 * unique cid). Consecutive cids go into `c [w1 w2 ...]` sections, and runs of
 * identical widths use the `cFirst cLast w` form (PDF 32000-1:2008 9.7.4.3),
 * which keeps /W small for large fonts with many same-width glyphs (CJK).
 */
export declare const compressWidths: (entries: [number, number][]) => (number | number[])[];
export default CustomFontEmbedder;
//# sourceMappingURL=CustomFontEmbedder.d.ts.map