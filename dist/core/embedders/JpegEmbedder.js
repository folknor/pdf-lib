// prettier-ignore
const MARKERS = [
    0xffc0, 0xffc1, 0xffc2, 0xffc3, 0xffc5, 0xffc6, 0xffc7, 0xffc8, 0xffc9,
    0xffca, 0xffcb, 0xffcc, 0xffcd, 0xffce, 0xffcf,
];
var ColorSpace;
(function (ColorSpace) {
    ColorSpace["DeviceGray"] = "DeviceGray";
    ColorSpace["DeviceRGB"] = "DeviceRGB";
    ColorSpace["DeviceCMYK"] = "DeviceCMYK";
})(ColorSpace || (ColorSpace = {}));
const ChannelToColorSpace = {
    1: ColorSpace.DeviceGray,
    3: ColorSpace.DeviceRGB,
    4: ColorSpace.DeviceCMYK,
};
const APP1_MARKER = 0xffe1;
const EXIF_HEADER = 0x45786966; // "Exif"
const ORIENTATION_TAG = 0x0112;
/**
 * Parse EXIF orientation from JPEG data.
 * Returns undefined if no EXIF orientation is found.
 */
function parseExifOrientation(dataView) {
    let pos = 2; // Skip SOI marker
    while (pos < dataView.byteLength - 4) {
        const marker = dataView.getUint16(pos);
        // Stop at SOS (Start of Scan) - no more metadata after this
        if (marker === 0xffda)
            break;
        // Skip non-marker bytes
        if ((marker & 0xff00) !== 0xff00) {
            pos++;
            continue;
        }
        const segmentLength = dataView.getUint16(pos + 2);
        if (marker === APP1_MARKER) {
            // Check for "Exif\0\0" identifier
            if (pos + 10 < dataView.byteLength &&
                dataView.getUint32(pos + 4) === EXIF_HEADER &&
                dataView.getUint16(pos + 8) === 0x0000) {
                const tiffOffset = pos + 10;
                // Read byte order (II = little endian, MM = big endian)
                const byteOrder = dataView.getUint16(tiffOffset);
                const isLittleEndian = byteOrder === 0x4949;
                // Validate TIFF magic number (42)
                const magic = isLittleEndian
                    ? dataView.getUint16(tiffOffset + 2, true)
                    : dataView.getUint16(tiffOffset + 2, false);
                if (magic !== 42) {
                    pos += 2 + segmentLength;
                    continue;
                }
                // Get offset to IFD0
                const ifdOffset = isLittleEndian
                    ? dataView.getUint32(tiffOffset + 4, true)
                    : dataView.getUint32(tiffOffset + 4, false);
                const ifdStart = tiffOffset + ifdOffset;
                if (ifdStart + 2 > dataView.byteLength) {
                    pos += 2 + segmentLength;
                    continue;
                }
                // Read number of IFD entries
                const numEntries = isLittleEndian
                    ? dataView.getUint16(ifdStart, true)
                    : dataView.getUint16(ifdStart, false);
                // Search for orientation tag
                for (let i = 0; i < numEntries; i++) {
                    const entryOffset = ifdStart + 2 + i * 12;
                    if (entryOffset + 12 > dataView.byteLength)
                        break;
                    const tag = isLittleEndian
                        ? dataView.getUint16(entryOffset, true)
                        : dataView.getUint16(entryOffset, false);
                    if (tag === ORIENTATION_TAG) {
                        const value = isLittleEndian
                            ? dataView.getUint16(entryOffset + 8, true)
                            : dataView.getUint16(entryOffset + 8, false);
                        if (value >= 1 && value <= 8) {
                            return value;
                        }
                    }
                }
            }
        }
        pos += 2 + segmentLength;
    }
    return undefined;
}
/**
 * A note of thanks to the developers of https://github.com/foliojs/pdfkit, as
 * this class borrows from:
 *   https://github.com/foliojs/pdfkit/blob/a6af76467ce06bd6a2af4aa7271ccac9ff152a7d/lib/image/jpeg.js
 */
class JpegEmbedder {
    static async for(imageData) {
        const dataView = new DataView(imageData.buffer, imageData.byteOffset, imageData.byteLength);
        const soi = dataView.getUint16(0);
        if (soi !== 0xffd8)
            throw new Error('SOI not found in JPEG');
        let pos = 2;
        let marker;
        while (pos < dataView.byteLength) {
            marker = dataView.getUint16(pos);
            pos += 2;
            if (MARKERS.includes(marker))
                break;
            pos += dataView.getUint16(pos);
        }
        if (!MARKERS.includes(marker))
            throw new Error('Invalid JPEG');
        pos += 2;
        const bitsPerComponent = dataView.getUint8(pos++);
        const height = dataView.getUint16(pos);
        pos += 2;
        const width = dataView.getUint16(pos);
        pos += 2;
        const channelByte = dataView.getUint8(pos++);
        const channelName = ChannelToColorSpace[channelByte];
        if (!channelName)
            throw new Error('Unknown JPEG channel.');
        const colorSpace = channelName;
        // Parse EXIF orientation
        const orientation = parseExifOrientation(dataView);
        return new JpegEmbedder(imageData, bitsPerComponent, width, height, colorSpace, orientation);
    }
    bitsPerComponent;
    height;
    width;
    colorSpace;
    orientation;
    imageData;
    constructor(imageData, bitsPerComponent, width, height, colorSpace, orientation) {
        this.imageData = imageData;
        this.bitsPerComponent = bitsPerComponent;
        this.width = width;
        this.height = height;
        this.colorSpace = colorSpace;
        this.orientation = orientation;
    }
    async embedIntoContext(context, ref) {
        const xObject = context.stream(this.imageData, {
            Type: 'XObject',
            Subtype: 'Image',
            BitsPerComponent: this.bitsPerComponent,
            Width: this.width,
            Height: this.height,
            ColorSpace: this.colorSpace,
            Filter: 'DCTDecode',
            // CMYK JPEG streams in PDF are typically stored complemented,
            // with 1 as 'off' and 0 as 'on' (PDF 32000-1:2008, 8.6.4.4).
            //
            // Standalone CMYK JPEG (usually exported by Photoshop) are
            // stored inverse, with 0 as 'off' and 1 as 'on', like RGB.
            //
            // Applying a swap here as a hedge that most bytes passing
            // through this method will benefit from it.
            Decode: this.colorSpace === ColorSpace.DeviceCMYK
                ? [1, 0, 1, 0, 1, 0, 1, 0]
                : undefined,
        });
        if (ref) {
            context.assign(ref, xObject);
            return ref;
        }
        else {
            return context.register(xObject);
        }
    }
}
export default JpegEmbedder;
//# sourceMappingURL=JpegEmbedder.js.map