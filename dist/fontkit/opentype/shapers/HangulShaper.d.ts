import GlyphInfo from '../GlyphInfo.js';
import type ShapingPlan from '../ShapingPlan.js';
import DefaultShaper from './DefaultShaper.js';
/**
 * This is a shaper for the Hangul script, used by the Korean language.
 * It does the following:
 *   - decompose if unsupported by the font:
 *     <LV>   -> <L,V>
 *     <LVT>  -> <L,V,T>
 *     <LV,T> -> <L,V,T>
 *
 *   - compose if supported by the font:
 *     <L,V>   -> <LV>
 *     <L,V,T> -> <LVT>
 *     <LV,T>  -> <LVT>
 *
 *   - reorder tone marks (S is any valid syllable):
 *     <S, M> -> <M, S>
 *
 *   - apply ljmo, vjmo, and tjmo OpenType features to decomposed Jamo sequences.
 *
 * This logic is based on the following documents:
 *   - http://www.microsoft.com/typography/OpenTypeDev/hangul/intro.htm
 *   - http://ktug.org/~nomos/harfbuzz-hangul/hangulshaper.pdf
 */
export default class HangulShaper extends DefaultShaper {
    static zeroMarkWidths: string;
    static planFeatures(plan: ShapingPlan): void;
    static assignFeatures(plan: ShapingPlan, glyphs: GlyphInfo[]): void;
}
//# sourceMappingURL=HangulShaper.d.ts.map