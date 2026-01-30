/**
 * Standard Fonts - Encoding class
 * Originally from https://github.com/Hopding/standard-fonts
 * Absorbed and converted for pdf-lib
 */
import AllEncodingsCompressed from './data/all-encodings.compressed.json' with {
    type: 'json'
};
import { decompressJson, padStart } from './utils.js';
const decompressedEncodings = decompressJson(AllEncodingsCompressed);
const allUnicodeMappings = JSON.parse(decompressedEncodings);
class Encoding {
    name;
    supportedCodePoints;
    unicodeMappings;
    constructor(name, unicodeMappings) {
        this.name = name;
        this.supportedCodePoints = Object.keys(unicodeMappings)
            .map(Number)
            .sort((a, b) => a - b);
        this.unicodeMappings = unicodeMappings;
    }
    canEncodeUnicodeCodePoint = (codePoint) => codePoint in this.unicodeMappings;
    encodeUnicodeCodePoint = (codePoint) => {
        const mapped = this.unicodeMappings[codePoint];
        if (!mapped) {
            const str = String.fromCharCode(codePoint);
            const hexCode = `0x${padStart(codePoint.toString(16), 4, '0')}`;
            const msg = `${this.name} cannot encode "${str}" (${hexCode})`;
            throw new Error(msg);
        }
        return { code: mapped[0], name: mapped[1] };
    };
}
export const Encodings = {
    Symbol: new Encoding('Symbol', allUnicodeMappings.symbol),
    ZapfDingbats: new Encoding('ZapfDingbats', allUnicodeMappings.zapfdingbats),
    WinAnsi: new Encoding('WinAnsi', allUnicodeMappings.win1252),
};
//# sourceMappingURL=Encoding.js.map