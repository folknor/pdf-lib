# TODO for @folknor/pdf-lib.

## Intentionally Disabled (too noisy or conflicts with codebase)
| Rule | Reason |
|------|--------|
| `noExplicitAny` | Large effort, many legitimate uses |
| `noNonNullAssertion` | Would undo noUncheckedIndexedAccess work |
| `noImplicitCoercions` | `!!value` is idiomatic |
| `noUselessUndefined` | Explicit returns improve clarity |
| `noUselessSwitchCase` | Explicit case labels document intent |
| `useLiteralKeys` | Bracket notation sometimes clearer |
| `useSimplifiedLogicExpression` | Original expressions often clearer |
| `noBarrelFile` / `noReExportAll` | Conflicts with current structure |
| `noConsole` | Legitimate warning/debug usage |
| `noParametersOnlyUsedInRecursion` | False positives on method replacement patterns |

---

## Test Coverage Improvements

Overall: 70% statements, 56% branches, 75% functions, 70% lines.

### High Priority

- [ ] **PDFPage drawing operations** (31% stmts) — Most user-facing API, critically undertested. drawText, drawImage, drawRectangle, drawLine, drawCircle, drawEllipse, drawSvgPath, setRotation, setSize, translateContent.
- [ ] **SVG parser** (11% stmts) — Almost entirely untested. Path commands, transforms, gradients, error cases.
- [ ] **PDFEmbeddedPage** (0% stmts) — Completely untested. embed, scale, size, width, height.
- [ ] **PDFTextField** (64% stmts) — setText with various encodings, setFontSize, setAlignment, multiline, max length, appearance generation.

### Medium Priority

- [ ] **DecodeStream and stream decoders** (27% stmts) — Core stream decoding infrastructure. Decode filters, error handling on malformed streams.
- [ ] **PDFForm flatten and removeField** (76% stmts, 48% branches) — Flattening with missing appearances, checkboxes/radio groups, orphaned widgets.
- [ ] **Text layout** (62% stmts) — layoutMultilineText edge cases, text alignment, bounds computation.
- [ ] **PDFField base class** (73% stmts) — enableReadOnly, disableExporting, isRequired, getName, default appearance handling.
- [ ] **Validators and error utilities** (59% / 20% stmts) — Low-hanging fruit. assertIs, assertRange, assertOrUndefined, error class constructors.

### Low Priority

- [ ] **Colors, rotations, operations** (68% / 76% / 89% stmts) — Branch coverage gaps in color conversions, rotation transforms, drawing operations.
- [ ] **PDFDropdown and PDFOptionList** (77% stmts) — multi-select, setOptions, addOptions, clear, sort, appearance updates.

### Lowest Priority

- [ ] **Crypto/security module** (1% stmts) — Encryption/decryption almost entirely untested. DecryptStream 5%, PDFSecurity 8%.

---

## Consider Implementing

- [ ] **#1388 - Prevent xref fragmentation** — Important for digital signature workflows. Adobe invalidates signatures when xref has gaps. Fix: fill gaps with deleted ('f') entries instead of creating new subsections. https://github.com/Hopding/pdf-lib/issues/1388

- [ ] **#1230 - Copy fields for printing** — Users want to extract form field data for printing. Phase 1: expose internal `getFontSize()` and `getFontColor()` getters that already exist internally. Phase 2: proper field cloning. https://github.com/Hopding/pdf-lib/issues/1230

---

## Dependency Cleanup

### Remove (High Priority)

- [ ] **`clone`** → Replace with native `structuredClone()` (Node 17+, all modern browsers)
  - Only used in `src/fontkit/subset/TTFSubset.js` to clone font table objects (maxp, head, hhea)
  - These are simple data objects, `structuredClone()` handles them fine
  - Removes a dependency entirely

- [ ] **`release-it`** (dev dependency) → Remove if not using automated releases
  - Evaluate if current release workflow needs it
  - If using manual releases or different CI/CD, can be removed

### Upgrade (Medium Priority)

- [ ] **`pako` + `tiny-inflate`** → Replace with **`fflate`**
  - fflate is up to 60% faster than pako
  - Smaller bundle (8kB vs 45kB for pako)
  - Replaces two dependencies with one (handles both compression and decompression)
  - Used in: `src/core/writers/PDFWriter.ts`, `src/core/PDFContext.ts`, `src/core/structures/PDFFlateStream.ts`, `src/vendors/`, `src/fontkit/`

- [ ] **`fast-deep-equal`** → Consider **`fast-equals`**
  - Slightly faster with circular reference support
  - However, fast-deep-equal is still well-maintained (50M+ weekly downloads)
  - Only used in `src/fontkit/cff/CFFDict.js`
  - Low priority since current package works fine

