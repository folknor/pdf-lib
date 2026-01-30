import PDFArray from '../objects/PDFArray.js';
import type PDFDict from '../objects/PDFDict.js';
import PDFHexString from '../objects/PDFHexString.js';
import PDFNumber from '../objects/PDFNumber.js';
import PDFString from '../objects/PDFString.js';
declare class AppearanceCharacteristics {
    readonly dict: PDFDict;
    static fromDict: (dict: PDFDict) => AppearanceCharacteristics;
    protected constructor(dict: PDFDict);
    R(): PDFNumber | undefined;
    BC(): PDFArray | undefined;
    BG(): PDFArray | undefined;
    CA(): PDFHexString | PDFString | undefined;
    RC(): PDFHexString | PDFString | undefined;
    AC(): PDFHexString | PDFString | undefined;
    getRotation(): number | undefined;
    getBorderColor(): number[] | undefined;
    getBackgroundColor(): number[] | undefined;
    getCaptions(): {
        normal: string | undefined;
        rollover: string | undefined;
        down: string | undefined;
    };
    setRotation(rotation: number): void;
    setBorderColor(color: number[]): void;
    setBackgroundColor(color: number[]): void;
    clearBackgroundColor(): void;
    setCaptions(captions: {
        normal: string;
        rollover?: string;
        down?: string;
    }): void;
}
export default AppearanceCharacteristics;
//# sourceMappingURL=AppearanceCharacteristics.d.ts.map