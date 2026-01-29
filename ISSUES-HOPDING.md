# Hopding/pdf-lib Issues Analysis

**Total Issues Analyzed**: 312
**Filtered for Legitimate Issues**: ~180 (excluding noise, React Native questions, user support, duplicates)

## Critical/High Engagement Issues

These issues have 10+ comments indicating widespread problems:

- **#951** - Corrupted PDF (22 comments) - object stream issue, needs investigation
- **#1549** - Flatten is removing RadioGroups and Checkboxes (10 comments) - **FIXED** (cantoo-scribe PR #56)
- **#1407** - Make pdf-lib more graceful like other pdf software (10 comments) - **IMPROVED** (PDFNull handling)
- **#1338** - File size problem: 433mb generated from a 15mb document (10 comments) - open
- **#1390** - Copying encrypted PDF results in blank pages (16 comments) - potentially improved by PR #130 fix
- **#1260** - Expected instance of PDFDict, but got instance of undefined (15 comments) - **IMPROVED** (PDFNull handling)
- **#1284** - Issue with Jpeg's Orientation Exif when embedding in pdf (16 comments) - open
- **#1069** - drawSvgPath doesn't work (10 comments) - **FIXED** (cantoo-scribe SVG fixes)
- **#1010** - page.drawText() inserts spaces when using Thai font (11 comments) - open (fontkit/OpenType shaping)
- **#1015** - Dev/doc encrypt (43 comments) - **FIXED** (cantoo-scribe encryption support)

---

## Parsing / Loading

**Critical parsing errors preventing PDF loading**

- **#1718** - PDF parsed as invalid
- **#1713** - Failed to parse PDF document: No PDF header found (line:24 col:934 offset=4584)
- **#1646** - Failed to parse PDF document: No PDF header found (line:104 col:8 offset=195965)
- **#1641** - Ignoring parsing unreferenced objects
- **#1491** - Failed to parse PDF document (2 comments)
- **#1408** - Loading particular pdf crashes pdf-lib (2 comments)
- **#1400** - Error loading pdf, "invalid object" (6 comments)
- **#1424** - PDFDocument.load fails to load all pages (160 pages, only 156 loaded) (2 comments)
- **#1414** - Some pdf file can't be preview
- **#1372** - Library not recognising all pages in a file with mixed page dimensions (4 comments)
- **#1355** - Expected instance of PDFDict or PDFStream, but got instance of undefined (5 comments)
- **#1361** - Expected instance of PDFName2, but got instance of undefined
- **#1274** - Trying to parse invalid object (3 comments)
- **#1260** - Expected instance of PDFDict, but got instance of undefined (15 comments) - HIGH ENGAGEMENT
- **#1192** - Expected instance of PDFArray, but got instance of PDFDict
- **#1189** - Splitting a PDF into many new PDFs - foreign PDF document error (2 comments)
- **#1160** - Failed to load of Read-only permission PDF
- **#1103** - Failed to parse PDF document (line:2 col:630 offset=354): No PDF header found (5 comments)
- **#1136** - TypeError: _this.catalog.Pages(...).traverse is not a function (9 comments)
- **#1520** - Some pages (PageLeaf) missing once the pdf is loaded
- **#1497** - Problems to edit a pdf version 2.0 of acrobat
- **#1294** - Unable to get correct information from high version PDF file

**Parsing specific features**

- **#1751** - Badly parsed JavaScript in AcroForm field

---

## Forms / AcroFields

**Form field detection and reading**

- **#1732** - Error when trying to fill out a form that does allow 'Filling of form fields'
- **#1705** - Fields not readable with Pdf-lib
- **#1670** - Not finding fillable fields (4 comments)
- **#1635** - Throw an error when retrieving form fields from a pdf
- **#1620** - getFields() returns zero length array on fillable PDF (3 comments)
- **#1406** - getFields() results in Expected instance of PDFDict, but got instance of PDFInvalidObject (4 comments)
- **#1185** - Unable to access child fields in pdf form (7 comments)
- **#1483** - findPageForAnnotationRef doesn't return page for some fields of AcroForm (3 comments)
- **#1375** - PDFAcroRadioButton is not found using doc.findPageForAnnotationRef (1 comment)
- **#1268** - Getting correct widget ref to be removed (6 comments)

