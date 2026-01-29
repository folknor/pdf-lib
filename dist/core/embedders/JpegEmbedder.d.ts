import type PDFRef from '../objects/PDFRef.js';
import type PDFContext from '../PDFContext.js';
declare enum ColorSpace {
    DeviceGray = "DeviceGray",
    DeviceRGB = "DeviceRGB",
    DeviceCMYK = "DeviceCMYK"
}
/**
 * EXIF orientation values:
 * 1: Normal (no transformation)
 * 2: Horizontal flip
 * 3: Rotate 180 degrees
 * 4: Vertical flip
 * 5: Rotate 90 CW + horizontal flip
 * 6: Rotate 90 CW
 * 7: Rotate 90 CW + vertical flip
 * 8: Rotate 270 CW (90 CCW)
 */
export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | undefined;
/**
 * A note of thanks to the developers of https://github.com/foliojs/pdfkit, as
 * this class borrows from:
 *   https://github.com/foliojs/pdfkit/blob/a6af76467ce06bd6a2af4aa7271ccac9ff152a7d/lib/image/jpeg.js
 */
declare class JpegEmbedder {
    static for(imageData: Uint8Array): Promise<JpegEmbedder>;
    readonly bitsPerComponent: number;
    readonly height: number;
    readonly width: number;
    readonly colorSpace: ColorSpace;
    readonly orientation: ExifOrientation;
    private readonly imageData;
    private constructor();
    embedIntoContext(context: PDFContext, ref?: PDFRef): Promise<PDFRef>;
}
export default JpegEmbedder;
//# sourceMappingURL=JpegEmbedder.d.ts.map