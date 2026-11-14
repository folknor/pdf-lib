# Mark reorder before shaping: design and slice plan

Shared design document for the chain closing the mark reordering finding
in notes/fontkit-findings.md. Each link brings this plan up to date;
the last link closes the finding and deletes this file.

## Settled rulings

1. The reorder lives inside the canonical stage (`composeCanonical`,
   CanonicalCompose.ts), as decompose -> rank sort -> compose, for every
   engine including AAT. Not a separate pass after composition: composing
   first decides blocking on the typed order, so canonically equivalent
   spellings (A + U+0315 + acute vs A + acute + U+0315) reached the font as
   different sequences. Not a shaper hook (selection follows the font's
   script list; AAT and table-less fonts never reach a shaper).
2. Decomposition is unchanged: only what the font lacks. Marks inside a
   mapped composite stay hidden from the sort; that is a declared limit of
   the coverage-choice contract, not something this chain closes.
3. A run is a maximal stretch of unlocked code points with nonzero ccc,
   after decomposition. Class-0 code points (CGJ, Indic matras, a mapped
   U+0F73, RNAM BCAD) bound runs and keep typed order; CGJ is the user's way
   to force an order. Sort is stable; rank = ccc unless overridden in
   MarkOrder.ts. "Last" ranks mean last within the run, never across a
   class-0 code point.
4. Composition in unfrozen runs: a mark composes onto the starter unless a
   class-0 mark or a remaining (not consumed) mark of its own ccc lies in
   between. Actual ccc, never rank. Exclusions, non-mark starter, VS locks
   unchanged.
5. Variation-selector clusters are locked: never decomposed, sorted or
   composed.
6. Rank data is hand-authored, stated against Unicode 8 (canonicalData.ts's
   version), each override justified by a test of the order a font or the
   USE grammar consumes. No HarfBuzz table is copied (LLM.md isolation).
7. No run is frozen. A run is Arabic if the nearest preceding non-mark
   (looking past every mark, CGJ included) has Script Arabic, or a member is
   in the Arabic mark list in MarkOrder.ts (by code point: fatha, damma,
   shadda, hamza are Script=Inherited). Decided once on the decomposed
   sequence before composition. Arabic runs sort by UAX #53 AMTRA keys
   (leading class-220 MCMs, leading class-230 MCMs, shadda, then class;
   stable; "leading" judged on typed order within the class, so MADDAH +
   HAMZA promotes nothing) and compose only a mark directly after the
   starter in the output so far. The MCM set is PropList 18.0.0's, cut to
   the members the Unicode 8 data knows.
8. Hebrew sorts by class with one override: holam (05B9, 05BA) after
   dagesh, meteg and rafe, before the shin/sin dots, because DejaVu Sans
   classes holam and the shin/sin dots as GDEF base glyphs and every mark
   after them loses its attachment. Dagesh and shin/sin dots before the
   vowels were refused (DejaVu breaks under them; Noto Sans Hebrew is
   order-independent; Noto Serif Hebrew only ligates the nonstandard VAV +
   SHIN DOT), and so was the meteg swap (no consumer, no public source).
9. The canonical presentation forms U+FB1D..FB4E compose, through mapped
   intermediates only, when the font has no morx and no GPOS feature tagged
   `mark` (LayoutEngine.lacksMarkPositioning). A font-level heuristic, not a
   sequence test: partial mark coverage counts as positioning.
10. Tibetan U keeps its ccc (after the other vowels): with the trie as it is,
   the USE grammar accepts canonical KA E U and breaks KA U E. Ranking U
   first and the positional overrides are one unit (slice 4).

## Slices

1. **Core (landed).** Rank sort and equivalence-rule composition in
   `composeCanonical`; MarkOrder.ts with overrides: Thai SARA U/UU before
   PHINTHU, Telugu length marks before virama, Tibetan TSA -PHRU before AA,
   PADMA GDAN and Tai Tham SAKOT last; Hebrew/Arabic freeze. Size: ~150
   lines of source and tests.
2. **Hebrew and Arabic (landed).** Freeze lifted; AMTRA for Arabic runs
   with adjacency-only composition; Hebrew class order with the holam
   override; presentation-form composition for fonts without mark
   positioning (rulings 7, 8, 9). Noto Serif Hebrew and Noto Naskh Arabic
   fixtures added. The planned dagesh/shin-dot promotion and meteg swap were
   refused on font evidence. Size: ~200 lines of source and tests.
3. **Split vowels into the stage.** Move IndicShaper/UniversalShaper
   split-vowel decompositions into the canonical stage so their parts are
   sorted (KA + mapped U+0F73 + TSA -PHRU stays broken until then: II is
   class 0 and USE expands it after the sort), with a glyph check the
   shapers lack, and the VS lock covering them. Size: medium, ~150 lines.
4. **Tibetan U and positional overrides.** Rank U before the other vowels
   and take the specification's positional overrides (I/E/O below, U above)
   in gen-use-trie.mjs together, or refuse with evidence; also review
   HALANTA (ccc 9) and repeated vowels. Size: small, ~50 lines plus
   regenerated trie and fixture.
