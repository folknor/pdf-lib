/**
 * Standard Fonts - Font class
 * Originally from https://github.com/Hopding/standard-fonts
 * Absorbed and converted for pdf-lib
 */
declare const compressedJsonForFontName: Record<string, string>;
export declare enum FontNames {
    Courier = "Courier",
    CourierBold = "Courier-Bold",
    CourierOblique = "Courier-Oblique",
    CourierBoldOblique = "Courier-BoldOblique",
    Helvetica = "Helvetica",
    HelveticaBold = "Helvetica-Bold",
    HelveticaOblique = "Helvetica-Oblique",
    HelveticaBoldOblique = "Helvetica-BoldOblique",
    TimesRoman = "Times-Roman",
    TimesRomanBold = "Times-Bold",
    TimesRomanItalic = "Times-Italic",
    TimesRomanBoldItalic = "Times-BoldItalic",
    Symbol = "Symbol",
    ZapfDingbats = "ZapfDingbats"
}
export type IFontNames = FontNames | keyof typeof compressedJsonForFontName;
export interface ICharMetrics {
    /** Width of character */
    WX: number;
    /** Character name (aka Glyph name) */
    N: string;
}
/**
 * [name_1 name_2 number_x]:
 *   Name of the first character in the kerning pair followed by the name of the
 *   second character followed by the kerning amount in the x direction
 *   (y is zero). The kerning amount is specified in the units of the character
 *   coordinate system.
 */
export type IKernPair = [string, string, number];
export declare class Font {
    static load: (fontName: IFontNames) => Font;
    Comment: string;
    FontName: string;
    FullName: string;
    FamilyName: string;
    Weight: string;
    CharacterSet: string;
    Version: string;
    Notice: string;
    EncodingScheme: string;
    ItalicAngle: number;
    UnderlinePosition: number;
    UnderlineThickness: number;
    CapHeight: number | undefined;
    XHeight: number | undefined;
    Ascender: number | undefined;
    Descender: number | undefined;
    StdHW: number;
    StdVW: number;
    IsFixedPitch: boolean;
    /**
     * [llx lly urx ury]:
     *   Font bounding box where llx, lly, urx, and ury are all numbers.
     */
    FontBBox: [number, number, number, number];
    CharMetrics: ICharMetrics[];
    KernPairs: IKernPair[];
    private CharWidths;
    private KernPairXAmounts;
    private constructor();
    getWidthOfGlyph: (glyphName: string) => number | undefined;
    getXAxisKerningForPair: (leftGlyphName: string, rightGlyphName: string) => number | undefined;
}
export {};
//# sourceMappingURL=Font.d.ts.map