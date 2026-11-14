import type GlyphInfo from './GlyphInfo.js';

export interface GlyphIteratorOptions {
  flags?: {
    rightToLeft?: boolean;
    ignoreMarks?: boolean;
    ignoreBaseGlyphs?: boolean;
    ignoreLigatures?: boolean;
    useMarkFilteringSet?: boolean;
  };
  markAttachmentType?: number;
  /**
   * The lookup's mark filtering set (lookupFlag UseMarkFilteringSet) as a
   * membership test on the glyph's current id. When present, a mark outside
   * it is skipped and `markAttachmentType` is not consulted.
   */
  markFilter?: (glyphId: number) => boolean;
}

export default class GlyphIterator {
  glyphs: GlyphInfo[];
  options: GlyphIteratorOptions;
  flags: NonNullable<GlyphIteratorOptions['flags']>;
  markAttachmentType: number;
  markFilter: ((glyphId: number) => boolean) | undefined;
  index: number;

  constructor(glyphs: GlyphInfo[], options?: GlyphIteratorOptions) {
    this.glyphs = glyphs;
    this.options = {};
    this.flags = {};
    this.markAttachmentType = 0;
    this.markFilter = undefined;
    this.index = 0;
    this.reset(options);
  }

  reset(options: GlyphIteratorOptions = {}, index: number = 0): void {
    this.options = options;
    this.flags = options.flags || {};
    this.markAttachmentType = options.markAttachmentType || 0;
    this.markFilter = options.markFilter;
    this.index = index;
  }

  get cur(): GlyphInfo | null {
    return this.glyphs[this.index] || null;
  }

  shouldIgnore(glyph: GlyphInfo): boolean {
    if (
      (this.flags.ignoreMarks && glyph.isMark) ||
      (this.flags.ignoreBaseGlyphs && glyph.isBase) ||
      (this.flags.ignoreLigatures && glyph.isLigature)
    ) {
      return true;
    }

    if (!glyph.isMark) {
      return false;
    }

    if (this.markFilter) {
      return !this.markFilter(glyph.id);
    }

    return !!(
      this.markAttachmentType &&
      glyph.markAttachmentType !== this.markAttachmentType
    );
  }

  move(dir: number): GlyphInfo | null {
    this.index += dir;

    while (
      0 <= this.index &&
      this.index < this.glyphs.length &&
      this.shouldIgnore(this.glyphs[this.index]!)
    ) {
      this.index += dir;
    }

    if (0 > this.index || this.index >= this.glyphs.length) {
      return null;
    }

    return this.glyphs[this.index] ?? null;
  }

  next(): GlyphInfo | null {
    return this.move(+1);
  }

  prev(): GlyphInfo | null {
    return this.move(-1);
  }

  peek(count: number = 1): GlyphInfo | null {
    const idx = this.index;
    const res = this.increment(count);
    this.index = idx;

    return res;
  }

  peekIndex(count: number = 1): number {
    const idx = this.index;
    this.increment(count);
    const res = this.index;
    this.index = idx;

    return res;
  }

  increment(count: number = 1): GlyphInfo | null {
    const dir = count < 0 ? -1 : 1;
    count = Math.abs(count);

    while (count--) {
      this.move(dir);
    }

    return this.glyphs[this.index] ?? null;
  }
}
