export default class GlyphInfo {
    _font: any;
    _id: number;
    codePoints: number[];
    features: Record<string, boolean>;
    ligatureID: number | null;
    ligatureComponent: number | null;
    isLigated: boolean;
    cursiveAttachment: number | null;
    markAttachment: number | null;
    shaperInfo: any;
    substituted: boolean;
    isMultiplied: boolean;
    isBase: boolean;
    isLigature: boolean;
    isMark: boolean;
    markAttachmentType: number;
    constructor(font: any, id: number, codePoints?: number[], features?: string[] | Record<string, boolean>);
    get id(): number;
    set id(id: number);
    copy(): GlyphInfo;
}
//# sourceMappingURL=GlyphInfo.d.ts.map