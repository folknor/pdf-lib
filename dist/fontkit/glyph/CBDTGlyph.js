import Glyph from './Glyph.js';
/**
 * Bitmap glyph in CBDT/CBLC (or EBDT/EBLC) format, e.g. color emoji. There is
 * no vector outline; metrics come from hmtx via Glyph._getMetrics().
 */
export default class CBDTGlyph extends Glyph {
    type = 'CBDT';
}
//# sourceMappingURL=CBDTGlyph.js.map