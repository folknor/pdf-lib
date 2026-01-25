# Modernization Plan for @folknor/pdf-lib

This document tracks remaining work to fully modernize the codebase.

---

## Completed

- [x] Migrate from yarn to pnpm 10.28.1
- [x] Remove CJS/UMD builds, ESM-only output
- [x] Upgrade TypeScript to 5.9.3 with ES2022 target
- [x] Migrate to `nodenext` moduleResolution with explicit `.js` extensions
- [x] Migrate from Jest to Vitest
- [x] Replace ESLint+Prettier with Biome
- [x] Enable `noImplicitOverride` (~110 methods updated)
- [x] Enable `noPropertyAccessFromIndexSignature` (~55 bracket notations)
- [x] Remove husky/lint-staged

---

## Phase 1: TypeScript Strict Flags

### 1a. `noUncheckedIndexedAccess` (582 errors)

**Status:** Pending

Every array/object index access returns `T | undefined`.

**Hotspots:**
- `src/core/crypto.ts` - 187 errors
- `src/api/svgPath.ts` - 73 errors
- `src/core/parser/*.ts` - Heavy byte array parsing

### 1b. `exactOptionalPropertyTypes` (~50 errors)

**Status:** Pending

Can't pass `{ prop: undefined }` to `{ prop?: T }`.

---

## Phase 2: Biome Rules - Suspicious

| Rule | Status | Description |
|------|--------|-------------|
| `noExplicitAny` | off | Disallow `any` type |
| `noImplicitAnyLet` | off | Disallow `let` without type when inferred as `any` |
| `noEvolvingTypes` | off | Disallow variables that evolve types |
| `noDoubleEquals` | off | Require `===` and `!==` |
| `noConfusingVoidType` | off | Disallow confusing `void` type usage |
| `noTsIgnore` | off | Disallow `@ts-ignore` |
| `noConsole` | off | Disallow `console.*` |
| `useErrorMessage` | off | Require error messages in `throw new Error()` |
| `noUnassignedVariables` | off | Disallow unassigned variables |
| `noMisplacedAssertion` | off | Disallow assertions in wrong places |
| `useIterableCallbackReturn` | off | Disallow returning values from `.forEach()` |
| `noControlCharactersInRegex` | off | Disallow control characters in regex |
| `noAssignInExpressions` | off | Disallow assignments in expressions |

---

## Phase 3: Biome Rules - Nursery

| Rule | Status | Description |
|------|--------|-------------|
| `noFloatingPromises` | off | Require handling of promises |
| `noMisusedPromises` | off | Disallow promises in wrong contexts |
| `noUnnecessaryConditions` | off | Disallow always-true/false conditions |
| `noShadow` | off | Disallow variable shadowing |
| `noImportCycles` | off | Disallow circular imports |
| `noUnusedExpressions` | off | Disallow expressions with no effect |
| `noUselessUndefined` | off | Disallow useless `undefined` |
| `noUselessCatchBinding` | off | Disallow unused catch bindings |
| `noParametersOnlyUsedInRecursion` | off | Flag params only used in recursion |
| `useMaxParams` | off | Limit function parameters |
| `useExplicitType` | off | Require explicit return types |
| `useConsistentArrowReturn` | off | Consistent arrow function returns |
| `useArraySortCompare` | off | Require compare function in `.sort()` |

---

## Phase 4: Biome Rules - Complexity

| Rule | Status | Description |
|------|--------|-------------|
| `noBannedTypes` | off | Disallow `Function`, `Object`, etc. (see 4a) |

### 4a. Fixing `noBannedTypes` - The Constructor Problem

**Problem:** `src/utils/validators.ts` uses `[Function, string]` tuples for runtime type validation. This allows code like:

```typescript
assertIs(value, 'pages', [[PDFPage, 'PDFPage']]);
```

The `Function` type is banned because it's too loose, but replacing it with a proper constructor type like `new (...args: any[]) => any` fails because many classes (`PDFDocument`, `PDFPage`, `PDFRef`, etc.) have **private or protected constructors**.

**Root cause:** TypeScript's constructor types require public constructors, but private constructors are used throughout the codebase for factory patterns.

**Solution options:**

1. **Use `typeof` pattern** (Recommended)
   ```typescript
   type ClassType<T> = { prototype: T };
   type TypeDescriptor = ... | [ClassType<unknown>, string];
   ```
   This matches any class by its prototype, not its constructor signature.

2. **Use branded type with `Function`**
   ```typescript
   type AnyClass = Function & { prototype: unknown };
   ```
   Still uses `Function` but more constrained.

3. **Refactor to avoid runtime type checking**
   Replace `assertIs()` calls with TypeScript type guards. More work but cleaner.

**Files to modify:**
- `src/utils/validators.ts` - Core type definitions
- All files using `assertIs()` with class tuples (~50+ call sites)

**Testing:** Run `pnpm build` after changes - TypeScript will catch any mismatches.
| `noForEach` | off | Prefer `for...of` over `.forEach()` |
| `noImplicitCoercions` | off | Disallow implicit type coercions |
| `noUselessStringConcat` | off | Disallow useless string concatenation |
| `useSimplifiedLogicExpression` | off | Simplify boolean expressions |

---

## Phase 5: Biome Rules - Style

| Rule | Status | Description |
|------|--------|-------------|
| `noNonNullAssertion` | off | Disallow `!` assertions (enable after Phase 1a) |

---

## Phase 6: Biome Rules - Performance

| Rule | Status | Description |
|------|--------|-------------|
| `noBarrelFile` | off | Disallow barrel files (index.ts re-exports) |
| `noReExportAll` | off | Disallow `export * from` |
| `noNamespaceImport` | off | Disallow `import * as` |

**Note:** These may conflict with the current codebase structure. Evaluate if restructuring is worth it.

---

## Phase 7: Biome Rules - Correctness

| Rule | Status | Description |
|------|--------|-------------|
| `noUndeclaredVariables` | off | Flag undeclared variables |
| `noProcessGlobal` | off | Disallow `process` global |

---

## Phase 8: Build & Publishing

### 8a. Tree-shaking
Add `"sideEffects": false` to package.json.

### 8b. Review exports field
Consider additional entry points for `./core`, `./utils`.

### 8c. Remove apps/ directory
Delete or add to `.npmignore`.

### 8d. Audit devDependencies
Remove unused packages.

---

## Phase 9: Release Workflow

Options:
1. Simple script: `"release": "pnpm build && pnpm test && npm publish"`
2. Changesets for versioning/changelogs
3. Document in CONTRIBUTING.md

---

## Cleanup

When complete:
- [ ] Delete this file
- [ ] `pnpm build && pnpm test && pnpm lint` passes with zero errors/warnings

---

## Priority Order

1. **Phase 1a** - `noUncheckedIndexedAccess` (catches real bugs)
2. **Phase 2** - Suspicious rules (type safety)
3. **Phase 3** - Nursery rules (promise handling, shadowing)
4. **Phase 4** - Complexity rules (code quality)
5. **Phase 1b** - `exactOptionalPropertyTypes`
6. **Phase 5** - Style rules (after Phase 1a)
7. **Phase 6** - Performance rules (evaluate tradeoffs)
8. **Phase 7** - Correctness rules
9. **Phase 8** - Build improvements
10. **Phase 9** - Release workflow
