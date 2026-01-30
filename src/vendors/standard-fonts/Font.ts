/**
 * Standard Fonts - Font class
 * Originally from https://github.com/Hopding/standard-fonts
 * Absorbed and converted for pdf-lib
 */

import CourierCompressed from './data/Courier.compressed.json' with {
  type: 'json',
};

// Import compressed font data
import CourierBoldCompressed from './data/Courier-Bold.compressed.json' with {
  type: 'json',
};
import CourierBoldObliqueCompressed from './data/Courier-BoldOblique.compressed.json' with {
  type: 'json',
};
import CourierObliqueCompressed from './data/Courier-Oblique.compressed.json' with {
  type: 'json',
};
import HelveticaCompressed from './data/Helvetica.compressed.json' with {
  type: 'json',
};
import HelveticaBoldCompressed from './data/Helvetica-Bold.compressed.json' with {
  type: 'json',
};
import HelveticaBoldObliqueCompressed from './data/Helvetica-BoldOblique.compressed.json' with {
  type: 'json',
};
import HelveticaObliqueCompressed from './data/Helvetica-Oblique.compressed.json' with {
  type: 'json',
};
import SymbolCompressed from './data/Symbol.compressed.json' with {
  type: 'json',
};
import TimesBoldCompressed from './data/Times-Bold.compressed.json' with {
  type: 'json',
};
import TimesBoldItalicCompressed from './data/Times-BoldItalic.compressed.json' with {
  type: 'json',
};
import TimesItalicCompressed from './data/Times-Italic.compressed.json' with {
  type: 'json',
};
import TimesRomanCompressed from './data/Times-Roman.compressed.json' with {
  type: 'json',
};
import ZapfDingbatsCompressed from './data/ZapfDingbats.compressed.json' with {
  type: 'json',
};
import { decompressJson } from './utils.js';

const compressedJsonForFontName: Record<string, string> = {
  Courier: CourierCompressed as unknown as string,
  'Courier-Bold': CourierBoldCompressed as unknown as string,
  'Courier-Oblique': CourierObliqueCompressed as unknown as string,
  'Courier-BoldOblique': CourierBoldObliqueCompressed as unknown as string,
  Helvetica: HelveticaCompressed as unknown as string,
  'Helvetica-Bold': HelveticaBoldCompressed as unknown as string,
  'Helvetica-Oblique': HelveticaObliqueCompressed as unknown as string,
  'Helvetica-BoldOblique': HelveticaBoldObliqueCompressed as unknown as string,
  'Times-Roman': TimesRomanCompressed as unknown as string,
  'Times-Bold': TimesBoldCompressed as unknown as string,
  'Times-Italic': TimesItalicCompressed as unknown as string,
  'Times-BoldItalic': TimesBoldItalicCompressed as unknown as string,
  Symbol: SymbolCompressed as unknown as string,
  ZapfDingbats: ZapfDingbatsCompressed as unknown as string,
};

export enum FontNames {
  Courier = 'Courier',
  CourierBold = 'Courier-Bold',
  CourierOblique = 'Courier-Oblique',
  CourierBoldOblique = 'Courier-BoldOblique',
  Helvetica = 'Helvetica',
  HelveticaBold = 'Helvetica-Bold',
  HelveticaOblique = 'Helvetica-Oblique',
  HelveticaBoldOblique = 'Helvetica-BoldOblique',
  TimesRoman = 'Times-Roman',
  TimesRomanBold = 'Times-Bold',
  TimesRomanItalic = 'Times-Italic',
  TimesRomanBoldItalic = 'Times-BoldItalic',
  Symbol = 'Symbol',
  ZapfDingbats = 'ZapfDingbats',
}

export type IFontNames = FontNames | keyof typeof compressedJsonForFontName;

const fontCache: { [name in FontNames]?: Font } = {};

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

export class Font {
  static load = (fontName: IFontNames): Font => {
    const cachedFont = fontCache[fontName as FontNames];
    if (cachedFont) return cachedFont;

    const compressed = compressedJsonForFontName[fontName];
    if (!compressed) {
      throw new Error(`Unknown font: ${fontName}`);
    }
    const json = decompressJson(compressed);
    const font = Object.assign(new Font(), JSON.parse(json) as Partial<Font>);

    font.CharWidths = font.CharMetrics.reduce(
      (acc, metric) => {
        acc[metric.N] = metric.WX;
        return acc;
      },
      {} as Record<string, number>,
    );
    font.KernPairXAmounts = font.KernPairs.reduce(
      (acc, [name1, name2, width]) => {
        if (!acc[name1]) acc[name1] = {};
        acc[name1]![name2] = width;
        return acc;
      },
      {} as Record<string, Record<string, number>>,
    );

    fontCache[fontName as FontNames] = font;

    return font;
  };

  Comment!: string;
  FontName!: string;
  FullName!: string;
  FamilyName!: string;
  Weight!: string;
  CharacterSet!: string;
  Version!: string;
  Notice!: string;
  EncodingScheme!: string;
  ItalicAngle!: number;
  UnderlinePosition!: number;
  UnderlineThickness!: number;
  CapHeight!: number | undefined;
  XHeight!: number | undefined;
  Ascender!: number | undefined;
  Descender!: number | undefined;
  StdHW!: number;
  StdVW!: number;
  IsFixedPitch!: boolean;

  /**
   * [llx lly urx ury]:
   *   Font bounding box where llx, lly, urx, and ury are all numbers.
   */
  FontBBox!: [number, number, number, number];

  CharMetrics!: ICharMetrics[];
  KernPairs!: IKernPair[];

  private CharWidths!: Record<string, number>;
  private KernPairXAmounts!: Record<string, Record<string, number>>;

  private constructor() {}

  getWidthOfGlyph = (glyphName: string): number | undefined =>
    this.CharWidths[glyphName];

  getXAxisKerningForPair = (
    leftGlyphName: string,
    rightGlyphName: string,
  ): number | undefined =>
    this.KernPairXAmounts[leftGlyphName]?.[rightGlyphName];
}