**Form field manipulation**

- **#1748** - Add the option to rename AcroForm field
- **#1652** - Trying to add two fields with the same name generates an error
- **#1553** - Unable to print the document which is filled with same text field twice
- **#1548** - Text size shrinking and expanding in Text Fields as per text length
- **#1538** - Original font is not maintained when a form is filled
- **#1504** - PDFDocument method saveAsBase64({dataUri: true}) returning same contents even after modifying (2 comments)
- **#1488** - Field with diacritics cannot be filled
- **#1240** - Duplicate field names after copying & adding pages
- **#1077** - setText method removes border & combing (4 comments)
- **#1104** - PDF form field not filled according to field font (5 comments)
- **#1112** - Filling PDF causes styles of filled fields to be reset

**Form field styling and appearance**

- **#1597** - .setText() on a form field keeps font-size but overwrites pre-set font and font-color
- **#1581** - Bad line height on the text of the form element
- **#1378** - PDF form text field setText does not use font (9 comments)
- **#1334** - Background fill for fields is causing checkbox borders disappear (2 comments)

**Checkboxes and radio buttons**

- **#1685** - Improve acro checkbox set value (3 comments)
- **#1574** - On pdf.flatten() check mark getting removed from flattened pdf
- **#1549** - Flatten is removing RadioGroups and Checkboxes (10 comments) - HIGH ENGAGEMENT
- **#1546** - Unexpected Checkbox Borders on Print After Editing PDF with pdf-lib

**Form flattening**

- **#1757** - Cannot sign flattened PDFs using a certificate (error: There was a problem reading this document (14))
- **#1519** - Error on flattening with some pdf
- **#1482** - Flattening form causing Error 14 in Adobe (3 comments)
- **#1387** - PDFs with flattened forms can't be printed in Adobe Reader or Acrobat (5 comments)
- **#1267** - Flattened PDFs Malformed

**Form-related features**

- **#1758** - Added support to only flatten some fields
- **#1540** - Form field tabulation order (proposal)
- **#1415** - PDF417 barcode tied to fields are not rendering

---

## Text / Fonts

**Font embedding and encoding**

- **#1759** - Standard fonts in pdf-lib cannot encode certain characters outside WinAnsi
- **#1754** - Kerning and style set 2 are not respected in the configuration
- **#1744** - Not possible to use setAuthor with german umlauts
- **#1649** - PDFString supports only one-byte characters (2 comments)
- **#1528** - Improve unicode support (2 comments)
- **#1492** - Resaving document with fontkit after adding text results in error
- **#1429** - A problem while using embedFont to write Chinese characters (2 comments)
- **#1409** - Space issue with embedded Hindi Font (7 comments)
- **#1398** - Drawing text with glyphless font results in garbled output
- **#1396** - Embed font: subset breaks if text contains a dash
- **#1395** - embedFont: woff2 font not recognized by Acrobat Reader?
- **#1325** - Fix character spacing in fonts using ligatures (2 comments)
- **#1297** - Unicode fraction slash not working
- **#1275** - Some fonts split words
- **#1232** - Some characters in Japanese (and likely other languages) don't show up when a font is embedded with subset: true (4 comments)
- **#1147** - Cannot encode charset, which is supported by the font
- **#1010** - page.drawText() inserts spaces when using Thai font (11 comments) - HIGH ENGAGEMENT
- **#1665** - Using multiple Standard Fonts for a single textfield (proposal)

**Font errors**

- **#1544** - getCreationDate has issues parsing some dates (fontkit.create is not a function) (2 comments)
- **#1506** - pdf.drawText is not supporting with custom font

**Text rendering**

- **#1750** - MacOS preview doesn't show the correct font size
- **#1450** - Arabic text with numbers, numbers gets reversed (4 comments)
- **#1272** - drawText does not support text style like text decoration (7 comments)
- **#1169** - Scrambled Text when pdfs are viewed in acrobat

---

## Images

**Image embedding issues**

