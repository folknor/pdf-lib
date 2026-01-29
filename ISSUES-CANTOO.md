# cantoo-scribe/pdf-lib Issues Analysis

This is the upstream fork we're based on. It's an actively maintained fork of Hopding/pdf-lib with significant enhancements including PDF encryption, improved SVG support, and many bug fixes.

**Repository**: https://github.com/cantoo-scribe/pdf-lib
**NPM Package**: `@cantoo/pdf-lib`

---

## Open Pull Requests (Actionable)

### PR #133 - TypeScript 5.9 Compatibility (DRAFT)
Restricts Uint8Array types from `Uint8Array<ArrayBufferLike>` to `Uint8Array<ArrayBuffer>` for TypeScript 5.9+ compatibility.
- **Status**: **IMPLEMENTED IN THIS FORK** - Public API now uses `Uint8Array<ArrayBuffer>` for parameters and return types. Users can now do `new Blob([pdfBytes.buffer])` without TypeScript errors.
- **Impact**: Fixes TypeScript 5.9+ compatibility

### PR #121 - Text Markup Annotations
Adds support for text markup annotations (highlight, underline, strikeout, squiggly).
- **Status**: **IMPLEMENTED IN THIS FORK** - Added `AnnotationTypes` enum, `AnnotationFactory`, `PDFTextMarkupAnnotation` class, and `PDFPage.annotations()` / `PDFPage.addTextMarkupAnnotation()` methods.
- **Impact**: New annotation features

### PR #111 - Incremental Update Implementation
Implements incremental PDF updates for PAdES/LTV digital signature compliance.
- **Status**: **IMPLEMENTED IN THIS FORK** - Added `takeSnapshot()`, `commit()`, and `saveIncremental()` methods. Load with `{ forIncrementalUpdate: true }` to enable. Includes bug fixes (preserve original PDF version) and performance optimizations (Set-based change tracking).
- **Impact**: Critical for digital signature workflows; preserves original PDF bytes
- **Use case**: Required for long-term validation (LTV) signatures

---

## Open Issues

### Critical / High Priority

#### #122 - CIDSystemInfo Not Set in Password-Protected PDFs
Registry and Ordering fields in CIDFont CIDSystemInfo structure are not properly handled during PDFObjectCopier for password-protected PDFs. After decryption, these fields remain as encrypted binary data instead of being decrypted.
- **Symptoms**: Text doesn't display in regenerated password-protected PDFs
- **Root cause**: PDFObjectCopier copies encrypted values as-is instead of decrypting them
- **Workaround**: Force set `Registry: "Adobe"` and `Ordering: "Identity"`
- **Related**: #120 (same root cause)
- **Status**: **POTENTIALLY FIXED** - The PR #130 literal string decryption fix we implemented may resolve this issue, as it fixes how encrypted literal strings are decrypted (using `decryptBytes()` with proper byte conversion instead of `decryptString()`). The parser correctly passes the parent object's `ref` down to nested dictionaries for decryption. Needs verification with a test PDF that exhibits this issue.

#### #120 - Text Missing After Saving PDF
Text disappears after saving certain PDFs.
- **Related to**: #122 (CIDSystemInfo issue)
- **Status**: Linked to same root cause

#### #86 - Form Field Content Lost After Flatten
When flattening PDFs filled by external applications (like Adobe Acrobat), field values may not appear.
- **Root cause**: External apps may store values differently (in /V vs appearance stream)
- **Status**: **FIXED IN THIS FORK** - `flatten()` now automatically marks all fields dirty by default before updating appearances. Use `markFieldsAsDirty: false` option to skip this if not needed.

#### #55 - Form Field setText Not Respecting Embedded Fonts
Text set via setText() doesn't use the font embedded in the PDF form field.
- **Root cause**: Font descriptor parsing may not match pdf-lib expectations
- **Status**: Needs investigation

### Build / Module Issues

#### #132 - TypeScript >= 5.9 Compatibility
TypeScript 5.9 changed Uint8Array type handling causing compile errors.
- **Status**: Has draft PR #133

#### #85 - UPNG.decode Error with ESM
`UPNG.decode is not a function` error when using ESM modules.
- **Root cause**: UPNG CommonJS module not properly exported for ESM
- **Status**: Fixed in v2.4.5
- **Related**: #72, #24

#### #72 - Error Embedding PNG
Same root cause as #85 - ESM/CommonJS interop issue with UPNG.
- **Status**: Fixed in v2.4.5

