const resolved = Promise.resolve();
export default class Subset {
    font;
    glyphs;
    mapping;
    constructor(font) {
        this.font = font;
        this.glyphs = [];
        this.mapping = {};
        // always include the missing glyph
        this.includeGlyph(0);
    }
    includeGlyph(glyph) {
        if (typeof glyph === 'object') {
            glyph = glyph.id;
        }
        if (this.mapping[glyph] == null) {
            this.glyphs.push(glyph);
            this.mapping[glyph] = this.glyphs.length - 1;
        }
        return this.mapping[glyph];
    }
    encode() {
        throw new Error('encode() must be implemented by subclass');
    }
    // Returns a stream-like object for encoding the subset
    // This provides compatibility with code expecting Node.js stream interface
    encodeStream() {
        const handlers = {};
        const stream = {
            on(event, handler) {
                handlers[event] = handler;
                return stream;
            },
        };
        // Encode asynchronously to allow event handlers to be registered
        void resolved.then(() => {
            try {
                const data = this.encode();
                if (handlers['data']) {
                    handlers['data'](data);
                }
                if (handlers['end']) {
                    handlers['end']();
                }
            }
            catch (err) {
                if (handlers['error']) {
                    handlers['error'](err);
                }
            }
        });
        return stream;
    }
}
//# sourceMappingURL=Subset.js.map