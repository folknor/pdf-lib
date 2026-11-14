import type GlyphPosition from '../layout/GlyphPosition.js';
import * as Script from '../layout/Script.js';
import type GlyphInfo from './GlyphInfo.js';
import GlyphIterator, { type GlyphIteratorOptions } from './GlyphIterator.js';

const DEFAULT_SCRIPTS: string[] = ['DFLT', 'dflt', 'latn'];

/**
 * Chaining-context backtrack sequences are stored closest glyph first, while
 * match() walks forward from the furthest backtrack glyph, so they are
 * matched reversed. Copies; the decoded table is shared.
 */
export const backtrackOrder = <T>(sequence: ArrayLike<T>): T[] =>
  Array.from(sequence).reverse();

/**
 * A glyph sequence a lookup application is working on, kept in step with
 * the buffer by OTProcessor.replaceGlyph: `positions` are the buffer indexes
 * of its members (a context's input sequence, skipped glyphs excluded) and
 * `end` the half-open index processing resumes at once it is done.
 */
interface TrackedSequence {
  positions: number[];
  end: number;
}

export default class OTProcessor {
  font: any;
  table: any;
  script: any;
  scriptTag: string | null;
  language: any;
  languageTag: string | null;
  features: Record<string, any>;
  lookups: Record<string, any>;
  variationsIndex: number;
  direction!: string;
  glyphs: GlyphInfo[];
  positions: GlyphPosition[];
  ligatureID: number;
  currentFeature: string | null;
  featureValues: Record<string, number> = {};
  glyphIterator!: GlyphIterator;
  /**
   * The sequences of the lookup applications in progress, outermost first:
   * the glyph the lookup pass is applying at, then each contextual rule's
   * input sequence as it recurses.
   */
  sequences: TrackedSequence[] = [];

  constructor(font: any, table: any) {
    this.font = font;
    this.table = table;

    this.script = null;
    this.scriptTag = null;

    this.language = null;
    this.languageTag = null;

    this.features = {};
    this.lookups = {};

    // Setup variation substitutions
    this.variationsIndex = font._variationProcessor
      ? this.findVariationsIndex(font._variationProcessor.normalizedCoords)
      : -1;

    // initialize to default script + language
    this.selectScript();

    // current context (set by applyFeatures)
    this.glyphs = [];
    this.positions = []; // only used by GPOS
    this.ligatureID = 1;
    this.currentFeature = null;
  }

  findScript(script: string | string[]): any {
    if (this.table.scriptList == null) {
      return null;
    }

    if (!Array.isArray(script)) {
      script = [script];
    }

    for (const s of script) {
      for (const entry of this.table.scriptList) {
        if (entry.tag === s) {
          return entry;
        }
      }
    }

    return null;
  }

  selectScript(
    script?: string | string[],
    language?: string | null,
    direction?: string | null,
  ): string | null {
    let changed = false;
    let entry;
    if (!this.script || script !== this.scriptTag) {
      entry = this.findScript(script ?? DEFAULT_SCRIPTS);
      if (!entry) {
        entry = this.findScript(DEFAULT_SCRIPTS);
      }

      if (!entry) {
        return this.scriptTag;
      }

      this.scriptTag = entry.tag;
      this.script = entry.script;
      this.language = null;
      this.languageTag = null;
      changed = true;
    }

    if (!direction || direction !== this.direction) {
      this.direction = direction || Script.direction(script ?? DEFAULT_SCRIPTS);
    }

    if (language && language.length < 4) {
      language += ' '.repeat(4 - language.length);
    }

    if (!language || language !== this.languageTag) {
      this.language = null;

      for (const lang of this.script.langSysRecords) {
        if (lang.tag === language) {
          this.language = lang.langSys;
          this.languageTag = lang.tag;
          break;
        }
      }

      if (!this.language) {
        this.language = this.script.defaultLangSys;
        this.languageTag = null;
      }

      changed = true;
    }

    // Build a feature lookup table
    if (changed) {
      this.features = {};
      if (this.language) {
        for (const featureIndex of this.language.featureIndexes) {
          const record = this.table.featureList[featureIndex];
          const substituteFeature =
            this.substituteFeatureForVariations(featureIndex);
          this.features[record.tag] = substituteFeature || record.feature;
        }
      }
    }

    return this.scriptTag;
  }

