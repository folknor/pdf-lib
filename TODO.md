# TODO for @folknor/pdf-lib

## Completed

### TypeScript Strict Flags
- [x] `noImplicitOverride` (~110 methods)
- [x] `noPropertyAccessFromIndexSignature` (~55 bracket notations)
- [x] `noUncheckedIndexedAccess` (582 errors fixed)
- [x] `exactOptionalPropertyTypes`

### Biome Rules Enabled
- [x] `noBannedTypes` - replaced `Function` type
- [x] `noForEach` - use `for...of`
- [x] `noDoubleEquals` - require `===`
- [x] `noFloatingPromises` - handle promises
- [x] `noMisusedPromises` - correct promise usage
- [x] `noShadow` - no variable shadowing
- [x] `noUselessStringConcat` - clean concatenation
- [x] `noUselessCatchBinding` - clean catch blocks
- [x] `noUnusedExpressions` - no dead code
- [x] `useConsistentArrowReturn` - consistent arrows
- [x] `useArraySortCompare` - explicit sort comparators
- [x] `useErrorMessage` - error messages required
- [x] `useImportType` - type-only imports

### Infrastructure
- [x] Migrate yarn → pnpm
- [x] ESM-only output (no CJS/UMD)
- [x] TypeScript 5.9.3 with ES2022 target
- [x] `nodenext` moduleResolution with `.js` extensions
- [x] Jest → Vitest
- [x] ESLint+Prettier → Biome
- [x] Remove husky/lint-staged
- [x] Add `"sideEffects": false`
- [x] Delete apps/, docs/, scratchpad/, .circleci/, .github/, .vscode/
- [x] Release workflow with `release-it`
- [x] Sub-path exports reviewed — not needed with `sideEffects: false`

---

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

## Code Issues & Improvements

### Potential Bugs

- [x] **PDFPageLeaf inherited resource mutation** (`src/core/structures/PDFPageLeaf.ts`) — Fixed: `normalize()` now clones inherited Resources, Font, XObject, and ExtGState dictionaries to prevent mutation of shared parent dictionaries.

- [ ] **PDFFont orphan cleanup** (`src/api/PDFFont.ts:153`) — Embedding the same font multiple times creates orphan objects that bloat the PDF. TODO in code says "Cleanup orphan embedded objects if a font is embedded multiple times..."

- [ ] **PDFPage resource reuse** (`src/api/PDFPage.ts:707, 1077, 1153`) — Drawing the same image/font/embeddedPage multiple times creates duplicate resource entries instead of reusing existing names.

### Consistency Improvements

- [x] **PDFName static properties** — Added: `Filter`, `Subtype`, `Kids`, `Count`, `Catalog`, `Pages`, `ColorSpace`, `Pattern`, `Shading`, `Properties`, `Form`, `Image`, `Off`, `Yes`, `Opt`, `Names`, `EmbeddedFiles`.

### Housekeeping

- [x] **Delete stale `.plans/` directory** — Deleted.

---

## Final Checklist
- [x] `pnpm build && pnpm test && pnpm lint` passes
- [ ] Delete this file
