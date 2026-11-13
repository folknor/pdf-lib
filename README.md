# @folknor/pdf-lib

Fork of [cantoo-scribe/pdf-lib](https://github.com/cantoo-scribe/pdf-lib), which is a fork of [Hopding/pdf-lib](https://github.com/Hopding/pdf-lib).

Built with LLMs. See [LLM.md](LLM.md).


## Changes from upstream

- ESM-only (no CJS/UMD)
- TypeScript with stricter settings
- Biome instead of ESLint/Prettier
- Vitest instead of Jest
- pnpm instead of yarn
- Truncated PDFs (an indirect object with no `endobj`) are rejected on load rather than silently dropping the unfinished object
- No `convertToPDFA()`. Upstream's version writes a PDF/A identification, output intent and XMP packet without converting or checking content (unembedded standard fonts, uncovered device colour and the like still claim conformance), regenerates XMP from the Info dictionary at every save (losing richer or XMP-only values), and drops XMP blocks that mix its namespaces with others. A declaration-only facility that preserves existing metadata may come later.
- Saving with `useObjectStreams: true` raises the declared version to 1.5 when it is lower: the header on a full save, the catalog `/Version` in an increment (whose header is the original file's)

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

An encrypted file loaded with its `password` is updated under its own
encryption. When `password` is omitted, the empty user password is tried
first, as standard readers do, so owner-password-only ("restricted") files
load decrypted and editable without one. After `encrypt()`, `save()` rewrites
the whole file and `saveIncremental()`/`commit()` throw. An encrypted file
that could not be decrypted throws `EncryptedPDFError`, or with
`ignoreEncryption` loads for inspection only: saving it in any way,
encrypting it, and copying or embedding its pages all throw.

### JPEG EXIF orientation

Read EXIF orientation from JPEG images:

```ts
const image = await pdfDoc.embedJpg(jpgBytes);
const orientation = image.orientation; // 1-8 or undefined

// Apply rotation based on orientation:
// 1=normal, 3=180°, 6=90°CW, 8=90°CCW
// 5-8 also swap width/height
if (orientation === 6) {
  page.drawImage(image, {
    x, y,
    width: image.height, // swapped
    height: image.width,
    rotate: degrees(90),
  });
}
```

### Optimized page copying

When copying pages from documents with many shared resources (fonts, images), use `optimizeResources` to only copy resources that are actually used:

```ts
const srcDoc = await PDFDocument.load(largeDocBytes);
const destDoc = await PDFDocument.create();

// Without optimization - copies ALL resources from source, even unused ones
const [page] = await destDoc.copyPages(srcDoc, [0]);

// With optimization - only copies resources used by the page
const [optimizedPage] = await destDoc.copyPages(srcDoc, [0], { optimizeResources: true });
```

This can significantly reduce file size when copying pages from documents where pages share a large resource pool (common with scanned documents or documents created by merging tools).

## Docs

See [pdf-lib.js.org](https://pdf-lib.js.org/) for upstream documentation.