  lookupsForFeatures(
    userFeatures: string[] = [],
    exclude?: number[],
  ): Array<{ feature: string; index: number; lookup: any }> {
    const lookups: Array<{ feature: string; index: number; lookup: any }> = [];
    for (const tag of userFeatures) {
      const feature = this.features[tag];
      if (!feature) {
        continue;
      }

      for (const lookupIndex of feature.lookupListIndexes) {
        if (exclude && exclude.indexOf(lookupIndex) !== -1) {
          continue;
        }

        lookups.push({
          feature: tag,
          index: lookupIndex,
          lookup: this.table.lookupList.get(lookupIndex),
        });
      }
    }

    lookups.sort((a, b) => a.index - b.index);
    return lookups;
  }

  substituteFeatureForVariations(featureIndex: number): any {
    if (this.variationsIndex === -1) {
      return null;
    }

    const record =
      this.table.featureVariations.featureVariationRecords[
        this.variationsIndex
      ];
    const substitutions = record.featureTableSubstitution.substitutions;
    for (const substitution of substitutions) {
      if (substitution.featureIndex === featureIndex) {
        return substitution.alternateFeatureTable;
      }
    }

    return null;
  }

  findVariationsIndex(coords: number[]): number {
    const variations = this.table.featureVariations;
    if (!variations) {
      return -1;
    }

    const records = variations.featureVariationRecords;
    for (let i = 0; i < records.length; i++) {
      const conditions = records[i].conditionSet.conditionTable;
      if (this.variationConditionsMatch(conditions, coords)) {
        return i;
      }
    }

    return -1;
  }

  variationConditionsMatch(conditions: any[], coords: number[]): boolean {
    return conditions.every((condition) => {
      const coord =
        condition.axisIndex < coords.length ? coords[condition.axisIndex]! : 0;
      return (
        condition.filterRangeMinValue <= coord! &&
        coord! <= condition.filterRangeMaxValue
      );
    });
  }

  /**
   * `featureValues` is the plan's alternate numbers for this execution
   * (ShapingPlan.featureValues); omitted, every enabled feature has value 1.
   */
  applyFeatures(
    userFeatures: string[],
    glyphs: GlyphInfo[],
    advances?: GlyphPosition[],
    featureValues: Record<string, number> = {},
  ): void {
    const lookups = this.lookupsForFeatures(userFeatures);
    this.featureValues = featureValues;
    this.applyLookups(lookups, glyphs, advances);
  }

  /**
   * The value of the feature being applied on `glyph`: 0 where the glyph is
   * not eligible for it (a contextual rule can reach such a glyph, and
   * HarfBuzz's glyph mask then gives 0), else the requested alternate
   * number, default 1.
   */
  currentFeatureValue(glyph: GlyphInfo): number {
    const feature = this.currentFeature;
    if (feature == null || !(feature in glyph.features)) {
      return 0;
    }
    return this.featureValues[feature] ?? 1;
  }