### Keep As-Is

| Package | Reason |
|---------|--------|
| **`dfa`** | Specialized DFA compiler for text shaping in fontkit. XState is the popular modern state machine but has completely different API/purpose. Replacing would require significant refactoring with unclear benefits. Used in `src/fontkit/opentype/shapers/`. |
| **`unicode-trie`** | Ported from ICU for fast Unicode character metadata lookup. No modern alternative exists for this specific use case. Still works correctly despite age (5 years). Used in fontkit shapers. |

---

## TypeScript Strict Mode Cleanup

All strict TypeScript options have been re-enabled. The fontkit files use `@ts-nocheck` to bypass type checking until they are properly typed.

### ✅ Completed: All Strict Options Re-enabled

All strict options are now enabled in `tsconfig.json`:
- `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`
- `strictPropertyInitialization`, `useUnknownInCatchVariables`
- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`

### Remaining: Remove @ts-nocheck from Fontkit (75 files)

Remove `// @ts-nocheck` and fix type errors in each category:

#### Tables (25 files)
- [ ] `tables/cmap.ts`, `tables/directory.ts`, `tables/loca.ts`, `tables/name.ts`, `tables/post.ts`
- [ ] `tables/hmtx.ts`, `tables/vmtx.ts`, `tables/hdmx.ts`, `tables/kern.ts`, `tables/index.ts`
- [ ] `tables/GPOS.ts`, `tables/GSUB.ts`, `tables/JSTF.ts`, `tables/HVAR.ts`, `tables/OS2.ts`
- [ ] `tables/fvar.ts`, `tables/gvar.ts`, `tables/variations.ts`
- [ ] `tables/aat.ts`, `tables/morx.ts`, `tables/feat.ts`, `tables/just.ts`
- [ ] `tables/sbix.ts`, `tables/EBDT.ts`, `tables/EBLC.ts`
- [ ] `tables/opentype.ts`, `tables/WOFFDirectory.ts`, `tables/WOFF2Directory.ts`

#### Glyphs (8 files)
- [ ] `glyph/Glyph.ts`, `glyph/Path.ts`, `glyph/COLRGlyph.ts`
- [ ] `glyph/TTFGlyph.ts`, `glyph/TTFGlyphEncoder.ts`
- [ ] `glyph/CFFGlyph.ts`, `glyph/GlyphVariationProcessor.ts`
- [ ] `glyph/SBIXGlyph.ts`, `glyph/WOFF2Glyph.ts`

#### CFF (4 files)
- [ ] `cff/CFFPointer.ts`, `cff/CFFTop.ts`, `cff/CFFDict.ts`, `cff/CFFOperand.ts`, `cff/CFFFont.ts`, `cff/CFFPrivateDict.ts`

#### Layout (5 files)
- [ ] `layout/LayoutEngine.ts`, `layout/KernProcessor.ts`, `layout/Script.ts`
- [ ] `layout/GlyphRun.ts`, `layout/UnicodeLayoutEngine.ts`

#### OpenType (11 files)
- [ ] `opentype/GPOSProcessor.ts`, `opentype/GSUBProcessor.ts`, `opentype/ShapingPlan.ts`
- [ ] `opentype/OTLayoutEngine.ts`, `opentype/OTProcessor.ts`, `opentype/GlyphIterator.ts`, `opentype/GlyphInfo.ts`
- [ ] `opentype/shapers/DefaultShaper.ts`, `opentype/shapers/HangulShaper.ts`
- [ ] `opentype/shapers/IndicShaper.ts`, `opentype/shapers/UniversalShaper.ts`, `opentype/shapers/ArabicShaper.ts`

#### AAT (4 files)
- [ ] `aat/AATMorxProcessor.ts`, `aat/AATStateMachine.ts`, `aat/AATFeatureMap.ts`, `aat/AATLookupTable.ts`

#### Subset (3 files)
- [ ] `subset/Subset.ts`, `subset/TTFSubset.ts`, `subset/CFFSubset.ts`

#### Core (7 files)
- [ ] `TTFFont.ts`, `CmapProcessor.ts`, `encodings.ts`, `base.ts`, `utils.ts`
- [ ] `DFont.ts`, `TrueTypeCollection.ts`, `WOFF2Font.ts`

### Final Cleanup

- [ ] **Remove `allowJs: true`** — Should not be needed after migration
- [ ] **Replace `@cache` decorator** — Convert to standard memoization pattern, then remove `experimentalDecorators`
