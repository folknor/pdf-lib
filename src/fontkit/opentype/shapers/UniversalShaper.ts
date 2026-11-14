import { unzlibSync } from 'fflate';
import StateMachine from '../../../vendors/dfa/index.js';
import { UnicodeTrie } from '../../../vendors/unicode-properties/UnicodeTrie.js';
import { inserted } from '../../layout/Occurrence.js';
import { decodeBase64 } from '../../utils.js';
import GlyphInfo from '../GlyphInfo.js';
import type ShapingPlan from '../ShapingPlan.js';
import DefaultShaper from './DefaultShaper.js';
import { syllableRuns } from './syllables.js';
import base64DeflatedTrie from './trieUse.js';
import base64DeflatedUseData from './use.js';

const useData = JSON.parse(
  String.fromCharCode.apply(
    String,
    Array.from(unzlibSync(decodeBase64(base64DeflatedUseData))),
  ),
);
const { categories } = useData;
const trie = new UnicodeTrie(unzlibSync(decodeBase64(base64DeflatedTrie)));
const stateMachine = new StateMachine(useData);

/**
 * This shaper is an implementation of the Universal Shaping Engine, which
 * uses Unicode data to shape a number of scripts without a dedicated shaping engine.
 * See https://www.microsoft.com/typography/OpenTypeDev/USE/intro.htm.
 */
export default class UniversalShaper extends DefaultShaper {
  static override zeroMarkWidths = 'BEFORE_GPOS';
  static override planFeatures(plan: ShapingPlan): void {
    plan.addStage(setupSyllables);

    // Default glyph pre-processing group
    plan.addStage(['locl', 'ccmp', 'nukt', 'akhn']);

    // Reordering group
    plan.addStage(clearSubstitutionFlags);
    plan.addStage(['rphf'], false);
    plan.addStage(recordRphf);
    plan.addStage(clearSubstitutionFlags);
    plan.addStage(['pref']);
    plan.addStage(recordPref);

    // Orthographic unit shaping group
    plan.addStage(['rkrf', 'abvf', 'blwf', 'half', 'pstf', 'vatu', 'cjct']);
    plan.addStage(reorder);

    // Topographical features
    // Scripts that need this are handled by the Arabic shaper, not implemented here for now.
    // plan.addStage(['isol', 'init', 'medi', 'fina', 'med2', 'fin2', 'fin3'], false);

    // Standard topographic presentation and positional feature application
    plan.addStage(['abvs', 'blws', 'pres', 'psts', 'dist', 'abvm', 'blwm']);
  }

  // Split vowels are handled before cmap mapping by composeCanonical.
  static override assignFeatures(
    _plan: ShapingPlan,
    _glyphs: GlyphInfo[],
  ): void {}
}

function useCategory(glyph: GlyphInfo): number {
  return trie.get(glyph.codePoints[0]!);
}

class USEInfo {
  category: string;
  syllableType: string;
  syllable: number;

  constructor(category: string, syllableType: string, syllable: number) {
    this.category = category;
    this.syllableType = syllableType;
    this.syllable = syllable;
  }
}

/**
 * Gives every glyph a syllable. CGJ "may occur anywhere in a cluster with no
 * effect" (USE specification), but the fontkit-era grammar in use.ts has no
 * place for it, so the state machine runs on the other glyphs only and each
 * CGJ joins the syllable of the glyph before it (leading CGJs form a
 * 'non_cluster' of their own, so every syllable starts with a matched glyph). Glyphs no match covers form syllables of type 'non_cluster',
 * which keep their own category and are never reordered.
 */
function setupSyllables(_font: any, glyphs: GlyphInfo[]): void {
  const all = glyphs.map(useCategory);
  const kept: number[] = [];
  for (let i = 0; i < glyphs.length; i++) {
    if (categories[all[i]!] !== 'CGJ') kept.push(i);
  }

  let syllable = 0;
  const assign = (from: number, to: number, type: string) => {
    ++syllable;
    for (let i = from; i < to; i++) {
      glyphs[i]!.shaperInfo = new USEInfo(categories[all[i]!], type, syllable);
    }
  };

  // CGJs with no glyph before them follow no cluster: a syllable of their own.
  const lead = kept.length > 0 ? kept[0]! : glyphs.length;
  if (lead > 0) assign(0, lead, 'non_cluster');

  for (const { start, end, tags } of syllableRuns(
    stateMachine,
    kept.map((i) => all[i]!),
  )) {
    const from = kept[start]!;
    const to = end < kept.length ? kept[end]! : glyphs.length;
    // The old USE grammar expects split II and rejects TSA -PHRU after
    // intact, mapped U+0F73. Keep this single following mark in the preceding
    // standard cluster without decomposing II or changing the typed order.
    // Revisit this compatibility exception with the slice 4 grammar review.
    const previous = glyphs[from - 1];
    if (
      tags?.[0] === 'broken_cluster' &&
      to === from + 1 &&
      glyphs[from]!.codePoints[0] === 0x0f39 &&
      previous?.codePoints[0] === 0x0f73 &&
      previous.shaperInfo.syllableType === 'standard_cluster'
    ) {
      glyphs[from]!.shaperInfo = new USEInfo(
        categories[all[from]!],
        'standard_cluster',
        previous.shaperInfo.syllable,
      );
      continue;
    }
    assign(from, to, tags ? tags[0]! : 'non_cluster');
    if (!tags) continue;

    // Assign rphf feature, counting the matched glyphs only: CGJ is
    // transparent here too.
    const first = glyphs[kept[start]!]!;
    const limit =
      first.shaperInfo.category === 'R' ? 1 : Math.min(3, end - start - 1);
    for (let k = start; k < start + limit; k++) {
      glyphs[kept[k]!]!.features['rphf'] = true;
    }
  }
}