  applyLookups(
    lookups: Array<{ feature: string; index: number; lookup: any }>,
    glyphs: GlyphInfo[],
    positions?: GlyphPosition[],
  ): void {
    this.glyphs = glyphs;
    this.positions = positions ?? [];
    this.glyphIterator = new GlyphIterator(glyphs);
    this.sequences = [];

    for (const { feature, lookup } of lookups) {
      this.currentFeature = feature;
      // Start one outside the buffer and enter through move(), so the first
      // glyph visited also honours the lookup flags. Reverse lookups walk
      // from the logical end to the start.
      const dir = this.isReverseLookup(lookup) ? -1 : 1;
      const options = this.iteratorOptions(lookup);
      this.glyphIterator.reset(options, dir === 1 ? -1 : glyphs.length);

      while (this.glyphIterator.move(dir)) {
        if (!(feature in this.glyphIterator.cur!.features)) {
          continue;
        }

        // A forward pass resumes after what the application consumed: a
        // context's whole input sequence, a ligature's last component, a
        // multiple substitution's last glyph, or the glyph that slid into
        // a deleted one's place. Each follows the buffer edits made on the
        // way (see replaceGlyph).
        const index = this.glyphIterator.index;
        const frame = { positions: [index], end: index + 1 };
        this.sequences = [frame];
        let applied = false;
        for (const table of lookup.subTables) {
          if (this.applyLookup(lookup.lookupType, table)) {
            applied = true;
            break;
          }
        }
        this.sequences = [];
        if (applied && dir === 1) {
          this.glyphIterator.reset(options, frame.end - 1);
        }
      }
    }
  }

  /**
   * Replaces the glyph at `index` with `replacement` (empty: deletes it).
   * The only way a lookup changes the buffer's length. Every tracked
   * sequence follows: a member at `index` becomes the replacement glyphs,
   * later members and ends shift by the change in length.
   */
  replaceGlyph(index: number, replacement: GlyphInfo[]): void {
    this.glyphs.splice(index, 1, ...replacement);
    const delta = replacement.length - 1;
    for (const sequence of this.sequences ?? []) {
      const positions: number[] = [];
      for (const position of sequence.positions) {
        if (position < index) {
          positions.push(position);
        } else if (position === index) {
          for (let i = 0; i < replacement.length; i++) {
            positions.push(index + i);
          }
        } else {
          positions.push(position + delta);
        }
      }
      sequence.positions = positions;
      if (sequence.end > index) {
        sequence.end += delta;
      }
    }
  }

  /**
   * Moves the resume point of a lookup applied directly by the pass (not
   * from a contextual rule) to `end`.
   */
  consumedTo(end: number): void {
    if (this.sequences?.length === 1) {
      this.sequences[0]!.end = end;
    }
  }

  /**
   * The skip rules a lookup's glyph iterator runs under: its decoded flags
   * (kept whole, GPOS reads rightToLeft from them), its mark attachment
   * class, and, with UseMarkFilteringSet, membership in GDEF mark glyph set
   * `lookup.markFilteringSet`, tested on the glyph's current id. A filtering
   * lookup whose set cannot be found (no GDEF, GDEF before 1.2, no
   * MarkGlyphSetsDef, index out of range) is malformed; it is recovered by
   * treating the set as empty, so every mark is skipped, rather than by
   * falling back to the mark attachment class.
   */
  iteratorOptions(lookup: any): GlyphIteratorOptions {
    const flags = lookup.flags ?? {};
    if (!flags.flags?.useMarkFilteringSet) {
      return flags;
    }
    const coverage =
      this.font?.GDEF?.markGlyphSetsDef?.coverage?.[lookup.markFilteringSet];
    return {
      ...flags,
      markFilter: coverage
        ? (glyphId: number) => this.coverageIndex(coverage, glyphId) !== -1
        : () => false,
    };
  }

  /** Whether a lookup is processed end to start. Only GSUB has such a type. */
  isReverseLookup(_lookup: any): boolean {
    return false;
  }

  applyLookup(_lookup: number, _table: any): boolean {
    throw new Error('applyLookup must be implemented by subclasses');
  }

