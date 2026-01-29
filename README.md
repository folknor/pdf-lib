# @folknor/pdf-lib

Fork of [cantoo-scribe/pdf-lib](https://github.com/cantoo-scribe/pdf-lib), which is a fork of [Hopding/pdf-lib](https://github.com/Hopding/pdf-lib).

## Changes from upstream

- ESM-only (no CJS/UMD)
- TypeScript 5.x with stricter settings
- Biome instead of ESLint/Prettier
- Vitest instead of Jest
- pnpm instead of yarn

## Install

```bash
pnpm install @folknor/pdf-lib
```

## Fork-specific features

### Stream compression

Compress uncompressed streams when saving:

```ts
const pdfBytes = await pdfDoc.save({ compress: true });
```

Useful when loading PDFs with uncompressed streams - output will be smaller.

### Widget page index

Get the page a form field widget is on:

```ts
const field = form.getField('myField');
const pageIndex = field.getWidgetPageIndex(); // 0-based
const page = field.getWidgetPage();
const widgets = field.getWidgets();
```

### Incremental saves

For digital signature workflows (PAdES/LTV):

```ts
const pdfDoc = await PDFDocument.load(bytes, { forIncrementalUpdate: true });
// ... make changes ...
const pdfBytes = await pdfDoc.save(); // preserves original bytes
```

## Docs

See [pdf-lib.js.org](https://pdf-lib.js.org/) for upstream documentation.
