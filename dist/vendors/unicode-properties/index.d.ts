/**
 * Unicode Properties - Fast access to Unicode character properties
 * Originally from https://github.com/foliojs/unicode-properties
 * Absorbed and converted to TypeScript for pdf-lib
 */
export declare function getCategory(codePoint: number): string;
export declare function getCombiningClass(codePoint: number): string;
export declare function getScript(codePoint: number): string;
export declare function getEastAsianWidth(codePoint: number): string;
export declare function getNumericValue(codePoint: number): number | null;
export declare function isAlphabetic(codePoint: number): boolean;
export declare function isDigit(codePoint: number): boolean;
export declare function isPunctuation(codePoint: number): boolean;
export declare function isLowerCase(codePoint: number): boolean;
export declare function isUpperCase(codePoint: number): boolean;
export declare function isTitleCase(codePoint: number): boolean;
export declare function isWhiteSpace(codePoint: number): boolean;
export declare function isBaseForm(codePoint: number): boolean;
export declare function isMark(codePoint: number): boolean;
declare const _default: {
    getCategory: typeof getCategory;
    getCombiningClass: typeof getCombiningClass;
    getScript: typeof getScript;
    getEastAsianWidth: typeof getEastAsianWidth;
    getNumericValue: typeof getNumericValue;
    isAlphabetic: typeof isAlphabetic;
    isDigit: typeof isDigit;
    isPunctuation: typeof isPunctuation;
    isLowerCase: typeof isLowerCase;
    isUpperCase: typeof isUpperCase;
    isTitleCase: typeof isTitleCase;
    isWhiteSpace: typeof isWhiteSpace;
    isBaseForm: typeof isBaseForm;
    isMark: typeof isMark;
};
export default _default;
//# sourceMappingURL=index.d.ts.map