#### #24 - Update Pako Dependency
Request to update pako to ^2.0.2 for better tree shaking.
- **Status**: Open, would help with bundle size

### Feature Requests

#### #105 - Add Layers Management
Feature request for PDF layer (Optional Content Groups) management.
- **Status**: Help wanted

#### #98 - PDF/A Conversion
Feature request to convert PDFs to PDF/A format.
- **Status**: Help wanted

#### #95 - SVG Pattern/Defs Not Supported
Error when SVG fill uses `url(#pattern)`.
- **Root cause**: SVG `<defs>` and `<pattern>` elements not implemented
- **Complexity**: Requires implementing pattern tiling with clipping
- **Status**: Help wanted

#### #91 - Get Embedded Image Size/Position
Feature request to retrieve size and position of embedded images, or calculate PPI.
- **Status**: Help wanted

#### #73 - PDF Compression
Feature request for PDF file compression.
- **Status**: Help wanted

#### #68 - Deflating Streams
Feature request for stream deflation/compression.
- **Status**: Help wanted

### Parsing / Encryption Issues

#### #96 - PDFNull Instead of PDFDict
Error: "Expected instance of PDFDict, but got instance of PDFNull"
- **Status**: **FIXED IN THIS FORK** - Multiple locations now use `lookupMaybe()` instead of `lookup()` with graceful undefined handling. Fixed in: PDFAcroTerminal.getWidgets(), PDFForm.findWidgetAppearanceRef(), PDFDocument.getRawAttachments(), PDFDocument.getSavedAttachments(), PDFAnnotation.getAppearances(), PDFEmbeddedFile.embedIntoContext().

#### #69 - Images Corrupted in Encrypted PDF Clone
Image objects get corrupted when cloning/saving encrypted PDFs.
- **Workaround**: Use qpdf CLI for decryption before processing
- **Status**: Help wanted

#### #65 - Deep Clone Decrypted PDFDocument Error
Error when creating deep clone of decrypted PDFDocument object.
- **Workaround**: Use qpdf for decryption
- **Status**: Help wanted

#### #64 - Failed to Parse Number
Parsing error at specific file offset.
- **Status**: Needs investigation with repro file

#### #63 - Failed to Parse Invalid PDF Object
Generic parsing failure.
- **Status**: Needs investigation with repro file

### Minor Issues

#### #128 - Missing Page Index for Acrofield Widget
Cannot get page index for form field widgets.
- **Status**: Bug, needs triage

#### #118 - Remove Form Fields and Comments
User question about removing form fields and annotations.
- **Status**: Support question (feature exists via form.removeField)

#### #112 - Can't Read Attachments Without Description
Attachments missing the description field caused errors.
- **Status**: Fixed by PR #113

#### #106 - Catalog Missing in Saved PDF
Catalog not present when saving PDF in Next.js client-side.
- **Root cause**: Environment-specific issue, works on server side
- **Status**: User confirmed works server-side

#### #89 - Attachment Names Cause Acrobat Error
Some attachment names cause errors in Acrobat Reader.
- **Workaround**: Add attachments in lexical order (1.jpg, 10.jpg, 2.jpg)
- **Status**: Help wanted

#### #71 - Save to Specific File Path
Feature request for `save(filePath)` method.
- **Status**: Open

#### #67 - Add packageManager Field
Request to add packageManager field to package.json for reliable dependency management.
- **Status**: Open

#### #27 - Support Non PDF/A Compliant PDFs
Request for better handling of non-compliant PDFs.
- **Status**: Help wanted

---

## Closed Issues (Already Fixed)

#29, #32, #33, #34, #40, #41, #44, #49, #51, #58, #59, #61, #70, #75, #76, #90, #97, #100, #101, #104, #107, #108, #115, #116, #125, #127, #131

---

## Priority Items for This Fork

### Done in This Fork
- **PR #130** - Literal string decryption fix ✓
- **#96** - PDFNull graceful handling ✓
- **#86** - Auto-dirty fields before flatten ✓
- **PR #121** - Text markup annotations ✓
- **PR #111** - Incremental updates for digital signatures ✓
- **PR #133** - TypeScript 5.9 compatibility ✓

### Should Investigate/Fix
1. **#122/#120** - CIDSystemInfo encryption issue (potentially fixed by PR #130, needs verification)
2. **#55** - setText font handling

### Consider for Future
1. **#95** - SVG pattern support
