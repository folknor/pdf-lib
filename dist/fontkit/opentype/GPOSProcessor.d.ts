import type GlyphPosition from '../layout/GlyphPosition.js';
import type GlyphInfo from './GlyphInfo.js';
import OTProcessor from './OTProcessor.js';
export default class GPOSProcessor extends OTProcessor {
    applyPositionValue(sequenceIndex: number, value: any): void;
    applyLookup(lookupType: number, table: any): boolean;
    applyAnchor(markRecord: any, baseAnchor: any, baseGlyphIndex: number): void;
    getAnchor(anchor: any): {
        x: number;
        y: number;
    };
    applyFeatures(userFeatures: string[], glyphs: GlyphInfo[], advances?: GlyphPosition[]): void;
    fixCursiveAttachment(i: number): void;
    fixMarkAttachment(): void;
}
//# sourceMappingURL=GPOSProcessor.d.ts.map