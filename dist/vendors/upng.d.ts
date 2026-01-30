/**
 * UPNG.js - PNG decoder
 * Originally from https://github.com/photopea/UPNG.js
 * Absorbed and converted to TypeScript for pdf-lib
 *
 * Only includes decoding functionality (decode + toRGBA8)
 */
export interface PNGImage {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    data: Uint8Array;
    tabs: PNGTabs;
    frames: PNGFrame[];
}
interface PNGTabs {
    acTL?: {
        num_frames: number;
        num_plays: number;
    };
    PLTE?: number[];
    tRNS?: number | number[];
    iCCP?: Uint8Array;
    CgBI?: Uint8Array;
    pHYs?: [number, number, number];
    cHRM?: number[];
    tEXt?: Record<string, string>;
    zTXt?: Record<string, string>;
    iTXt?: Record<string, string>;
    gAMA?: number;
    sRGB?: number;
    bKGD?: number | number[];
    [key: string]: unknown;
}
interface PNGFrame {
    rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    delay: number;
    dispose: number;
    blend: number;
    data?: Uint8Array;
}
/**
 * Convert decoded PNG to RGBA8 format
 */
export declare function toRGBA8(out: PNGImage): ArrayBuffer[];
/**
 * Decode PNG data
 */
export declare function decode(buff: ArrayBuffer): PNGImage;
declare const UPNG: {
    decode: typeof decode;
    toRGBA8: typeof toRGBA8;
};
export default UPNG;
//# sourceMappingURL=upng.d.ts.map