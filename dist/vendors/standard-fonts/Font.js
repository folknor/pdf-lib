/**
 * Standard Fonts - Font class
 * Originally from https://github.com/Hopding/standard-fonts
 * Absorbed and converted for pdf-lib
 */
import CourierCompressed from './data/Courier.compressed.json' with {
    type: 'json'
};
// Import compressed font data
import CourierBoldCompressed from './data/Courier-Bold.compressed.json' with {
    type: 'json'
};
import CourierBoldObliqueCompressed from './data/Courier-BoldOblique.compressed.json' with {
    type: 'json'
};
import CourierObliqueCompressed from './data/Courier-Oblique.compressed.json' with {
    type: 'json'
};
import HelveticaCompressed from './data/Helvetica.compressed.json' with {
    type: 'json'
};
import HelveticaBoldCompressed from './data/Helvetica-Bold.compressed.json' with {
    type: 'json'
};
import HelveticaBoldObliqueCompressed from './data/Helvetica-BoldOblique.compressed.json' with {
    type: 'json'
};
import HelveticaObliqueCompressed from './data/Helvetica-Oblique.compressed.json' with {
    type: 'json'
};
import SymbolCompressed from './data/Symbol.compressed.json' with {
    type: 'json'
};
import TimesBoldCompressed from './data/Times-Bold.compressed.json' with {
    type: 'json'
};
import TimesBoldItalicCompressed from './data/Times-BoldItalic.compressed.json' with {
    type: 'json'
};
import TimesItalicCompressed from './data/Times-Italic.compressed.json' with {
    type: 'json'
};
import TimesRomanCompressed from './data/Times-Roman.compressed.json' with {
    type: 'json'
};
import ZapfDingbatsCompressed from './data/ZapfDingbats.compressed.json' with {
    type: 'json'
};
import { decompressJson } from './utils.js';
const compressedJsonForFontName = {
    Courier: CourierCompressed,
    'Courier-Bold': CourierBoldCompressed,
    'Courier-Oblique': CourierObliqueCompressed,
    'Courier-BoldOblique': CourierBoldObliqueCompressed,
    Helvetica: HelveticaCompressed,
    'Helvetica-Bold': HelveticaBoldCompressed,
    'Helvetica-Oblique': HelveticaObliqueCompressed,
    'Helvetica-BoldOblique': HelveticaBoldObliqueCompressed,
    'Times-Roman': TimesRomanCompressed,
    'Times-Bold': TimesBoldCompressed,
    'Times-Italic': TimesItalicCompressed,
    'Times-BoldItalic': TimesBoldItalicCompressed,
    Symbol: SymbolCompressed,
    ZapfDingbats: ZapfDingbatsCompressed,
};
export var FontNames;
(function (FontNames) {
    FontNames["Courier"] = "Courier";
    FontNames["CourierBold"] = "Courier-Bold";
    FontNames["CourierOblique"] = "Courier-Oblique";
    FontNames["CourierBoldOblique"] = "Courier-BoldOblique";
    FontNames["Helvetica"] = "Helvetica";
    FontNames["HelveticaBold"] = "Helvetica-Bold";
    FontNames["HelveticaOblique"] = "Helvetica-Oblique";
    FontNames["HelveticaBoldOblique"] = "Helvetica-BoldOblique";
    FontNames["TimesRoman"] = "Times-Roman";
    FontNames["TimesRomanBold"] = "Times-Bold";
    FontNames["TimesRomanItalic"] = "Times-Italic";
    FontNames["TimesRomanBoldItalic"] = "Times-BoldItalic";
    FontNames["Symbol"] = "Symbol";
    FontNames["ZapfDingbats"] = "ZapfDingbats";
})(FontNames || (FontNames = {}));
const fontCache = {};
export class Font {
    static load = (fontName) => {
        const cachedFont = fontCache[fontName];
        if (cachedFont)
            return cachedFont;
        const compressed = compressedJsonForFontName[fontName];
        if (!compressed) {
            throw new Error(`Unknown font: ${fontName}`);
        }
        const json = decompressJson(compressed);
        const font = Object.assign(new Font(), JSON.parse(json));
        font.CharWidths = font.CharMetrics.reduce((acc, metric) => {
            acc[metric.N] = metric.WX;
            return acc;
        }, {});
        font.KernPairXAmounts = font.KernPairs.reduce((acc, [name1, name2, width]) => {
            if (!acc[name1])
                acc[name1] = {};
            acc[name1][name2] = width;
            return acc;
        }, {});
        fontCache[fontName] = font;
        return font;
    };
    Comment;
    FontName;
    FullName;
    FamilyName;
    Weight;
    CharacterSet;
    Version;
    Notice;
    EncodingScheme;
    ItalicAngle;
    UnderlinePosition;
    UnderlineThickness;
    CapHeight;
    XHeight;
    Ascender;
    Descender;
    StdHW;
    StdVW;
    IsFixedPitch;
    /**
     * [llx lly urx ury]:
     *   Font bounding box where llx, lly, urx, and ury are all numbers.
     */
    FontBBox;
    CharMetrics;
    KernPairs;
    CharWidths;
    KernPairXAmounts;
    constructor() { }
    getWidthOfGlyph = (glyphName) => this.CharWidths[glyphName];
    getXAxisKerningForPair = (leftGlyphName, rightGlyphName) => this.KernPairXAmounts[leftGlyphName]?.[rightGlyphName];
}
//# sourceMappingURL=Font.js.map