- **#1760** - Embedding files via attach() should not compress by default or at least mark it as such
- **#1634** - embedJpg is writing a jpeg image to pdf as text not as an image
- **#1529** - Set BoundingBox for Images
- **#1472** - The method `embedPng()` on iOS takes too long to run, but it works fine on Android
- **#1404** - File size increased exponentially after embedded png to pdf-doc
- **#1341** - drawImage not working with big rotated pdf
- **#1284** - Issue with Jpeg's Orientation Exif when embedding in pdf (16 comments) - HIGH ENGAGEMENT
- **#1146** - embedPng stuck in infinity loop (2 comments)
- **#784** - JPG images with embedded CMYK profile show inverted in Illustrator (3 comments)

---

## Pages / Copy

**Page copying issues**

- **#1772** - Fix: Resolve visual corruption in PDFs (#951)
- **#1769** - fix: Preserve object order for PDFs with incremental updates (#951)
- **#1755** - fix issue #951 - Introduced logic for output reordering of indirect objects
- **#951** - Corrupted PDF (22 comments) - CRITICAL HIGH ENGAGEMENT
- **#1701** - Copying Pages which include Tables
- **#1662** - Copying pages to a new PDF document brings over all images in Resources/XObject, even those not used on the page (6 comments)
- **#1639** - PDF Pages Appear Blank After Processing with pdf-lib (3 comments)
- **#1615** - Filled fields in additional pages do not render in Acrobat, but work fine in chrome (3 comments)
- **#1587** - copyPages with forms inside of it (3 comments)
- **#1486** - Copying pages multiple times does not work in Chrome, but does in Safari
- **#1390** - Copying encrypted PDF results in blank pages in the new PDF document (16 comments) - HIGH ENGAGEMENT
- **#1389** - Error while trying to add page from a copy (3 comments)
- **#1362** - drawPage of embedded pages produces non-functional hyperlinks (2 comments)
- **#1349** - Error: Could not find page for PDFRef 270 0 R
- **#1307** - Page embed not working properly
- **#1205** - Copy Pages results form fields disappearing (5 comments)
- **#1155** - drawPage for embedded PDF seems to lose hyperlink annotations (5 comments)
- **#612** - Copy two different pages and add them in a document (3 comments)

**Page manipulation**

- **#1563** - Outside SetCropBox content is maintained when cloning (not sure if it's a bug)
- **#1348** - Page translateContent does not work for form fields
- **#1317** - The page content disappears
- **#1399** - Text boxes disappear when embedding PDFs

**Page size and transformation**

- **#1765** - feat: literal, immutable `PageSizes`
- **#1336** - Line color changed when page rotated
- **#1204** - While splitting large documents in term of pages the new file saved from the large document is having large size (2 comments)

---

## Encryption / Signing

- **#1757** - Cannot sign flattened PDFs using a certificate (error: There was a problem reading this document (14))
- **#1673** - Issue with Adding Multiple Signatures to PDF by iteration: Except 1st signature "Annotation Deleted" (Adobe Acrobat)
- **#1643** - Embed digital signature (pkcs7) to pdf
- **#1680** - Encrypt PDF
- **#1601** - Render Encrypted Documents using pdf-lib js library (6 comments)
- **#1390** - Copying encrypted PDF results in blank pages (16 comments) - HIGH ENGAGEMENT
- **#1343** - Purple ribbon message issue on a signed PDF
- **#1326** - Pdf-lib: support encrypted documents (proposal)
- **#1315** - Differentiate between document open password and permission password (proposal)
- **#1296** - Cannot Load Encrypted/Restricted PDF Document (8 comments)
- **#1530** - How to decrypt a pdf doc by using pdf-lib (proposal)
- **#1015** - Dev/doc encrypt (43 comments) - HIGHEST ENGAGEMENT

---

## Metadata

- **#1761** - Fix Set Producer metadata on saved document when provided
- **#1744** - Not possible to use setAuthor with german umlauts

---

## Build / Integration

**Bundler and build issues**

