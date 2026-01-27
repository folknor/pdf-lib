# PDF-Lib Open Issues Analysis

**Total Issues Analyzed**: 312
**Filtered for Legitimate Issues**: ~180 (excluding noise, React Native questions, user support, duplicates)

## Critical/High Engagement Issues

These issues have 10+ comments indicating widespread problems:

- **#951** - Corrupted PDF (22 comments) - CRITICAL visual corruption issue
- **#1549** - Flatten is removing RadioGroups and Checkboxes (10 comments)
- **#1407** - Make pdf-lib more graceful like other pdf software (10 comments)
- **#1338** - File size problem: 433mb generated from a 15mb document (10 comments)
- **#1390** - Copying encrypted PDF results in blank pages (16 comments)
- **#1260** - Expected instance of PDFDict, but got instance of undefined (15 comments)
- **#1284** - Issue with Jpeg's Orientation Exif when embedding in pdf (16 comments)
- **#1069** - drawSvgPath doesn't work (10 comments)
- **#1010** - page.drawText() inserts spaces when using Thai font (11 comments)
- **#1015** - Dev/doc encrypt (43 comments)

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
- **#1324** - Error in PDFName.of()
- **#1274** - Trying to parse invalid object (3 comments)
- **#1260** - Expected instance of PDFDict, but got instance of undefined (15 comments) - HIGH ENGAGEMENT
- **#1192** - Expected instance of PDFArray, but got instance of PDFDict
- **#1189** - Splitting a PDF into many new PDFs - foreign PDF document error (2 comments)
- **#1160** - Failed to load of Read-only permission PDF
- **#1103** - Failed to parse PDF document (line:2 col:630 offset=354): No PDF header found (5 comments)
- **#1136** - TypeError: _this.catalog.Pages(...).traverse is not a function (9 comments)
- **#1520** - Some pages (PageLeaf) missing once the pdf is loaded
- **#1283** - PDF load not loading pdf version 1.3
- **#1497** - Problems to edit a pdf version 2.0 of acrobat
- **#1294** - Unable to get correct information from high version PDF file

**Parsing specific features**

- **#1751** - Badly parsed JavaScript in AcroForm field
- **#1476** - The utf16Decode helper is not suitable for handling long strings safely
- **#1692** - Failure Exception: Converting circular structure to JSON (7 comments)

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
- **#1255** - Cannot create textField with fontSize
- **#1240** - Duplicate field names after copying & adding pages
- **#1168** - Cannot remove multiline form field (6 comments)
- **#1077** - setText method removes border & combing (4 comments)
- **#1104** - PDF form field not filled according to field font (5 comments)
- **#1112** - Filling PDF causes styles of filled fields to be reset
- **#1184** - Performance issue while filling out IRS form (looping through ~1000 fields) (2 comments)

**Form field styling and appearance**

- **#1597** - .setText() on a form field keeps font-size but overwrites pre-set font and font-color
- **#1581** - Bad line height on the text of the form element
- **#1378** - PDF form text field setText does not use font (9 comments)
- **#1334** - Background fill for fields is causing checkbox borders disappear (2 comments)

**Checkboxes and radio buttons**

- **#1685** - Improve acro checkbox set value (3 comments)
- **#1622** - enableReadOnly() method does not work for checkboxes (PDFCheckBox) (6 comments)
- **#1574** - On pdf.flatten() check mark getting removed from flattened pdf
- **#1549** - Flatten is removing RadioGroups and Checkboxes (10 comments) - HIGH ENGAGEMENT
- **#1546** - Unexpected Checkbox Borders on Print After Editing PDF with pdf-lib
- **#1391** - Cannot read checkbox value correctly (4 comments)

**Form flattening**

- **#1757** - Cannot sign flattened PDFs using a certificate (error: There was a problem reading this document (14))
- **#1519** - Error on flattening with some pdf
- **#1482** - Flattening form causing Error 14 in Adobe (3 comments)
- **#1387** - PDFs with flattened forms can't be printed in Adobe Reader or Acrobat (5 comments)
- **#1347** - Flattening IRS Form W-8BEN throws `Error: Unexpected N type: undefined`
- **#1281** - Could not find page for PDFRef Error during flatten (2 comments)
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
- **#1638** - TypeError: PDFDocument.registerFontkit is not a function
- **#1506** - pdf.drawText is not supporting with custom font

**Text rendering**

- **#1750** - MacOS preview doesn't show the correct font size
- **#1570** - Getting unexpected Error: WinAnsi cannot encode " " (0x000a) (2 comments)
- **#1450** - Arabic text with numbers, numbers gets reversed (4 comments)
- **#1365** - Dash in between alphanumeric adds additional space
- **#1295** - Text overlaps itself when drawText is used inside for loop
- **#1272** - drawText does not support text style like text decoration (7 comments)
- **#1169** - Scrambled Text when pdfs are viewed in acrobat
- **#1202** - layoutMultilineText takes a very long time for long strings
- **#1203** - Improve performance of layoutMultilineText (2 comments)
- **#1228** - Let's improve the performance of `CustomFontEmbedder.widthOfTextAtSize` (6 comments) (proposal)

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
- **#1420** - Can't call translateContent multiple times per page
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
- **#1545** - getCreationDate has issues parsing some dates (2 comments)
- **#1426** - Cannot make "setKeywords" work
- **#1374** - Loading bigger metadata informations of PDF create maximum call stack exceeded on iOS devices
- **#1310** - getAuthor() only returns first author

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
- **#1454** - setting viewerPrefs does not change viewer
- **#1422** - Set default file name for a PDF document created with pdf lib by Javascript (2 comments)
- **#1410** - PDFDocument.save() generates pdf missing trailer dictionary (3 comments)
- **#1263** - Saving PDF with number that is too large for some PDF readers results in broken PDF
- **#1068** - pdf-lib automatically add a layer without any operation (2 comments)