  /**
   * Applies a matched contextual rule's records. `input` is the buffer
   * indexes of the rule's input sequence as matched (glyphs the rule's
   * lookup skips are not in it). A record's sequenceIndex counts members of
   * that sequence as earlier records left it: glyphs a nested lookup
   * inserted for a member are members, deleted members are gone, and a
   * member whose new id the outer rules would now skip stays one. The
   * sequence is never re-walked under the skip rules. A record past the end
   * of the sequence does nothing.
   */
  applyLookupList(lookupRecords: any[], input: number[]): boolean {
    const options = this.glyphIterator.options;
    const glyphIndex = this.glyphIterator.index;
    this.sequences ??= [];
    const sequence: TrackedSequence = {
      positions: input,
      end: input.length ? input[input.length - 1]! + 1 : glyphIndex + 1,
    };
    this.sequences.push(sequence);

    for (const lookupRecord of lookupRecords) {
      const position = sequence.positions[lookupRecord.sequenceIndex];
      if (position == null) {
        continue;
      }

      const lookup = this.table.lookupList.get(lookupRecord.lookupListIndex);
      // A reverse lookup is not applied when reached from a contextual rule,
      // matching HarfBuzz; the rest of the record list still runs.
      if (this.isReverseLookup(lookup)) {
        continue;
      }
      this.glyphIterator.reset(this.iteratorOptions(lookup), position);

      // Apply lookup subtables until one matches
      for (const table of lookup.subTables) {
        if (this.applyLookup(lookup.lookupType, table)) {
          break;
        }
      }
    }

    this.sequences.pop();
    // The rule the pass applied directly sets where the pass resumes;
    // nested rules leave it to the rule that reached them.
    this.consumedTo(sequence.end);
    this.glyphIterator.reset(options, glyphIndex);
    return true;
  }

  coverageIndex(coverage: any, glyph?: number): number {
    if (glyph == null) {
      glyph = this.glyphIterator.cur!.id;
    }

    switch (coverage.version) {
      case 1:
        return coverage.glyphs.indexOf(glyph);

      case 2:
        for (const range of coverage.rangeRecords) {
          if (range.start <= glyph && glyph <= range.end) {
            return range.startCoverageIndex + glyph - range.start;
          }
        }

        break;
    }

    return -1;
  }

  /** The buffer indexes of the glyphs matched, or false. */
  match(
    sequenceIndex: number,
    sequence: any[],
    fn: (item: any, glyph: GlyphInfo) => boolean,
  ): false | number[] {
    const pos = this.glyphIterator.index;
    let glyph = this.glyphIterator.increment(sequenceIndex);
    const matched: number[] = [];

    while (
      matched.length < sequence.length &&
      glyph &&
      fn(sequence[matched.length], glyph)
    ) {
      matched.push(this.glyphIterator.index);
      glyph = this.glyphIterator.next();
    }

    this.glyphIterator.index = pos;
    return matched.length < sequence.length ? false : matched;
  }

  sequenceMatches(sequenceIndex: number, sequence: number[]): false | number[] {
    return this.match(
      sequenceIndex,
      sequence,
      (component, glyph) => component === glyph.id,
    );
  }

  sequenceMatchIndices(
    sequenceIndex: number,
    sequence: number[],
  ): false | number[] {
    return this.match(sequenceIndex, sequence, (component, glyph) => {
      // If the current feature doesn't apply to this glyph,
      if (!(this.currentFeature! in glyph.features)) {
        return false;
      }

      return component === glyph.id;
    });
  }

  coverageSequenceMatches(
    sequenceIndex: number,
    sequence: any[],
  ): false | number[] {
    return this.match(
      sequenceIndex,
      sequence,
      (coverage, glyph) => this.coverageIndex(coverage, glyph.id) >= 0,
    );
  }

  getClassID(glyph: number, classDef: any): number {
    // A NULL (offset 0) ClassDef decodes as null; every glyph is then class 0.
    switch (classDef?.version) {
      case 1: {
        // Class array
        const i = glyph - classDef.startGlyph;
        if (i >= 0 && i < classDef.classValueArray.length) {
          return classDef.classValueArray[i];
        }

        break;
      }

      case 2:
        for (const range of classDef.classRangeRecord) {
          if (range.start <= glyph && glyph <= range.end) {
            return range.class;
          }
        }

        break;
    }

    return 0;
  }

