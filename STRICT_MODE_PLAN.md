# Plan to Re-enable Strict TypeScript and ESLint Settings

This document outlines the work needed to re-enable the strict settings that were temporarily disabled during the modernization of the codebase.

## Disabled Settings

### TypeScript (`tsconfig.json`)

1. **`noImplicitOverride`** - Requires explicit `override` modifier on methods that override base class methods
2. **`noUncheckedIndexedAccess`** - Array/object index access returns `T | undefined` instead of `T`
3. **`exactOptionalPropertyTypes`** - Can't pass `undefined` to optional properties (must omit the property entirely)
4. **`noPropertyAccessFromIndexSignature`** - Must use bracket notation for index signature access

### ESLint (`eslint.config.js`)

1. **`@typescript-eslint/ban-ts-comment`** - Currently off; should require descriptions for `@ts-ignore`
2. **`@typescript-eslint/no-empty-object-type`** - Currently off; flags empty interfaces
3. **`@typescript-eslint/no-unused-expressions`** - Currently off; flags expression statements with no effect

---

## Phase 1: `noImplicitOverride` (Estimated: ~100 changes)

**Impact:** Methods overriding base class methods need `override` keyword.

**Files affected:**
- `src/api/form/PDFButton.ts` (3 methods)
- `src/api/form/PDFCheckBox.ts` (3 methods)
- `src/api/form/PDFDropdown.ts` (3 methods)
- `src/api/form/PDFOptionList.ts` (3 methods)
- `src/api/form/PDFRadioGroup.ts` (3 methods)
- `src/api/form/PDFSignature.ts` (2 methods)
- `src/api/form/PDFTextField.ts` (3 methods)
- `src/core/acroform/*.ts` (7 files)
- `src/core/annotation/PDFWidgetAnnotation.ts`
- `src/core/crypto.ts` (2 methods)
- `src/core/embedders/*.ts` (4 files)
- `src/core/objects/*.ts` (~15 files, multiple methods each)
- `src/core/streams/*.ts` (6 files)
- `src/core/structures/*.ts` (8 files)
- `src/core/writers/PDFStreamWriter.ts`

**Action:** Add `override` keyword before each method that overrides a parent class method.

**Example:**
```typescript
// Before
clone(context?: PDFContext): PDFArray { ... }

// After
override clone(context?: PDFContext): PDFArray { ... }
```

---

## Phase 2: `noUncheckedIndexedAccess` (Estimated: ~50-100 changes)

**Impact:** Every array access `arr[i]` and object access `obj[key]` returns `T | undefined`.

**Files affected:** Throughout codebase where arrays/objects are indexed.

**Strategies:**
1. **Use non-null assertion** when you're certain the index exists:
   ```typescript
   const item = arr[i]!;
   ```

2. **Add explicit checks:**
   ```typescript
   const item = arr[i];
   if (item === undefined) throw new Error('...');
   ```

3. **Use optional chaining with nullish coalescing:**
   ```typescript
   const item = arr[i] ?? defaultValue;
   ```

4. **Refactor to use safer methods:**
   ```typescript
   // Instead of arr[0]
   const item = arr.at(0); // Already returns T | undefined
   ```

**Priority files:**
- `src/api/PDFDocument.ts` - Heavy array usage for pages
- `src/api/PDFPage.ts` - Content stream operations
- `src/core/parser/*.ts` - Byte array parsing
- `src/utils/*.ts` - Utility functions

---

## Phase 3: `exactOptionalPropertyTypes` (Estimated: ~50 changes)

**Impact:** Can't pass `{ prop: undefined }` to `{ prop?: T }` - must omit the property.

**Files affected:**
- `src/api/PDFPage.ts` (many drawing methods)
- `src/api/operations.ts`
- Other files passing optional properties

**Strategies:**
1. **Filter out undefined values before passing:**
   ```typescript
   // Before
   drawText({ opacity: options.opacity }); // opacity might be undefined

   // After
   drawText({
     ...(options.opacity !== undefined && { opacity: options.opacity }),
   });
   ```

2. **Use a helper function:**
   ```typescript
   function omitUndefined<T extends object>(obj: T): T {
     return Object.fromEntries(
       Object.entries(obj).filter(([_, v]) => v !== undefined)
     ) as T;
   }
   ```

3. **Change type definitions** to allow `undefined` where appropriate:
   ```typescript
   // If undefined is valid, update the type
   interface Options {
     opacity?: number | undefined;
   }
   ```

---

## Phase 4: `noPropertyAccessFromIndexSignature` (Estimated: ~20 changes)

**Impact:** Must use `obj['prop']` instead of `obj.prop` for index signatures.

**Files affected:**
- `src/api/PDFDocument.ts` (line 1345: `href` access)
- Other files using index signatures

**Action:** Change dot notation to bracket notation for index signature properties.

```typescript
// Before
element.attributes.href

// After
element.attributes['href']
```

---

## Phase 5: ESLint Rules

### 5a. `@typescript-eslint/ban-ts-comment`

**Action:** Add descriptions to all `@ts-ignore` comments or convert to `@ts-expect-error`.

**Files affected:**
- `src/core/crypto.ts` (lines 83, 103, 109, 147)
- `src/utils/intersections.ts` (line 197)

```typescript
// Before
// @ts-ignore

// After
// @ts-expect-error - Legacy PDF structure doesn't match modern types
```

### 5b. `@typescript-eslint/no-empty-object-type`

**File:** `src/api/PDFDocumentOptions.ts` (line 11)

**Action:** Either add a meaningful property or use a different pattern:
```typescript
// Option 1: Add a discriminator or marker property
interface LoadOptions extends BaseOptions {
  readonly _brand?: 'LoadOptions';
}

// Option 2: Use type alias instead
type LoadOptions = BaseOptions;
```

### 5c. `@typescript-eslint/no-unused-expressions`

**File:** `src/api/svg.ts` (lines 816, 818)

**Action:** Refactor to use proper statements:
```typescript
// Before (expression with no effect)
someValue;

// After (if it's intentional, use void)
void someValue;

// Or refactor the logic
```

---

## Implementation Order

1. **Phase 1** (`noImplicitOverride`) - Lowest risk, mechanical changes
2. **Phase 5** (ESLint rules) - Small scope, easy wins
3. **Phase 4** (`noPropertyAccessFromIndexSignature`) - Small scope
4. **Phase 2** (`noUncheckedIndexedAccess`) - Medium risk, requires careful review
5. **Phase 3** (`exactOptionalPropertyTypes`) - Highest complexity, may need type refactoring

---

## Testing Strategy

After each phase:
1. Run `pnpm build` to verify compilation
2. Run `pnpm test` to verify all tests pass
3. Run `pnpm lint` to verify no new lint errors

---

## Success Criteria

All phases complete when:
- All commented-out tsconfig options are uncommented and enabled
- All ESLint rules set to `'off'` are changed to `'error'`
- `pnpm build && pnpm test && pnpm lint` passes with zero errors
