import AATLayoutEngine from "../aat/AATLayoutEngine.js";
import OTLayoutEngine from "../opentype/OTLayoutEngine.js";
import { composeCanonical } from "./CanonicalCompose.js";
import { initialClusters, isDefaultIgnorable, mergeClusters } from "./Clusters.js";
import type { FeatureValue } from "./FeatureValues.js";
import GlyphPosition from "./GlyphPosition.js";
import GlyphRun from "./GlyphRun.js";
import KernProcessor from "./KernProcessor.js";
import * as Script from "./Script.js";
import { decomposeSaraAm } from "./ThaiSaraAm.js";
import UnicodeLayoutEngine from "./UnicodeLayoutEngine.js";

export default class LayoutEngine {
  font: any;
  unicodeLayoutEngine: UnicodeLayoutEngine | null;
  kernProcessor: KernProcessor | null;
  engine?: AATLayoutEngine | OTLayoutEngine;

  constructor(font: any) {
    this.font = font;
    this.unicodeLayoutEngine = null;
    this.kernProcessor = null;

    // Choose an advanced layout engine. We try the AAT morx table first since more
    // scripts are currently supported because the shaping logic is built into the font.
    if (this.font.morx) {
      this.engine = new AATLayoutEngine(this.font);
    } else if (this.font.GSUB || this.font.GPOS) {
      this.engine = new OTLayoutEngine(this.font);
    }
  }

  // Text only: shaping reads the code points of each occurrence, and a glyph
  // array carries none (glyph objects are shared per id, see Glyph).
  layout(
    string: string,
    features?: string[] | Record<string, FeatureValue | undefined> | string,
    script?: string | string[] | null,
    language?: string | null,
    direction?: string | null,
  ): GlyphRun {
    // Make the features parameter optional
    if (typeof features === "string") {
      direction = language;
      language = script as string | null;
      script = features;
      features = [];
    }

    // Attempt to detect the script from the string if not provided.
    if (script == null) {
      script = Script.forString(string);
    }

    // Pick the canonically equivalent spelling the font can draw
    // (CanonicalCompose.ts). Runs for every engine, AAT included; the
    // script above was detected from the typed text.
    const hasGlyph = (cp: number): boolean => this.font.hasGlyphForCodePoint(cp);

    // Every rewrite below carries each code point's source cluster.
    const initial = initialClusters(string);

    let { codePoints: input, clusters } = composeCanonical(
      initial.codePoints,
      hasGlyph,
      initial.clusters,
      { hebrewPresentationForms: this.lacksMarkPositioning() },
    );

    // morx fonts carry their own Thai processing, so AAT is left alone.
    const first = Array.isArray(script) ? script[0] : script;

    if ((first === "thai" || first === "lao ") && !(this.engine instanceof AATLayoutEngine)) {
      ({ codePoints: input, clusters } = decomposeSaraAm(input, hasGlyph, clusters));
    }

    const { glyphs, codePoints, sources } = this.font._glyphsForCodePoints(input);

    // Normalize script to a string
    const scriptStr = Array.isArray(script) ? (script[0] ?? "zzzz") : script;

    const glyphRun = new GlyphRun(
      glyphs,
      codePoints,
      features ?? [],
      scriptStr,
      language ?? null,
      direction ?? null,
    );

    glyphRun.clusters = sources.map((source: number) => clusters[source]!);
    glyphRun.characters = initial.characters;

    // Return early if there are no glyphs
    if (glyphs.length === 0) {
      glyphRun.positions = [];

      return glyphRun;
    }

    // Setup the advanced layout engine
    if (this.engine && "setup" in this.engine && this.engine.setup) {
      this.engine.setup(glyphRun);
    }

    // Substitute and position the glyphs. Clusters are made monotone once
    // nothing reorders any more, in the order the engine left the glyphs
    // (morx works on right-to-left runs already reversed).
    this.substitute(glyphRun);
    mergeClusters(
      glyphRun.clusters,
      this.engine instanceof AATLayoutEngine && this.engine.reversesBeforeSubstitution(glyphRun),
    );
    this.position(glyphRun);

    this.hideDefaultIgnorables(glyphRun);

    // Let the layout engine clean up any state it might have
    if (this.engine && "cleanup" in this.engine && this.engine.cleanup) {
      this.engine.cleanup();
    }

    return glyphRun;
  }

