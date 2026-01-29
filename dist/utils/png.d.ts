export declare enum PngType {
    Greyscale = "Greyscale",
    Truecolour = "Truecolour",
    IndexedColour = "IndexedColour",
    GreyscaleWithAlpha = "GreyscaleWithAlpha",
    TruecolourWithAlpha = "TruecolourWithAlpha"
}
export declare class PNG {
    static load: (pngData: Uint8Array<ArrayBuffer>) => PNG;
    readonly rgbChannel: Uint8Array<ArrayBuffer>;
    readonly alphaChannel?: Uint8Array<ArrayBuffer>;
    readonly type: PngType;
    readonly width: number;
    readonly height: number;
    readonly bitsPerComponent: number;
    private constructor();
}
//# sourceMappingURL=png.d.ts.map