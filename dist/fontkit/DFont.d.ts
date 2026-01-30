import * as r from '../vendors/restructure/index.js';
import TTFFont from './TTFFont.js';
export default class DFont {
    type: string;
    stream: r.DecodeStream;
    header: any;
    sfnt: any;
    static probe(buffer: Uint8Array): boolean;
    constructor(stream: r.DecodeStream);
    getFont(name: string | Uint8Array): TTFFont | null;
    get fonts(): TTFFont[];
}
//# sourceMappingURL=DFont.d.ts.map