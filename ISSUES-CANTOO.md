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
- **Root cause**: Encrypted literal strings weren't being decrypted properly
- **Related**: #120 (same root cause)
- **Status**: Unverified - no test PDF available

#### #120 - Text Missing After Saving PDF
Text disappears after saving certain PDFs.
- **Related to**: #122 (CIDSystemInfo issue)
- **Status**: Unverified - no test PDF available

#### #86 - Form Field Content Lost After Flatten
When flattening PDFs filled by external applications (like Adobe Acrobat), field values may not appear.
- **Root cause**: External apps may store values differently (in /V vs appearance stream)
- **Status**: **FIXED IN THIS FORK** - `flatten()` now automatically marks all fields dirty by default before updating appearances. Use `markFieldsAsDirty: false` option to skip this if not needed.

#### #55 - Form Field setText Not Respecting Embedded Fonts
Text set via setText() doesn't use the font embedded in the PDF form field.
- **Root cause**: pdf-lib always defaults to Helvetica when regenerating form field appearances. The DA (Default Appearance) string is parsed for font size/color, but the **font name is never used to look up existing fonts**.
- **Missing functionality**: No mechanism to retrieve fonts already embedded in the PDF from the DR (Default Resources) dictionary
- **Complexity**: HIGH - Would require:
  1. Add DR dictionary access to PDFAcroForm
  2. Create font lookup/retrieval mechanism from PDF resources
  3. Handle subsetted fonts (may not contain all needed glyphs)
  4. Modify appearance update logic to resolve fonts from DA
- **Workaround**: Embed matching font externally and pass to `updateAppearances(font)`
- **Status**: Architecture limitation, significant work needed

### Encryption / Cloning Issues

#### #69 - Images Corrupted in Encrypted PDF Clone
Image objects get corrupted when cloning/saving encrypted PDFs.
- **Root cause**: **Architecture issue** - Streams are decrypted during parsing using the original object reference's encryption key. When saved, objects may have different reference numbers, causing re-encryption with wrong keys.
- **Key insight**: PDF encryption keys are derived per-object based on object number + generation number
- **Complexity**: HIGH - Would need to track decryption state per-stream or maintain original object references
- **Workaround**: Use `qpdf --decrypt input.pdf output.pdf` before processing
- **Status**: Requires architectural changes

#### #65 - Deep Clone Decrypted PDFDocument Error
Error when creating deep clone of decrypted PDFDocument object (`this.catalog.Pages is not a function`).
- **Root cause**: Related to #69 - when decryption fails for certain objects, they become `PDFInvalidObject`. The `PDFDocument` constructor blindly casts to `PDFCatalog` without validation.
- **Contributing factors**:
  1. Decryption failure creates invalid objects
  2. No validation of catalog type in constructor
- **Complexity**: MEDIUM - Could add validation and better error messages
- **Workaround**: Use `qpdf --decrypt` before processing
- **Status**: Related to #69 encryption architecture

### Build / Module Issues

#### #132 - TypeScript >= 5.9 Compatibility
TypeScript 5.9 changed Uint8Array type handling causing compile errors.
- **Status**: **FIXED IN THIS FORK** - See PR #133 above

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
- **Status**: **FIXED IN THIS FORK**

### Quick Wins

#### #128 - Missing Page Index for Acrofield Widget
Cannot get page index for form field widgets.
- **Root cause**: Core functionality exists (`findWidgetPage` in PDFForm) but is **private**
- **Solution**: Expose public API on `PDFField`:
  - `getWidgetPage(widgetIndex?: number): PDFPage | undefined`
  - `getWidgetPageIndex(widgetIndex?: number): number | undefined`
  - `getWidgets(): PDFWidgetAnnotation[]`
- **Status**: **FIXED IN THIS FORK** - Added all three methods to `PDFField` class

#### #89 - Attachment Names Cause Acrobat Error
Some attachment names cause errors in Acrobat Reader.
- **Root cause**: PDF spec requires EmbeddedFiles Names array to be **lexically sorted**. Current code just `push()`es to the end without maintaining sort order. Acrobat uses binary search on the Names array.
- **Solution**: Insert attachments at correct position to maintain lexical sort order
- **Status**: **FIXED IN THIS FORK** - `PDFEmbeddedFile.embed()` now inserts at correct sorted position

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
- **Status**: **FIXED IN THIS FORK** - Added `compress: boolean` option to `save()` and `saveIncremental()`. When enabled, compresses uncompressed streams using FlateDecode.

#### #68 - Deflating Streams
Feature request for stream deflation/compression.
- **Status**: **FIXED IN THIS FORK** - Same as #73, use `save({ compress: true })`

### Parsing Issues

#### #96 - PDFNull Instead of PDFDict
Error: "Expected instance of PDFDict, but got instance of PDFNull"
- **Status**: **FIXED IN THIS FORK** - Multiple locations now use `lookupMaybe()` instead of `lookup()` with graceful undefined handling. Fixed in: PDFAcroTerminal.getWidgets(), PDFForm.findWidgetAppearanceRef(), PDFDocument.getRawAttachments(), PDFDocument.getSavedAttachments(), PDFAnnotation.getAppearances(), PDFEmbeddedFile.embedIntoContext().

#### #64 - Failed to Parse Number
Parsing error at specific file offset.
- **Status**: **NOT A BUG** - Test files provided are truncated PDFs (missing trailer/EOF). Parser correctly rejects with clear error message: "file may be truncated"

#### #63 - Failed to Parse Invalid PDF Object
Generic parsing failure.
- **Status**: **NOT A BUG** - Same as #64. Improved error message now indicates truncation.

### Minor Issues

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

#### #71 - Save to Specific File Path
Feature request for `save(filePath)` method.
- **Status**: Open

#### #67 - Add packageManager Field
Request to add packageManager field to package.json for reliable dependency management.
- **Status**: **FIXED IN THIS FORK**

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
- **#128** - Widget page index API (`getWidgets()`, `getWidgetPage()`, `getWidgetPageIndex()`) ✓
- **#89** - Attachment name lexical sorting for Acrobat compatibility ✓
- **#24** - Updated pako dependency ✓
- **#67** - Added packageManager field to package.json ✓
- **#73/#68** - PDF stream compression (`save({ compress: true })`) ✓

### Complex Issues (Future Consideration)
1. **#55** - setText font handling (HIGH effort - architecture limitation)
2. **#69/#65** - Encrypted PDF cloning (HIGH effort - requires architectural changes)
3. **#95** - SVG pattern support (MEDIUM-HIGH effort)
