import inflate from 'tiny-inflate';
import * as r from '../vendors/restructure/index.js';
import TTFFont from './TTFFont.js';
import WOFFDirectory from './tables/WOFFDirectory.js';
import { asciiDecoder } from './utils.js';
export default class WOFFFont extends TTFFont {
    type = 'WOFF';
    static probe(buffer) {
        return asciiDecoder.decode(buffer.slice(0, 4)) === 'wOFF';
    }
    _decodeDirectory() {
        this.directory = WOFFDirectory.decode(this.stream, { _startOffset: 0 });
    }
    _getTableStream(tag) {
        const table = this.directory.tables[tag];
        if (table) {
            this.stream.pos = table.offset;
            if (table.compLength < table.length) {
                this.stream.pos += 2; // skip deflate header
                const outBuffer = new Uint8Array(table.length);
                const buf = inflate(this.stream.readBuffer(table.compLength - 2), outBuffer);
                return new r.DecodeStream(buf);
            }
            else {
                return this.stream;
            }
        }
        return null;
    }
}
//# sourceMappingURL=WOFFFont.js.map