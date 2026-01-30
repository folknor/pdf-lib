import * as r from '../vendors/restructure/index.js';
import TTFFont from './TTFFont.js';
export default class TrueTypeCollection {
    type: string;
    stream: r.DecodeStream;
    header: any;
    static probe(buffer: Uint8Array): boolean;
    constructor(stream: r.DecodeStream);
    getFont(name: string | Uint8Array): TTFFont | null;
    get fonts(): any[];
}
//# sourceMappingURL=TrueTypeCollection.d.ts.map