# Modernization Plan for @folknor/pdf-lib

This document tracks remaining work to fully modernize the codebase.

---

## Completed

- [x] Migrate from yarn to pnpm 10.28.1
- [x] Remove CJS/UMD builds, ESM-only output
- [x] Upgrade TypeScript to 5.9.3 with ES2022 target
- [x] Migrate to `nodenext` moduleResolution with explicit `.js` extensions
- [x] Migrate from Jest to Vitest
- [x] Update ESLint to flat config with typescript-eslint
- [x] Enable `noImplicitOverride` (~110 methods updated)
- [x] Enable `noPropertyAccessFromIndexSignature` (~55 bracket notations)
- [x] Fix ESLint rules: `ban-ts-comment`, `no-empty-object-type`, `no-unused-expressions`
- [x] Remove husky/lint-staged

---

## Phase 1: `noUncheckedIndexedAccess` (582 errors)

**Status:** Pending

**Impact:** Every array access `arr[i]` and object access `obj[key]` returns `T | undefined`.

**Hotspots:**
- `src/core/crypto.ts` - 187 errors
- `src/api/svgPath.ts` - 73 errors
- `src/core/parser/*.ts` - Heavy byte array parsing
- `src/utils/*.ts` - Utility functions

**Strategies:**
1. **Non-null assertion** when certain the index exists: `arr[i]!`
2. **Explicit checks:** `if (item === undefined) throw new Error(...)`
3. **Nullish coalescing:** `arr[i] ?? defaultValue`
4. **Refactor to safer methods:** `arr.at(0)`

---

## Phase 2: `exactOptionalPropertyTypes` (~50 errors)

**Status:** Pending

**Impact:** Can't pass `{ prop: undefined }` to `{ prop?: T }` - must omit the property.

**Strategies:**
1. Filter out undefined values before passing
2. Use a helper: `omitUndefined(obj)`
3. Update types to `prop?: T | undefined` where undefined is valid

---

## Phase 3: Eliminate `any` Types (61 warnings)

**Status:** Pending

**Impact:** ESLint currently warns on 61 uses of `any`. These represent type safety gaps.

**Action:** Replace `any` with proper types:
- Use `unknown` for truly unknown data, then narrow with type guards
- Define proper interfaces for structured data
- Use generics where appropriate

---

## Phase 4: Build & Publishing Improvements

**Status:** Pending

### 4a. Tree-shaking optimization
Add to `package.json`:
```json
"sideEffects": false
```

### 4b. Review exports field
Consider if the package needs additional entry points:
```json
"exports": {
  ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
  "./core": { "types": "./dist/core/index.d.ts", "import": "./dist/core/index.js" }
}
```

### 4c. Remove apps/ directory
The `apps/` folder contains example/test apps that shouldn't be in the published package. Either:
- Delete it entirely, or
- Add to `.npmignore`

### 4d. Audit devDependencies
Review if all dev dependencies are still needed after the migration.

---

## Phase 5: Consider Biome

**Status:** Optional

Replace ESLint + Prettier with [Biome](https://biomejs.dev/):
- Single tool for linting and formatting
- Significantly faster (written in Rust)
- Compatible configuration

**Trade-off:** Less ecosystem/plugin support than ESLint.

---

## Phase 6: Release Workflow

**Status:** Pending

Options:
1. **Simple script:** Add `"release": "pnpm build && pnpm test && npm publish"`
2. **Changesets:** Use `@changesets/cli` for versioning and changelogs
3. **Manual:** Document the release process in CONTRIBUTING.md

---

## Cleanup

When all phases complete:
- [ ] Delete this file (STRICT_MODE_PLAN.md)
- [ ] Verify `pnpm build && pnpm test && pnpm lint` passes with zero errors/warnings

---

## Priority Order

1. **Phase 1** - `noUncheckedIndexedAccess` (catches real bugs)
2. **Phase 3** - Eliminate `any` (improves type safety)
3. **Phase 4** - Build improvements (better for consumers)
4. **Phase 2** - `exactOptionalPropertyTypes` (stricter but lower impact)
5. **Phase 5** - Biome (optional, nice-to-have)
6. **Phase 6** - Release workflow (needed before first publish)