- **#1707** - Buffer error while importing
- **#1682** - TypeError: Cannot set property constructor of [object Object] which has only a getter (3 comments)
- **#1654** - error TS2502: 'provider' is referenced directly or indirectly in its own type annotation
- **#1645** - Library chokes when trying to include it in rollup (2 comments)
- **#1619** - "invalid distance too far back" error when running on Next.js 14 with Turbopack (4 comments)
- **#1582** - ReferenceError: Encoding is not defined (2 comments)
- **#1448** - Getting cyclic node warning when i run PDFDocument function imported from 'pdf-lib'
- **#1319** - Errors when building using tsc version 4.8.4
- **#1309** - Uncaught ReferenceError: PDFLib is not defined (2 comments)
- **#1148** - PDFDocument undefined (8 comments)
- **#1126** - Multiple Typescript compile errors TS2307: Cannot find module (4 comments)
- **#1107** - Error on Installation (MongoDB Realm Node Serverless)
- **#1186** - Error using pdf-lib with scriptable (5 comments)

**TypeScript and module format**

- **#1366** - Publish tsconfig.json to npm package (proposal)

---

## API / Features

**New features and API improvements**

- **#1765** - feat: literal, immutable `PageSizes`
- **#1758** - Added support to only flatten some fields
- **#1748** - Add the option to rename AcroForm field
- **#1741** - Incremental PDF update, with automatic change tracking, or manual tracking of changes
- **#1691** - Add hyperlinks (2 comments)
- **#1679** - Repeat a given section for each element in an array (proposal)
- **#1614** - Add TextField Background Opacity Support (proposal)
- **#1576** - Add transparence option for the firstPage.drawText (proposal)
- **#1556** - Run existing PDF Javascript from PDF-Lib (proposal)
- **#1531** - Document what the unit is for page dimensions (3 comments)
- **#1495** - Make PDFDocument derivable (2 comments)
- **#1494** - Method to get pageNumber for each TextFields in pdf-lib (proposal)
- **#1467** - Can you provide a function to write text within a rectangle? (2 comments)
- **#1458** - It would be good document coordinates of the mouse click on the document (proposal)
- **#1413** - drawText backgroundColor (proposal)
- **#1388** - Prevent fragmentation of xref (proposal)
- **#1379** - feat: add page translate function
- **#1289** - Justification for multiple lines (3 comments)
- **#1257** - Create Table of content in pdf (2 comments)
- **#1247** - Modifying Existing PDFs text in every page (2 comments)
- **#1230** - No way to copy fields for printing
- **#1216** - Provide all text state operators
- **#1215** - Make stream parser resilient to text in streams
- **#1209** - Text Search and cleanup (2 comments)
- **#1177** - Flip page (proposal)
- **#1151** - Adding Outline to an existing pdf document with outlines (2 comments)
- **#1135** - Allow squishing/stretching text (or arbitrary manipulations) (proposal)
- **#1017** - Merging pdf-documents doesn't handle merging or copying Bookmarks/outlines (1 comment)
- **#1266** - Nested Bookmarks (AKA outlines)
- **#444** - [Feature Request] Spot color support
- **#1322** - Add support for Separation colors (8 comments)

**Attachments**

- **#1760** - Embedding files via attach() should not compress by default
- **#1227** - .attach appears to be not working

**Links and annotations**

- **#1742** - The link to the title on another page does not work
- **#1691** - Add hyperlinks (2 comments)
- **#1609** - External links work but link to same page doesn't work
- **#1362** - drawPage of embedded pages produces non-functional hyperlinks (2 comments)
- **#1155** - drawPage for embedded PDF seems to lose hyperlink annotations (5 comments)
- **#1697** - Fetching Annotation Comments added in the pdf (Arabic, Urdu and Persian language comments)
- **#1392** - Annotate note show unreadable code

**SVG support**

- **#1578** - Having problem with SVG path
- **#1444** - Fix bug in SVG path command T #1443 (4 comments)
- **#1443** - SVG path command `T` does not update the control point correctly
- **#1431** - Gradient issue, with strokeWidth, scaling
- **#1069** - drawSvgPath doesn't work for me (10 comments) - HIGH ENGAGEMENT

---

## Corruption / Save

