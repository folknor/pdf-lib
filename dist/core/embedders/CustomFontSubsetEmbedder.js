import { Cache, toHexStringOfMinLength } from '../../utils/index.js';
import PDFHexString from '../objects/PDFHexString.js';
import CustomFontEmbedder, { asFont, encodeSubset, } from './CustomFontEmbedder.js';
/**
 * A note of thanks to the developers of https://github.com/foliojs/pdfkit, as
 * this class borrows from:
 *   https://github.com/devongovett/pdfkit/blob/e71edab0dd4657b5a767804ba86c94c58d01fbca/lib/image/jpeg.coffee
 */
class CustomFontSubsetEmbedder extends CustomFontEmbedder {
    static async for(fontkit, fontData, customFontName, fontFeatures, postscriptName) {
        const font = asFont(await fontkit.create(fontData, postscriptName));
        return new CustomFontSubsetEmbedder(font, fontData, customFontName, fontFeatures);
    }
    subset;
    glyphs;
    glyphIdMap;
    constructor(font, fontData, customFontName, fontFeatures) {
        super(font, fontData, customFontName, fontFeatures);
        this.subset = this.font.createSubset();
        this.glyphs = [];
        this.glyphCache = Cache.populatedBy(() => this.glyphs);
        this.glyphIdMap = new Map();
    }
    encodeText(text) {
        const { glyphs } = this.font.layout(text, this.fontFeatures);
        const hexCodes = new Array(glyphs.length);
        for (let idx = 0, len = glyphs.length; idx < len; idx++) {
            const glyph = glyphs[idx];
            const subsetGlyphId = this.subset.includeGlyph(glyph);
            this.glyphs[subsetGlyphId - 1] = glyph;
            this.glyphIdMap.set(glyph.id, subsetGlyphId);
            hexCodes[idx] = toHexStringOfMinLength(subsetGlyphId, 4);
        }
        this.glyphCache.invalidate();
        return PDFHexString.of(hexCodes.join(''));
    }
    isCFF() {
        return !!this.subset.cff;
    }
    glyphId(glyph) {
        return glyph ? this.glyphIdMap.get(glyph.id) : -1;
    }
    // A subset only carries the glyphs actually used, all of which are cached.
    glyphsForWidths() {
        return this.glyphCache.access();
    }
    serializeFont() {
        return encodeSubset(this.subset);
    }
}
export default CustomFontSubsetEmbedder;
//# sourceMappingURL=CustomFontSubsetEmbedder.js.map