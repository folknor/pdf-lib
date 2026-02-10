# TODO for @folknor/pdf-lib.

## Biome Rules

### Enabled Rules (error)
| Category | Rules |
|----------|-------|
| **nursery** | `useConsistentArrowReturn`, `useArraySortCompare`, `noUselessUndefined`, `noUselessCatchBinding`, `noUnusedExpressions`, `noShadow`, `noMisusedPromises`, `noFloatingPromises` |
| **complexity** | `noBannedTypes`, `noUselessStringConcat`, `noForEach` |
| **correctness** | `noUndeclaredVariables`, `noProcessGlobal` |
| **style** | `useImportType` |
| **suspicious** | `noDoubleEquals`, `noDebugger`, `useErrorMessage`, `noVar`, `noUnassignedVariables`, `noMisplacedAssertion`, `useIterableCallbackReturn` |

### Disabled Rules

#### Breaks Fontkit Code (auto-fix causes test failures)
| Rule | Reason |
|------|--------|
| `useSimplifiedLogicExpression` | De Morgan transforms break subtle logic in font parsing |
| `noUselessSwitchCase` | Fontkit uses explicit fallthrough cases intentionally |
| `noImplicitCoercions` | Changes `+x` to `Number(x)`, breaks fontkit encoding |

#### Type Safety (TypeScript handles better)
| Rule | Reason |
|------|--------|
| `noExplicitAny` | Large effort, many legitimate uses in fontkit |
| `noNonNullAssertion` | Would undo `noUncheckedIndexedAccess` work |
| `noImplicitAnyLet` | TypeScript strict mode handles this |
| `noEvolvingTypes` | TypeScript inference is sufficient |
| `useExplicitType` | Large effort, TypeScript infers return types well |

#### False Positives / Limitations
| Rule | Reason |
|------|--------|
| `useAwaitThenable` | Can't resolve Promise types through interfaces |
| `noUnresolvedImports` | Can't resolve barrel exports (index.js re-exports) |
| `useGetterReturn` | Doesn't handle `T | undefined` return types with implicit return |
| `noUnnecessaryConditions` | Conflicts with defensive coding patterns |
| `noParametersOnlyUsedInRecursion` | False positives on method replacement patterns |
| `noConfusingVoidType` | False positives in callback signatures |
| `noControlCharactersInRegex` | Legitimate uses in binary format parsing |

#### Module Structure
| Rule | Reason |
|------|--------|
| `noBarrelFile` | Conflicts with current index.ts re-export structure |
| `noReExportAll` | Conflicts with current index.ts re-export structure |
| `noNamespaceImport` | `import * as` useful for restructure, etc. |
| `noImportCycles` | Would require significant refactoring |

#### Intentional Patterns
| Rule | Reason |
|------|--------|
| `noConsole` | Legitimate warning/debug usage |
| `noTsIgnore` | Some legitimate uses in fontkit (@ts-nocheck in IndicShaper) |
| `noAssignInExpressions` | Used intentionally in some loops |
| `useMaxParams` | Many functions legitimately need multiple params |
| `useLiteralEnumMembers` | Conflicts with computed enum values |

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

- [ ] **#1230 - Copy fields for printing** — Users want to extract form field data for printing. Phase 1: expose internal `getFontSize()` and `getFontColor()` getters that already exist internally. Phase 2: proper field cloning. https://github.com/Hopding/pdf-lib/issues/1230

## TypeScript Strict Mode Cleanup

- [ ] **`opentype/shapers/IndicShaper.ts`** — 1100+ lines, ~126 type errors. Complex Indic script shaping state machine. Requires significant refactoring.