**PDF corruption and visual issues**

- **#1772** - Fix: Resolve visual corruption in PDFs (#951)
- **#1769** - fix: Preserve object order for PDFs with incremental updates (#951)
- **#1755** - fix issue #951 - Introduced logic for output reordering of indirect objects
- **#951** - Corrupted PDF (22 comments) - CRITICAL HIGH ENGAGEMENT
- **#1767** - Merge pdf - getting error while viewing the pdf in acrobat reader and content is blank
- **#1639** - PDF Pages Appear Blank After Processing with pdf-lib (3 comments)
- **#1615** - Filled fields in additional pages do not render in Acrobat, but work fine in chrome (3 comments)
- **#1515** - Cannot print/save as pdf with pdf-lib 1.17.1 (5 comments)
- **#1510** - pdf-lib adding non existing border to pdf
- **#1445** - Trying to compress the pdf file but its getting damaged
- **#1224** - Broken output PDF in Adobe Acrobat DC
- **#1206** - PowerPoint PDF data loaded into PDF-Lib does not open in Adobe Acrobat Pro DC (3 comments)

**File size issues**

- **#1338** - File size problem: 433mb generated from a 15mb document (10 comments) - HIGH ENGAGEMENT
- **#1404** - File size increased exponentially after embedded png to pdf-doc
- **#1306** - File Size increasing after modifying
- **#1204** - While splitting large documents the new file saved has large size (2 comments)

**Save issues**

- **#1589** - Library produces different results in browser vs nodejs
- **#1504** - PDFDocument method saveAsBase64({dataUri: true}) returning same contents even after modifying (2 comments)
- **#1422** - Set default file name for a PDF document created with pdf lib by Javascript (2 comments)
- **#1410** - PDFDocument.save() generates pdf missing trailer dictionary (3 comments)
- **#1068** - pdf-lib automatically add a layer without any operation (2 comments)

**Incremental updates**

- **#1741** - Incremental PDF update, with automatic change tracking (proposal)
- **#1418** - incremental save (2 comments)

---

## Miscellaneous Technical Issues

**Performance**

- **#1437** - Reduce memory footprint

**Validation and error handling**

- **#1481** - TypeError: Cannot read properties of undefined (reading 'length') in PDFString.js
- **#1407** - Make pdf-lib more graceful like other pdf software (10 comments) - HIGH ENGAGEMENT

**JavaScript execution**

- **#1751** - Badly parsed JavaScript in AcroForm field
- **#1557** - Javascript script not showing and not editable in Adobe Acrobat Pro X1
- **#1556** - Run existing PDF Javascript from PDF-Lib (proposal)
- **#1258** - Interactive form calculation not working in nodejs (6 comments)

---

## Documentation / Examples

- **#1560** - Update README.md
- **#1358** - Update PDF specification URL in CONTRIBUTING.md
- **#1350** - Update link to Prior Art labelmake to actively developed pdfme
- **#1301** - Update README.md
- **#1287** - Remove examples that suggest getting type from `field.constructor.name`
- **#1200** - Update CONTRIBUTING.md
- **#1178** - Update README.md
- **#1703** - Stale method comment

---

## Triaged / Investigated — Not Fixable or Not Bugs

Issues we investigated and determined are not library bugs, are fundamental
limitations, or are design issues that require architectural changes.

**Not bugs (user error / environment):**

- **#1324** - Error in PDFName.of() — user's TypeScript/AdonisJS module resolution config issue, not a library bug
- **#1426** - Cannot make "setKeywords" work — environment-specific (Node-Red); `setKeywords` code is correct, `assertIs` validation works as expected
- **#1310** - getAuthor() only returns first author — not a bug; PDF spec stores Author as a single string, library returns it correctly; users should split on `;` or `,` themselves
- **#1454** - setting viewerPrefs does not change viewer — code is correct; user likely not calling `save()` after setting preferences, or PDF reader ignores preferences
- **#1461** - Invalid typed array length: 5310707417 — user code issue; copying all pages in a loop (`copyPages` with all indices, then adding one) creates exponential object duplication and size growth
- **#1638** - TypeError: PDFDocument.registerFontkit is not a function — not a library bug; user's bundler/caching issue in Next.js, `registerFontkit` exists and works correctly
- **#1283** - PDF load not loading pdf version 1.3 — not a version parsing issue; the PDF header version is parsed correctly; the real problem is likely invalid objects in old PDFs, not version detection
- **#1692** - Failure Exception: Converting circular structure to JSON — user error; `PDFForm`/`PDFArray` objects contain circular references to `PDFContext` by design; users cannot `JSON.stringify()` them directly