function clearSubstitutionFlags(_font: any, glyphs: GlyphInfo[]): void {
  for (const glyph of glyphs) {
    glyph.substituted = false;
  }
}

function recordRphf(_font: any, glyphs: GlyphInfo[]): void {
  for (const glyph of glyphs) {
    if (glyph.substituted && glyph.features['rphf']) {
      // Mark a substituted repha.
      glyph.shaperInfo.category = 'R';
    }
  }
}

function recordPref(_font: any, glyphs: GlyphInfo[]): void {
  for (const glyph of glyphs) {
    if (glyph.substituted) {
      // Mark a substituted pref as VPre, as they behave the same way.
      glyph.shaperInfo.category = 'VPre';
    }
  }
}

function reorder(font: any, glyphs: GlyphInfo[]): void {
  const dottedCircle = font.glyphForCodePoint(0x25cc).id;

  for (
    let start = 0, end = nextSyllable(glyphs, 0);
    start < glyphs.length;
    start = end, end = nextSyllable(glyphs, start)
  ) {
    let i, j;
    let info = glyphs[start]!.shaperInfo;
    const type = info.syllableType;

    // Only a few syllable types need reordering.
    if (
      type !== 'virama_terminated_cluster' &&
      type !== 'standard_cluster' &&
      type !== 'broken_cluster'
    ) {
      continue;
    }

    // Insert a dotted circle glyph in broken clusters: it is the cluster's
    // base, so it has a base's info of its own (not the first glyph's), and
    // goes before the first glyph that is neither a repha nor CGJ.
    if (type === 'broken_cluster' && dottedCircle) {
      // Inserted, so it stands for no character in extracted text.
      const g = new GlyphInfo(
        font,
        dottedCircle,
        inserted([0x25cc], glyphs[start]!.cluster),
      );
      g.shaperInfo = new USEInfo('B', type, info.syllable);

      for (
        i = start;
        i < end &&
        (glyphs[i]!.shaperInfo.category === 'R' ||
          glyphs[i]!.shaperInfo.category === 'CGJ');
        i++
      );
      glyphs.splice(i, 0, g);
      end++;
    }

    // Move things forward.
    if (info.category === 'R' && end - start > 1) {
      // Got a repha. Reorder it to after first base, before first halant.
      for (i = start + 1; i < end; i++) {
        info = glyphs[i]!.shaperInfo;
        if (isBase(info) || isHalant(glyphs[i]!)) {
          // If we hit a halant, move before it; otherwise it's a base: move to it's
          // place, and shift things in between backward.
          if (isHalant(glyphs[i]!)) {
            i--;
          }

          // Take the repha out, then put it back at i: the glyphs from
          // start + 1 to i have shifted down by one, so it lands after them.
          const [repha] = glyphs.splice(start, 1);
          glyphs.splice(i, 0, repha!);
          break;
        }
      }
    }

    // Move things back.
    for (i = start, j = end; i < end; i++) {
      info = glyphs[i]!.shaperInfo;
      if (isBase(info) || isHalant(glyphs[i]!)) {
        // If we hit a halant, move after it; otherwise it's a base: move to it's
        // place, and shift things in between backward.
        j = isHalant(glyphs[i]!) ? i + 1 : i;
      } else if (
        (info.category === 'VPre' || info.category === 'VMPre') &&
        j < i
      ) {
        glyphs.splice(j, 1, glyphs[i]!, ...glyphs.splice(j, i - j));
      }
    }
  }
}

function nextSyllable(glyphs: GlyphInfo[], start: number): number {
  if (start >= glyphs.length) return start;
  const syllable = glyphs[start]!.shaperInfo.syllable;
  while (
    ++start < glyphs.length &&
    glyphs[start]!.shaperInfo.syllable === syllable
  );
  return start;
}

function isHalant(glyph: GlyphInfo): boolean {
  return glyph.shaperInfo.category === 'H' && !glyph.isLigated;
}

function isBase(info: USEInfo): boolean {
  return info.category === 'B' || info.category === 'GB';
}
