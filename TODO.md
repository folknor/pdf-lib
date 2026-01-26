# TODO for @folknor/pdf-lib

## Completed

### TypeScript Strict Flags
- [x] `noImplicitOverride` (~110 methods)
- [x] `noPropertyAccessFromIndexSignature` (~55 bracket notations)
- [x] `noUncheckedIndexedAccess` (582 errors fixed)

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

---

## Remaining

### High Priority
- [ ] `exactOptionalPropertyTypes` (~50 errors)

### Medium Priority
- [ ] Review exports field - consider `./core`, `./utils` entry points
- [ ] Release workflow - `"release"` script or changesets

### Intentionally Disabled (too noisy or conflicts with codebase)
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

## Final Checklist
- [ ] `pnpm build && pnpm test && pnpm lint` passes
- [ ] Delete this file