**Fundamental limitations (no simple fix):**

- **#1263** - Saving PDF with number that is too large — fundamental JavaScript limitation; numbers beyond `Number.MAX_SAFE_INTEGER` lose precision in float64, and the reconstructed decimal string has incorrect trailing digits. Would require storing original string representations from the parser, which is a major refactor
- **#1365** - Dash in between alphanumeric adds additional space — likely a font metrics/kerning issue; unclear root cause, needs font-specific debugging with a repro PDF

**Design issues (require architectural changes):**

- **#951** - Corrupted PDF (22 comments) — object ordering during page copying with incremental updates. Multiple PRs exist (#1772, #1769, #1755) but the fix is complex. Root cause is in `PDFContext.enumerateIndirectObjects()` always sorting by ascending object number, which can break reference chains in incrementally-updated PDFs. Safe fix would require preserving original object ordering from the parser.
- **#1338** - File size problem: 433mb from 15mb document (10 comments) — `PDFObjectCopier` copies ALL resources recursively from inherited Resource dictionaries, including unused fonts/images/XObjects. Proper fix requires analyzing content streams to determine which resources are actually used (TODOs exist in PDFPageLeaf.ts for this). Workaround: post-process with Ghostscript. Related: #1662, #1404, #1306.
- **#1390** - Copying encrypted PDF results in blank pages (16 comments) — content is decrypted during parsing but resource references may not resolve correctly when copying from encrypted sources. The copier has no special handling for encrypted document structures. Not the simple clone() issue originally suspected.
- **#1481** - TypeError: Cannot read properties of undefined (reading 'length') in PDFString.js — occurs during save() when a PDFString has undefined value. May be caused by malformed PDFs, encryption issues, or corrupted form field data. Hard to fix without reproduction case.
- **#1146** - PNG embedding hangs with certain images — issue with malformed/corrupted PNGs causing apparent hang. The splitAlphaChannel loop is correct; issue likely stems from UPNG library producing invalid buffer sizes from corrupted PNG headers.
- **#1069** - drawSvgPath doesn't work (10 comments) — SVG arc commands (A/a) have issues in the arc-to-bezier conversion math. The implementation uses complex trigonometric transformations that may have edge cases. Workaround: split paths to avoid arc commands.
- **#1010** - page.drawText() inserts spaces with Thai font (11 comments) — architectural issue with fontkit integration. Width calculation uses `glyphsForString()` (no OpenType shaping) while encoding uses `font.layout()` (full shaping), causing mismatch for complex scripts. Workaround: use `subset: true` or `features: { liga: false }`.
- **#1284** - JPEG EXIF orientation not handled (16 comments) — feature request, not a bug. JpegEmbedder only parses SOF markers for dimensions/colorspace, doesn't parse APP1 segment for EXIF orientation. Would require either auto-rotating pixels (complex) or exposing orientation for user handling.
- **#784** - CMYK JPEG shows inverted in Illustrator (3 comments) — JpegEmbedder unconditionally applies `Decode: [1,0,1,0,1,0,1,0]` to all CMYK JPEGs as a "hedge". Some JPEGs don't need this inversion. Proper fix requires parsing ICC profile data to detect encoding convention.
- **#1295** - Text overlaps itself when drawText is used inside for loop — copied pages may share content stream references; `translateContent` wraps all streams cumulatively. Would require deep-cloning content streams during page copy
- **#1420** - Can't call translateContent multiple times per page — by design, `translateContent` wraps ALL content streams (not just new ones), so each call shifts all previous content. Would need a scoped translation API
- **#1622** - enableReadOnly() does not work for checkboxes — the ReadOnly flag is set correctly in memory (`isReadOnly()` returns true), but may not be properly respected by PDF viewers during save/render for checkbox widgets specifically
- **#1391** - Cannot read checkbox value correctly — checkbox `/V` (value) and `/AS` (appearance state) can be out of sync when toggled in external PDF viewers; `isChecked()` compares field value to appearance-derived on-value, which fails when they diverge