  classSequenceMatches(
    sequenceIndex: number,
    sequence: number[],
    classDef: any,
  ): false | number[] {
    return this.match(
      sequenceIndex,
      sequence,
      (classID, glyph) => classID === this.getClassID(glyph.id, classDef),
    );
  }

  applyContext(table: any): boolean {
    let index: number, set: any;
    switch (table.version) {
      case 1:
        index = this.coverageIndex(table.coverage);
        if (index === -1) {
          return false;
        }

        set = table.ruleSets[index];
        if (!set) {
          return false;
        }

        for (const rule of set) {
          const rest = this.sequenceMatches(1, rule.input);
          if (rest) {
            return this.applyLookupList(rule.lookupRecords, [
              this.glyphIterator.index,
              ...rest,
            ]);
          }
        }

        break;

      case 2:
        if (this.coverageIndex(table.coverage) === -1) {
          return false;
        }

        index = this.getClassID(this.glyphIterator.cur!.id, table.classDef);
        set = table.classSet[index];
        if (!set) {
          return false;
        }

        for (const rule of set) {
          const rest = this.classSequenceMatches(
            1,
            rule.classes,
            table.classDef,
          );
          if (rest) {
            return this.applyLookupList(rule.lookupRecords, [
              this.glyphIterator.index,
              ...rest,
            ]);
          }
        }

        break;

      case 3: {
        const input = this.coverageSequenceMatches(0, table.coverages);
        if (input) {
          return this.applyLookupList(table.lookupRecords, input);
        }

        break;
      }
    }

    return false;
  }

  applyChainingContext(table: any): boolean {
    let index: number;
    switch (table.version) {
      case 1: {
        index = this.coverageIndex(table.coverage);
        if (index === -1) {
          return false;
        }

        const set = table.chainRuleSets[index];
        if (!set) {
          return false;
        }

        for (const rule of set) {
          if (
            !this.sequenceMatches(
              -rule.backtrack.length,
              backtrackOrder(rule.backtrack),
            )
          ) {
            continue;
          }
          const rest = this.sequenceMatches(1, rule.input);
          if (
            rest &&
            this.sequenceMatches(1 + rule.input.length, rule.lookahead)
          ) {
            return this.applyLookupList(rule.lookupRecords, [
              this.glyphIterator.index,
              ...rest,
            ]);
          }
        }

        break;
      }

      case 2: {
        if (this.coverageIndex(table.coverage) === -1) {
          return false;
        }

        index = this.getClassID(
          this.glyphIterator.cur!.id,
          table.inputClassDef,
        );
        const rules = table.chainClassSet[index];
        if (!rules) {
          return false;
        }

        for (const rule of rules) {
          if (
            !this.classSequenceMatches(
              -rule.backtrack.length,
              backtrackOrder(rule.backtrack),
              table.backtrackClassDef,
            )
          ) {
            continue;
          }
          const rest = this.classSequenceMatches(
            1,
            rule.input,
            table.inputClassDef,
          );
          if (
            rest &&
            this.classSequenceMatches(
              1 + rule.input.length,
              rule.lookahead,
              table.lookaheadClassDef,
            )
          ) {
            return this.applyLookupList(rule.lookupRecords, [
              this.glyphIterator.index,
              ...rest,
            ]);
          }
        }

        break;
      }

      case 3: {
        if (
          !this.coverageSequenceMatches(
            -table.backtrackGlyphCount,
            backtrackOrder(table.backtrackCoverage),
          )
        ) {
          break;
        }
        const input = this.coverageSequenceMatches(0, table.inputCoverage);
        if (
          input &&
          this.coverageSequenceMatches(
            table.inputGlyphCount,
            table.lookaheadCoverage,
          )
        ) {
          return this.applyLookupList(table.lookupRecords, input);
        }

        break;
      }
    }

    return false;
  }
}
