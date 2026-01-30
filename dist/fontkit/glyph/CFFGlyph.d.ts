import Glyph from './Glyph.js';
import Path from './Path.js';
/**
 * Represents an OpenType PostScript glyph, in the Compact Font Format.
 */
export default class CFFGlyph extends Glyph {
    type: string;
    _usedGsubrs?: Record<number, boolean>;
    _usedSubrs?: Record<number, boolean>;
    _getName(): string | null | undefined;
    bias(s: unknown[]): number;
    _getPath(): Path;
}
//# sourceMappingURL=CFFGlyph.d.ts.map