**Already fixed in this fork:**

- **#1260** - Expected instance of PDFDict, but got instance of undefined (15 comments) — fixed by changing `PDFAcroForm.getFields()` to skip invalid field entries instead of throwing. Uses same graceful degradation pattern as `createPDFAcroFields()` helper.
- **#1287** - Examples using constructor.name break after minification — replaced examples in getFields() and getForm() with instanceof checks
- **#1443** - SVG path command T does not update control point correctly — already fixed, test exists at tests/api/svgPath.spec.ts:143-152
- **#1703** - Stale method comment on markFieldAsClean — fixed typo in JSDoc comment that said "dirty" instead of "clean"
- **#1744** - Not possible to use setAuthor with German umlauts — works correctly in current version (reported for v1.4.0). Test added to verify UTF-16 encoding handles umlauts properly through save/load cycle.
- **#1407** - Make pdf-lib more graceful (10 comments) — fixed (commit `6fcae096`); `findWidgetPage` now returns undefined instead of throwing when page cannot be found, and callers skip orphaned widgets gracefully. Also fixes #967, #1281, #1349.
- **#1544** - fontkit.create is not a function — fixed by adding validation in `registerFontkit()` that throws `InvalidFontkitError` with a helpful message explaining how to install and register fontkit correctly
- **#1549** - Flatten is removing RadioGroups and Checkboxes (10 comments) — already fixed (commit `ff78ea2f`); the code now correctly dereferences PDFRef to PDFDict before extracting appearance states for checkboxes and radio groups

---

## Not Issues / Duplicates / Noise Filtered Out

Support questions, React Native issues, spam, vague/unclear reports, duplicates, and meta posts:

#822, #1102, #1117, #1138, #1142, #1152, #1154, #1162, #1176, #1187, #1188, #1193, #1208, #1211, #1253, #1265, #1279, #1293, #1302, #1303, #1313, #1316, #1340, #1344, #1384, #1423, #1428, #1502, #1508, #1523, #1535, #1536, #1539, #1555, #1561, #1566, #1577, #1600, #1607, #1612, #1616, #1637, #1648, #1650, #1657, #1658, #1659, #1668, #1675, #1676, #1710, #1719, #1720, #1737, #1766, #1768, #1771

---

## Summary Statistics

**By Category (Legitimate Issues Only)**:

- Parsing / Loading: ~40 issues
- Forms / AcroFields: ~50 issues (largest category)
- Text / Fonts: ~35 issues
- Images: ~10 issues
- Pages / Copy: ~25 issues
- Encryption / Signing: ~12 issues
- Metadata: ~7 issues
- Build / Integration: ~20 issues
- API / Features: ~30 issues
- Corruption / Save: ~25 issues

**Priority Issues for Fork Maintainers**:

1. **#951** - Core PDF corruption issue (22 comments) - Multiple PRs attempting fixes
2. **#1015** - Encryption support (43 comments)
3. **#1390** - Copying encrypted PDFs results in blank pages (16 comments)
4. **#1284** - JPEG orientation EXIF issues (16 comments)
5. **#1260** - PDFDict parsing error (15 comments)
6. **#1338** - Massive file size increase (10 comments)
7. **#1549** - Flatten removing checkboxes/radio buttons (10 comments)
8. **#1069** - drawSvgPath broken (10 comments)
9. **#1407** - General graceful degradation (10 comments)
10. **#1010** - Thai font spacing issues (11 comments)

**Areas Needing Most Attention**:

1. Form field handling and flattening (many bugs, high engagement)
2. PDF parsing robustness (many edge cases failing)
3. Font encoding and Unicode support (widespread issues)
4. Page copying with forms/encryption (corrupts data)
5. File size optimization (exponential growth issues)
