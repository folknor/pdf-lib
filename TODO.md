# TODO for @folknor/pdf-lib

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

### Flatten Bugs (High Priority)

- [x] **#1267 #1387 - Orphan annotation references after flatten** — Fixed: `removeField()` now removes widget refs from ALL pages' Annots arrays, not just pages where `findWidgetPage()` succeeds. This prevents orphan refs when widget's P (page) reference is missing.

- [ ] **#1482 #1757 - Error 14 after flatten with cross-page fields** — Fields shared across pages or `copyPages()` after `flatten()` creates broken object references. Adobe shows "Expected a dict object".

### Flatten Bugs (Medium Priority)

- [ ] **#1519 - Runtime crash on certain PDFs** — `findWidgetPage()` returns undefined for some PDF structures (Canadian government forms), causing crash in `removeField()`.

- [ ] **#1574 - Checkbox marks disappear after flatten** — `findWidgetAppearanceRef()` falls back to "Off" appearance when checkbox "on" value doesn't match appearance dictionary keys.

### Completed

- [x] **PDFPageLeaf inherited resource mutation** (`src/core/structures/PDFPageLeaf.ts`) — Fixed: `normalize()` now clones inherited Resources, Font, XObject, and ExtGState dictionaries to prevent mutation of shared parent dictionaries.

- [x] **PDFFont orphan cleanup** (`src/core/embedders/CustomFontEmbedder.ts`) — Fixed: Embedder now tracks refs to child objects (CID font dict, font descriptor, font stream, unicode cmap) and reuses them on re-embedding instead of creating new orphan objects.

- [x] **PDFPage resource reuse** (`src/core/structures/PDFPageLeaf.ts`) — Fixed: Added `getOrCreateFontDictionary`, `getOrCreateXObject`, `getOrCreateExtGState` methods that look up existing refs before creating new entries. Updated PDFPage to use these methods.

- [x] **PDFName static properties** — Added: `Filter`, `Subtype`, `Kids`, `Count`, `Catalog`, `Pages`, `ColorSpace`, `Pattern`, `Shading`, `Properties`, `Form`, `Image`, `Off`, `Yes`, `Opt`, `Names`, `EmbeddedFiles`.

---

## Final Checklist
- [x] `pnpm build && pnpm test && pnpm lint` passes
- [ ] Delete this file
