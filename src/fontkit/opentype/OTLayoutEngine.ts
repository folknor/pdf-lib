import type GlyphPosition from '../layout/GlyphPosition.js';
import type GlyphRun from '../layout/GlyphRun.js';
import GlyphInfo from './GlyphInfo.js';
import GPOSProcessor from './GPOSProcessor.js';
import GSUBProcessor from './GSUBProcessor.js';
import ShapingPlan from './ShapingPlan.js';
import * as Shapers from './shapers/index.js';

export default class OTLayoutEngine {
  font: any;
  glyphInfos: GlyphInfo[] | null;
  plan: ShapingPlan | null;
  GSUBProcessor: GSUBProcessor | null;
  GPOSProcessor: GPOSProcessor | null;
  fallbackPosition: boolean;
  shaper: any;

  constructor(font: any) {
    this.font = font;
    this.glyphInfos = null;
    this.plan = null;
    this.GSUBProcessor = null;
    this.GPOSProcessor = null;
    this.fallbackPosition = true;

    if (font.GSUB) {
      this.GSUBProcessor = new GSUBProcessor(font, font.GSUB);
    }

    if (font.GPOS) {
      this.GPOSProcessor = new GPOSProcessor(font, font.GPOS);
    }
  }

  setup(glyphRun: GlyphRun): void {
    // Map glyphs to GlyphInfo objects so data can be passed between
    // GSUB and GPOS without mutating the real (shared) Glyph objects. Each
    // starts from its occurrence's code points, never from the glyph.
    this.glyphInfos = glyphRun.glyphs.map(
      (glyph, i) =>
        new GlyphInfo(
          this.font,
          glyph.id,
          [...glyphRun.codePoints[i]!],
          undefined,
          [...glyphRun.text[i]!],
        ),
    );

    // Select a script based on what is available in GSUB/GPOS.
    let script: string | null = null;
    if (this.GPOSProcessor) {
      script = this.GPOSProcessor.selectScript(
        glyphRun.script,
        glyphRun.language,
        glyphRun.direction,
      );
    }

    if (this.GSUBProcessor) {
      script = this.GSUBProcessor.selectScript(
        glyphRun.script,
        glyphRun.language,
        glyphRun.direction,
      );
    }

    // Choose a shaper based on the script, and setup a shaping plan.
    // This determines which features to apply to which glyphs.
    this.shaper = Shapers.choose(script ?? 'DFLT');
    this.plan = new ShapingPlan(
      this.font,
      script ?? 'DFLT',
      glyphRun.direction,
    );
    this.shaper.plan(this.plan, this.glyphInfos, glyphRun.features);

    // Report chosen features on the run, keeping a requested alternate
    // number (a planned key never holds a user `false`: overrides unplan it).
    for (const key in this.plan.allFeatures) {
      if (typeof glyphRun.features[key] !== 'number') {
        glyphRun.features[key] = true;
      }
    }
  }

  substitute(glyphRun: GlyphRun): void {
    if (this.plan && this.glyphInfos) {
      if (this.GSUBProcessor) {
        this.plan.process(this.GSUBProcessor, this.glyphInfos);
      }

      // Map glyph infos back to normal Glyph objects. Done with or without
      // GSUB: the shaper's assignFeatures may already have composed,
      // decomposed or inserted glyphs, and GPOS and the positions built from
      // glyphRun.glyphs must see the same sequence.
      glyphRun.glyphs = this.glyphInfos.map((glyphInfo) =>
        this.font.getGlyph(glyphInfo.id),
      );
      glyphRun.codePoints = this.glyphInfos.map((info) => [...info.codePoints]);
      glyphRun.text = this.glyphInfos.map((info) => [...info.text]);
    }
  }

  position(glyphRun: GlyphRun): Record<string, any> | undefined {
    if (this.shaper.zeroMarkWidths === 'BEFORE_GPOS' && glyphRun.positions) {
      this.zeroMarkAdvances(glyphRun.positions);
    }

    if (
      this.GPOSProcessor &&
      this.plan &&
      this.glyphInfos &&
      glyphRun.positions
    ) {
      this.plan.process(
        this.GPOSProcessor,
        this.glyphInfos,
        glyphRun.positions,
      );
    }

    if (this.shaper.zeroMarkWidths === 'AFTER_GPOS' && glyphRun.positions) {
      this.zeroMarkAdvances(glyphRun.positions);
    }

    // Record which glyphs are marks and what GPOS attached them to, so text
    // drawn with extra spacing can keep them at their anchors.
    const rtl = glyphRun.direction === 'rtl';
    if (this.glyphInfos && glyphRun.positions) {
      const last = this.glyphInfos.length - 1;
      for (let i = 0; i <= last; i++) {
        const info = this.glyphInfos[i]!;
        const position = glyphRun.positions[i];
        if (!position) continue;
        position.isMark = info.isMark;
        const base = info.markAttachment;
        position.attachedTo = base == null ? null : rtl ? last - base : base;
      }
    }

    // Reverse the glyphs and positions if the script is right-to-left
    if (rtl && glyphRun.positions) {
      glyphRun.glyphs.reverse();
      glyphRun.codePoints.reverse();
      glyphRun.text.reverse();
      glyphRun.positions.reverse();
    }

    return this.GPOSProcessor?.features;
  }

  zeroMarkAdvances(positions: GlyphPosition[]): void {
    if (!this.glyphInfos) return;
    for (let i = 0; i < this.glyphInfos.length; i++) {
      if (this.glyphInfos[i]!.isMark) {
        positions[i]!.xAdvance = 0;
        positions[i]!.yAdvance = 0;
      }
    }
  }

  cleanup(): void {
    this.glyphInfos = null;
    this.plan = null;
    this.shaper = null;
  }

  getAvailableFeatures(script: string, language?: string): string[] {
    const features: string[] = [];

    if (this.GSUBProcessor) {
      this.GSUBProcessor.selectScript(script, language);
      features.push(...Object.keys(this.GSUBProcessor.features));
    }

    if (this.GPOSProcessor) {
      this.GPOSProcessor.selectScript(script, language);
      features.push(...Object.keys(this.GPOSProcessor.features));
    }

    return features;
  }
}