**Incremental updates**

- **#1741** - Incremental PDF update, with automatic change tracking (proposal)
- **#1418** - incremental save (2 comments)

---

## Miscellaneous Technical Issues

**Performance**

- **#1461** - Invalid typed array length: 5310707417 (2 comments)
- **#1437** - Reduce memory footprint
- **#1228** - Improve the performance of `CustomFontEmbedder.widthOfTextAtSize` (6 comments)
- **#1203** - Improve performance of layoutMultilineText (2 comments)
- **#1202** - layoutMultilineText takes a very long time for long strings
- **#1184** - Performance issue while filling out IRS form (2 comments)

**Validation and error handling**

- **#1481** - TypeError: Cannot read properties of undefined (reading 'length') in PDFString.js
- **#1407** - Make pdf-lib more graceful like other pdf software (10 comments) - HIGH ENGAGEMENT

**JavaScript execution**

- **#1751** - Badly parsed JavaScript in AcroForm field
- **#1557** - Javascript script not showing and not editable in Adobe Acrobat Pro X1
- **#1556** - Run existing PDF Javascript from PDF-Lib (proposal)
- **#1258** - Interactive form calculation not working in nodejs (6 comments)

**Viewer preferences**

- **#1454** - setting viewerPrefs does not change viewer

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

## Not Issues / Duplicates / Noise Filtered Out

- **#1771** - Editable pdf works and saves correctly on localhost, but not in prod (environment/deployment issue)
- **#1766** - Not able to add row to existing table dynamically (React Native - out of scope)
- **#1768** - Add OSS-Fuzz integration (PR, not issue)
- **#1737** - Unable to display pdf content (too vague)
- **#1720** - Please STOP posting issues here (meta)
- **#1719** - Freelancer Wanted (spam)
- **#1710** - Maybe adds a parameter named postscriptName (vague proposal)
- **#1676** - Need Documentation to Integrate pdf library to view and edit form fields using React Native (RN)
- **#1675** - Need documentation to open pdf using pdf lib using react native (RN)
- **#1668** - Not able to add text color (user error)
- **#1658** - Headers to merged attachments (unclear)
- **#1657** - How to compress PDF files? (support question)
- **#1650** - Merge PDF (support question)
- **#1648** - Error converting Excel to PDF (not pdf-lib's job)
- **#1637** - Need a method to get the DPI of a PDF Page (support/feature request)
- **#1612** - Nuxt module (not maintainer's job)
- **#1607** - Problem with embedding fonts (unclear)
- **#1600** - editar texto de pdf desde la web (Spanish, support question)
- **#1577** - [Help] Issue with embedding images (help request)
- **#1566** - How to use Chinese characters (support question)
- **#1561** - Facing error on Modify Document (too vague)
- **#1555** - Edited Form not able to save in React native (RN)
- **#1539** - How can we add set auto dimension of image in pdf (support)
- **#1536** - Is it possible to set line height using text field? (support)
- **#1535** - Local font is not rendering in React Native App (RN)
- **#1523** - Add a custom font Bogle (support)
- **#1508** - selection using rectangle box (unclear)
- **#1502** - Add form feed character at the end of every page (unclear use case)
- **#1303** - Can i view More pages pdf in pdf-lib (support)
- **#1302** - Not reading the fields in a pdf (duplicate/unclear)
- **#1293** - I need to extract a specific page as an image (wrong library)
- **#1279** - Turn each page into a picture (wrong library)
- **#1265** - Cannot get height of text exactly (unclear)
- **#1253** - Crop margins (support)
- **#1211** - Is there an easy way to get TypeScript Definitions (support)
- **#1208** - how can i use ttc font (support question)
- **#1193** - Unable to edit the same pdf form data in a loop (unclear)
- **#1188** - Not able to make one page preview of flatten PDF form? (support)
- **#1187** - It's a greate package! (not an issue)
- **#1176** - Pagination (unclear)
- **#1154** - Is it possible to create a pdf read-only? (support)
- **#1152** - Error: WinAnsi cannot encode with some non-latin text (duplicate of encoding issues)
- **#1142** - Add files via upload (spam)
- **#1138** - PDF Form Filling of NY CITY TAX FORM (support)
- **#1117** - Sample of adding attachment doesn't work (documentation)
- **#1102** - Result PDF file size reduce (support)
- **#1340** - Page background? (support)
- **#1344** - Rotate whole content of page? (support)
- **#1316** - Multiple pages in single page (unclear)
- **#1313** - Get the page number of found image (support)
- **#1384** - Delete Empty page (support)
- **#1428** - Convert pixels in 1/72 inches (support)
- **#822** - Reopen #223: Despite the explanations, the coordinates system really is wrong (old)
- **#1616** - Is @Hopding ok? (meta question about maintainer)
- **#1423** - Is this thing still on? (meta)
- **#1659** - Upgrade to the latest dependencies (maintenance task)
- **#1162** - Simplify code (code quality, not a bug)

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