  /**
   * Whether the font has no mark positioning of its own: no morx and no
   * GPOS feature tagged `mark` anywhere. Then the Hebrew presentation forms
   * it maps are used for pointed letters (CanonicalCompose.ts). A heuristic
   * on the font, not a test of the sequence: a `mark` feature whose lookups
   * miss some points, or that only a non-default language system reaches,
   * still counts as positioning.
   */
  lacksMarkPositioning(): boolean {
    if (this.font.morx) return false;
    const features: { tag: string }[] = this.font.GPOS?.featureList ?? [];

    return !features.some((feature) => feature.tag === "mark");
  }

  substitute(glyphRun: GlyphRun): void {
    // Call the advanced layout engine to make substitutions
    if (this.engine?.substitute) {
      this.engine.substitute(glyphRun);
    }
  }

  position(glyphRun: GlyphRun): void {
    // Get initial glyph positions
    glyphRun.positions = glyphRun.glyphs.map((glyph) => new GlyphPosition(glyph.advanceWidth));
    let positioned: Record<string, boolean> | null | undefined = null;

    // Call the advanced layout engine. Returns the features applied.
    if (this.engine && "position" in this.engine && this.engine.position) {
      positioned = this.engine.position(glyphRun) as Record<string, boolean> | undefined;
    }

    // if there is no GPOS table, use unicode properties to position marks.
    if (!positioned && (!this.engine || this.engine.fallbackPosition)) {
      if (!this.unicodeLayoutEngine) {
        this.unicodeLayoutEngine = new UnicodeLayoutEngine(this.font);
      }

      this.unicodeLayoutEngine.positionGlyphs(
        glyphRun.glyphs,
        glyphRun.codePoints,
        glyphRun.positions,
        glyphRun.components,
      );
    }

    // if kerning is not supported by GPOS, do kerning with the TrueType/AAT kern table
    if (!positioned?.["kern"] && glyphRun.features["kern"] !== false && this.font.kern) {
      if (!this.kernProcessor) {
        this.kernProcessor = new KernProcessor(this.font);
      }

      this.kernProcessor.process(glyphRun.glyphs, glyphRun.positions!);
      glyphRun.features["kern"] = true;
    }
  }

  // The occurrence's code points decide, never the glyph's: one glyph can
  // stand for a default-ignorable and a visible character (U+00AD, U+002D).
  hideDefaultIgnorables(glyphRun: GlyphRun): void {
    const { glyphs, codePoints } = glyphRun;
    const positions = glyphRun.positions!;
    const space = this.font.glyphForCodePoint(0x20);

    for (let i = 0; i < glyphs.length; i++) {
      const codePoint = codePoints[i]![0];

      if (codePoint !== undefined && this.isDefaultIgnorable(codePoint)) {
        glyphs[i] = space;
        positions[i]!.xAdvance = 0;
        positions[i]!.yAdvance = 0;
        positions[i]!.hidden = true;
      }
    }
  }

  isDefaultIgnorable(ch: number): boolean {
    return isDefaultIgnorable(ch);
  }

  getAvailableFeatures(script: string, language?: string): string[] {
    const features = [];

    if (this.engine) {
      features.push(...this.engine.getAvailableFeatures(script, language));
    }

    if (this.font.kern && features.indexOf("kern") === -1) {
      features.push("kern");
    }

    return features;
  }

  stringsForGlyph(gid: number): string[] {
    const result = new Set<string>();

    const codePoints = this.font._cmapProcessor.codePointsForGlyph(gid);

    for (const codePoint of codePoints) {
      result.add(String.fromCodePoint(codePoint));
    }

    if (this.engine && "stringsForGlyph" in this.engine) {
      for (const string of this.engine.stringsForGlyph(gid)) {
        result.add(string);
      }
    }

    return Array.from(result);
  }
}
