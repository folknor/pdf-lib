import * as r from '../vendors/restructure/index.js';
import TTFFont from './TTFFont.js';
export default class WOFFFont extends TTFFont {
    type: string;
    static probe(buffer: Uint8Array): boolean;
    _decodeDirectory(): void;
    _getTableStream(tag: string): r.DecodeStream | null;
}
//# sourceMappingURL=WOFFFont.d.ts.map