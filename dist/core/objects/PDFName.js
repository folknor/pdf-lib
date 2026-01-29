import { charFromHexCode, copyStringIntoBuffer, toCharCode, toHexString, } from '../../utils/index.js';
import { PrivateConstructorError } from '../errors.js';
import CharCodes from '../syntax/CharCodes.js';
import { IsIrregular } from '../syntax/Irregular.js';
import PDFObject from './PDFObject.js';
const decodeName = (name) => name.replace(/#([\dABCDEF]{2})/g, (_, hex) => charFromHexCode(hex));
const isRegularChar = (charCode) => charCode >= CharCodes.ExclamationPoint &&
    charCode <= CharCodes.Tilde &&
    !IsIrregular[charCode];
const ENFORCER = {};
const pool = new Map();
class PDFName extends PDFObject {
    static of = (name) => {
        const decodedValue = decodeName(name);
        let instance = pool.get(decodedValue);
        if (!instance) {
            instance = new PDFName(ENFORCER, decodedValue);
            pool.set(decodedValue, instance);
        }
        return instance;
    };
    /* tslint:disable member-ordering */
    // Stream
    static Length = PDFName.of('Length');
    static Filter = PDFName.of('Filter');
    static FlateDecode = PDFName.of('FlateDecode');
    // Document structure
    static Type = PDFName.of('Type');
    static Subtype = PDFName.of('Subtype');
    static Parent = PDFName.of('Parent');
    static Kids = PDFName.of('Kids');
    static Count = PDFName.of('Count');
    static Catalog = PDFName.of('Catalog');
    static Pages = PDFName.of('Pages');
    static Page = PDFName.of('Page');
    // Page
    static Contents = PDFName.of('Contents');
    static Resources = PDFName.of('Resources');
    static MediaBox = PDFName.of('MediaBox');
    static CropBox = PDFName.of('CropBox');
    static BleedBox = PDFName.of('BleedBox');
    static TrimBox = PDFName.of('TrimBox');
    static ArtBox = PDFName.of('ArtBox');
    static Rotate = PDFName.of('Rotate');
    static Annots = PDFName.of('Annots');
    // Resources
    static Font = PDFName.of('Font');
    static XObject = PDFName.of('XObject');
    static ExtGState = PDFName.of('ExtGState');
    static ColorSpace = PDFName.of('ColorSpace');
    static Pattern = PDFName.of('Pattern');
    static Shading = PDFName.of('Shading');
    static Properties = PDFName.of('Properties');
    // XObject subtypes
    static Form = PDFName.of('Form');
    static Image = PDFName.of('Image');
    // Form fields
    static Off = PDFName.of('Off');
    static Yes = PDFName.of('Yes');
    static Opt = PDFName.of('Opt');
    // Names / Embedded files
    static Names = PDFName.of('Names');
    static EmbeddedFiles = PDFName.of('EmbeddedFiles');
    // Metadata
    static Title = PDFName.of('Title');
    static Author = PDFName.of('Author');
    static Subject = PDFName.of('Subject');
    static Creator = PDFName.of('Creator');
    static Keywords = PDFName.of('Keywords');
    static Producer = PDFName.of('Producer');
    static CreationDate = PDFName.of('CreationDate');
    static ModDate = PDFName.of('ModDate');
    /* tslint:enable member-ordering */
    encodedName;
    constructor(enforcer, name) {
        if (enforcer !== ENFORCER)
            throw new PrivateConstructorError('PDFName');
        super();
        let encodedName = '/';
        for (let idx = 0, len = name.length; idx < len; idx++) {
            const character = name[idx];
            const code = toCharCode(character);
            encodedName += isRegularChar(code) ? character : `#${toHexString(code)}`;
        }
        this.encodedName = encodedName;
    }
    asBytes() {
        const bytes = [];
        let hex = '';
        let escaped = false;
        const pushByte = (byte) => {
            if (byte !== undefined)
                bytes.push(byte);
            escaped = false;
        };
        for (let idx = 1, len = this.encodedName.length; idx < len; idx++) {
            const char = this.encodedName[idx];
            const byte = toCharCode(char);
            const nextChar = this.encodedName[idx + 1];
            if (!escaped) {
                if (byte === CharCodes.Hash)
                    escaped = true;
                else
                    pushByte(byte);
            }
            else {
                if ((byte >= CharCodes.Zero && byte <= CharCodes.Nine) ||
                    (byte >= CharCodes.a && byte <= CharCodes.f) ||
                    (byte >= CharCodes.A && byte <= CharCodes.F)) {
                    hex += char;
                    if (hex.length === 2 ||
                        !((nextChar !== undefined && nextChar >= '0' && nextChar <= '9') ||
                            (nextChar !== undefined && nextChar >= 'a' && nextChar <= 'f') ||
                            (nextChar !== undefined && nextChar >= 'A' && nextChar <= 'F'))) {
                        pushByte(parseInt(hex, 16));
                        hex = '';
                    }
                }
                else {
                    pushByte(byte);
                }
            }
        }
        return new Uint8Array(bytes);
    }
    // TODO: This should probably use `utf8Decode()`
    // TODO: Polyfill Array.from?
    decodeText() {
        const bytes = this.asBytes();
        return String.fromCharCode(...Array.from(bytes));
    }
    asString() {
        return this.encodedName;
    }
    /** @deprecated in favor of [[PDFName.asString]] */
    value() {
        return this.encodedName;
    }
    clone() {
        return this;
    }
    toString() {
        return this.encodedName;
    }
    sizeInBytes() {
        return this.encodedName.length;
    }
    copyBytesInto(buffer, offset) {
        copyStringIntoBuffer(this.encodedName, buffer, offset);
        return this.encodedName.length;
    }
}
export default PDFName;
//# sourceMappingURL=PDFName.js.map