const resolved = Promise.resolve();

interface SubsetStream {
  on(event: string, handler: (data?: unknown) => void): SubsetStream;
}

export default class Subset {
  font: any;
  glyphs: number[];
  mapping: Record<number, number>;

  constructor(font: any) {
    this.font = font;
    this.glyphs = [];
    this.mapping = {};

    // always include the missing glyph
    this.includeGlyph(0);
  }

  includeGlyph(glyph: number | { id: number }): number {
    if (typeof glyph === 'object') {
      glyph = glyph.id;
    }

    if (this.mapping[glyph] == null) {
      this.glyphs.push(glyph);
      this.mapping[glyph] = this.glyphs.length - 1;
    }

    return this.mapping[glyph]!;
  }

  encode(): Uint8Array {
    throw new Error('encode() must be implemented by subclass');
  }

  // Returns a stream-like object for encoding the subset
  // This provides compatibility with code expecting Node.js stream interface
  encodeStream(): SubsetStream {
    const handlers: Record<string, (data?: unknown) => void> = {};
    const stream: SubsetStream = {
      on(event: string, handler: (data?: unknown) => void) {
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
      } catch (err) {
        if (handlers['error']) {
          handlers['error'](err);
        }
      }
    });

    return stream;
  }
}
