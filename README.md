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
- No `convertToPDFA()`. Upstream's version writes a PDF/A identification, output intent and XMP packet without converting or checking content (unembedded standard fonts, uncovered device colour and the like still claim conformance), regenerates XMP from the Info dictionary at every save (losing richer or XMP-only values), and drops XMP blocks that mix its namespaces with others. `declarePDFA()` (below) declares instead, preserving existing metadata.
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
The catalog XMP metadata stream is never compressed.

### PDF/A declaration

Declare a document PDF/A-1B, -2B, -2U, -3B or -3U:

```ts
pdfDoc.declarePDFA({ part: 3, conformance: 'B' });
```

This writes the `pdfaid` identification into the catalog XMP (editing an existing packet, never rebuilding it), an output intent (a generated sRGB profile unless `outputIntent` is given; existing output intents are kept, never replaced) and a trailer `/ID`. It is a declaration, not a conversion: fonts, colour, transparency and actions are neither checked nor changed. `getPDFADeclaration()` reads the identification from the XMP.

Whether a document declares PDF/A is read from its XMP on every check, so a loaded PDF/A file is treated the same way, and XMP that cannot be read counts as a possible declaration. Such a document refuses `encrypt()` and every encrypted write (including increments of a file loaded with its password); for PDF/A-1 it writes no object or cross-reference streams and refuses increments onto a file that has them; Info setters also update the matching XMP property, and loading leaves its Info and XMP untouched. `attach()` checks each new attachment, when called and when it is written at save, against the declaration then present: refused for PDF/A-1 (and for XMP that cannot be read, an unknown part or PDF/A-4 conformance); for PDF/A-3 and PDF/A-4 it needs `mimeType`, `afRelationship` and `modificationDate`; for PDF/A-2 and base PDF/A-4 the attached file must itself be PDF/A, which is not checked. Attachments already in the document are not checked.

A declaration is refused for a file whose version is not PDF 1.0 to 1.7.

### Factur-X / ZUGFeRD e-invoices

Make a document a Factur-X (ZUGFeRD 2) hybrid invoice:

```ts
pdfDoc.embedFacturX(invoiceXml, { afRelationship: AFRelationship.Alternative });
```

The CII invoice XML (UTF-8 bytes, or text) is attached as `factur-x.xml` and listed in the catalog `/AF`, replacing an earlier `factur-x.xml`; the catalog XMP gets the `fx` properties and their PDF/A extension schema; a document that declares no PDF/A is declared PDF/A-3B as by `declarePDFA()`, and one that declares PDF/A-3A, -3B or -3U keeps it. The profile (MINIMUM, BASIC WL, BASIC, EN 16931 or EXTENDED) is read from the XML's guideline identifier; `conformanceLevel` only asserts it. MINIMUM and BASIC WL invoices are attached as `Data`; for the other profiles `afRelationship` is required (`Data`, `Source` or `Alternative`, depending on how the PDF was produced). XRECHNUNG is not supported. The invoice is not validated, and the PDF content is not made PDF/A: validate both (veraPDF, a Factur-X checker).

Upstream's `embedFacturX()` is not ported: it rests on `convertToPDFA()`, defaults the profile to EN 16931 whatever the XML states, defaults every profile to `Alternative`, and takes a string as base64 rather than as XML.

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
