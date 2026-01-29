# Hopding/pdf-lib Issues Analysis

## Remaining Open Issues

### Parsing / Loading
- #1718: PDF parsed as invalid
- #1713: Failed to parse PDF document (line:24 col:934 offset=4584): No PDF header found
- #1646: Failed to parse PDF document (line:104 col:8 offset=195965): No PDF header found
- #1641: Ignoring parsing unreferenced objects
- #1491: Failed to parse PDF document
- #1408: Loading particular pdf crashes pdf-lib
- #1400: Error loading pdf, "invalid object"
- #1424: PDFDocumet.load fails to load all pages of the document (The document has 160 pages and only 156 pages get loaded, 4 pages are missing)
- #1414: Some pdf file can't be preview
- #1372: Library not recognising all pages in a file with mixed page dimesions
- #1355: Expected instance of PDFDict or PDFStream, but got instance of undefined
- #1361: Expected instance of PDFName2, but got instance of undefined
- #1274: Trying to parse invalid object.
- #1192: Expected instance of PDFArray, but got instance of PDFDict
- #1189: Splitting a PDF into many new PDFs - (foreign) PDF document error
- #1160: Failed to load of Read-only permission PDF
- #1103: Failed to parse PDF document (line:2 col:630 offset=354): No PDF header found
- #1136: TypeError: _this.catalog.Pages(...).traverse is not a function
- #1520: Some pages (PageLeaf) missing once the pdf is loaded
- #1497: Problems to edit a pdf version 2.0 of acrobat
- #1294: Unable to get correct information like pages or form fields from high version PDF file
- #1751: Badly parsed JavaScript in AcroForm field

### Forms / AcroFields
**Field detection:**
- #1732: error when trying to fill out a form that does allow 'Filling of form fields'
- #1705: Fields not readable with Pdf-lib
- #1670: Not finding fillable fields
- #1635: throw an error when retrieving form fields from a pdf
- #1620: getFields() returns zero length array on fillable PDF
- #1406: getFields() results in Expected instance of PDFDict, but got instance of PDFInvalidObject
- #1185: Unable to access child fields in pdf form
- #1483: findPageForAnnotationRef doesn't return page for some fields of AcroForm present on the page
- #1375: PDFAcroRadioButton is not found using doc.findPageForAnnotationRef(acroField.ref) API
- #1268: Getting correct widget ref to be removed

**Manipulation:**
- #1748: add the option to rename AcroForm field
- #1652: Trying to add two fields with the same name generates an error
- #1553: Unable to print the document which is filled with same text field twice.
- #1548: Text size shrinking and expanding in Text Fields as per text length.
- #1538: Original font is not mantained when a form is filled
- #1504: PDFDocument method pdfDoc.saveAsBase64({dataUri: true}) returning same contents even after modifying the fillable PDF.
- #1488: Field with diacritics cannot be filled
- #1240: Duplicate field names after copying & adding pages
- #1077: setText method removes border & combing
- #1104: PDF form field not filled according to field font
- #1112: Filling PDF causes styles of filled fields to be reset

**Styling:**
- #1597: .setText() on a form field keeps font-size but overwrites pre-set font and font-color
- #1581: bad line height on the text of the form element
- #1378: PDF form text field setText does not use font
- #1334: Background fill for fields is causing checkbox borders disappear

**Checkboxes/Radio:**
- #1685: Improve acro checkbox set value
- #1574: On pdf.flatten() check mark getting removed from flattened pdf
- #1546: Unexpected Checkbox Borders on Print After Editing PDF with pdf-lib

**Flattening:**
- #1757: Cannot sign flattened PDFs using a certificate (error: There was a problem reading this document (14))
- #1519: Error on flattening with some pdf
- #1482: Flattening form causing Error 14 in Adobe
- #1387: pdfs with flattened forms can't be printed in Adobe Reader or Acrobat
- #1267: Flattened PDFs Malformed

**Features:**
- #1758: Added support to only flatten some fields
- #1540: From field tabulation order
- #1415: PDF417 barcode tied to fields are not rendering

### Text / Fonts
**Encoding:**
- #1759: Standard fonts in pdf-lib cannot encode certain characters outside WinAnsi
- #1754: Kerning and style set 2 are not respected in the configuration
- #1649: PDFString supports only one-byte characters
- #1528: Improve unicode support
- #1492: Resaving document with fontkit after adding text results in error
- #1429: a problem while using embedFont to write Chinese characters
- #1409: Space issue with embedded Hindi Font
- #1398: Drawing text with glyphless font results in garbled output
- #1396: Embed font: subset breaks if text contains a dash
- #1395: embedFont: woff2 font not recognized by Acrobat Reader?
- #1325: Fix character spacing in fonts using ligatures
- #1297: Unicode fraction slash not working
- #1275: Some fonts splits words
- #1232: Some characters in Japanese (and likely other languages) don't show up when a font is embedded with subset: true
- #1147: Cannot encode charset, which is supported by the font
- #1665: Using multiple Standard Fonts for a single textfield (i.e. Merging Unicode code points)

**Errors:**
- #1506: pdf.drawText is not supporting with custom font

**Rendering:**
- #1750: MacOS preview doesn't show the correct font size
- #1450: Arabic text with numbers, numbers gets reversed.
- #1272: drawText Does not support text style like text decoration
- #1169: Scrambled Text when pdfs are viewed in acrobat

### Images
- #1760: embedding files via attach() should not compress by default or at least mark it as such
- #1634: embedJpg is writing a jpeg image to pdf as text not as an image
- #1529: Set BoundingBox for Images
- #1472: The method `embedPng()` on the ios takes too long to run ,but it works fine on the android
- #1404: File size increased exponentially after embedded png to pdf-doc
- #1341: drawImage not working with big rotated pdf
- #1146: embedPng stuck in infinity loop
- #784: JPG images with embedded CMYK profile show inverted in Illustrator

### Pages / Copy
- #1772: Fix: Resolve visual corruption in PDFs (#951)
- #1769: fix: Preserve object order for PDFs with incremental updates (#951)
- #1755: fix issue #951 - Introduced logic for output reordering of indirect objects
- #1701: Copying Pages which include Tables
- #1662: Copying pages to a new PDF document brings over all images in the Resources/XObject section, even those not used on the page
- #1639: PDF Pages Appear Blank After Processing with pdf-lib
- #1615: Filled fields in additional pages do not render in Acrobat, but work fine in chrome.
- #1587: copyPages with forms inside of it
- #1486: Copying pages multiple times does not work in Chrome, but does in Safari
- #1389: Error while trying to add page from a copy
- #1362: drawPage of embedded pages produces non-functional hyperlinks
- #1349: Error: Could not find page for PDFRef 270 0 R
- #1307: Page embed not working properly
- #1205: Copy Pages results form fields disappearing
- #1155: RE: drawPage for embedded PDF seems to lose hyperlink annotations
- #612: Copy two different pages and add them in a document.

**Manipulation:**
- #1563: Outside SetCropBox content is maintained when cloning (not sure if it's a bug)
- #1348: Page translateContent does not work for form fields
- #1317: The page content disappears
- #1399: Text boxes disappear when embedding PDFs

**Size/Transform:**
- #1765: feat: literal, immutable `PageSizes`
- #1336: Line color changed when page rotated
- #1204: while splitting large documents in term of pages the new file saved from the large document is having large size

### Encryption / Signing
- #1757: Cannot sign flattened PDFs using a certificate (error: There was a problem reading this document (14))
- #1673: Issue with Adding Multiple Signatures to PDF by iteration: Except 1st signature "Annotation Deleted" in Adobe Acrobat
- #1643: Embed digital signature(pkcs7) to pdf
- #1680: Encrypt PDF
- #1601: Render Encrypted Documents using pdf-lib js library
- #1343: Purple ribbon message issue on a signed PDF
- #1326: Pdf-lib : support encrypted documents
- #1315: Differentiate between document open password and permission password
- #1296: Cannot Load Encrypted/Restricted PDF Document
- #1530: How to decrypt a pdf doc by using pdf-lib

### Build / Integration
- #1707: Buffer error while importing
- #1682: TypeError: Cannot set property constructor of [object Object] which has only a getter
- #1654: error TS2502: 'provider' is referenced directly or indirectly in its own type annotation.
- #1645: library chokes when trying to include it in rollup
- #1619: "invalid distance too far back" error when running on Next.js 14 with Turbopack
- #1582: ReferenceError: Encoding is not defined
- #1448: Getting cyclic node warning when i run PDFDocument function imported from 'pdf-lib'
- #1319: Errors when building using tsc version 4.8.4
- #1309: Uncaught ReferenceError: PDFLib is not defined
- #1148: PDFDocument undefined
- #1126: Multiple Typescript compile errors TS2307: Cannot find module
- #1107: Error on Installation (MongoDB Realm Node Serverless)
- #1186: error using pdf-lib with scriptable
- #1366: Publish tsconfig.json to npm package

### API / Features
- #1765: feat: literal, immutable `PageSizes`
- #1758: Added support to only flatten some fields
- #1748: add the option to rename AcroForm field
- #1741: Incremental PDF update, with automatic change tracking, or manual tracking of changes. Fixes issue #816
- #1691: Add hyperlinks
- #1679: Repeat a given section for each element in an array
- #1614: Add TextField Background Opacity Support
- #1576: Add transparence option for the firstPage.drawText
- #1556: Run existing PDF Javascript from PDF-Lib
- #1531: Document what the unit is for page dimensions
- #1495: Make PDFDocument derivable
- #1494: Method to get pageNumber for each TextFields in pdf-lib
- #1467: Can you provide a function to write text within a rectangle?
- #1458: it would be good document coordinates of the mouse click on the document, for cropping API and other purposes
- #1413: drawText backgroundColor
- #1388: Prevent fragmentation of xref.
- #1379: feat: add page translate function
- #1289: Justification for multiple lines
- #1257: Create Table of content in pdf
- #1247: Modifying Existing PDFs text in every page
- #1230: No way to copy fields for printing
- #1216: Provide all text state operators
- #1215: Make stream parser resilient to text in streams
- #1209: Text Search and cleanup
- #1177: Flip page
- #1151: Adding Outline to an existing pdf document with outlines.
- #1135: Allow squishing/stretching text (or arbitrary manipulations)
- #1017: Merging pdf-documents doesn't handle merging or copying Bookmarks/outlines to the merged document
- #1266: Nested Bookmarks (AKA outlines)
- #444: [Feature Request] Spot color support
- #1322: Add support for Separation colors

### Corruption / Save
- #1767: Merge pdf - getting error while viewing the pdf in acrobat reader and content is blank.
- #1639: PDF Pages Appear Blank After Processing with pdf-lib
- #1615: Filled fields in additional pages do not render in Acrobat, but work fine in chrome.
- #1515: Cannot print/save as pdf with pdf-lib 1.17.1
- #1510: pdf-lib adding non existing border to pdf
- #1445: Trying to compress the pdf file but its getting damaged
- #1224: Broken output PDF in Adobe Acrobat DC
- #1206: PowerPoint PDF data loaded into PDF-Lib does not open in Adobe Acrobat Pro DC

**File size:**
- #1404: File size increased exponentially after embedded png to pdf-doc
- #1306: File Size increasing after modifying.
- #1204: while splitting large documents in term of pages the new file saved from the large document is having large size

**Save:**
- #1589: Library produces different results in browser vs nodejs
- #1504: PDFDocument method pdfDoc.saveAsBase64({dataUri: true}) returning same contents even after modifying the fillable PDF.
- #1422: Set default file name for a PFD document created with pdf lib by Javascript
- #1410: PDFDocument.save() generates pdf missing trailer dictionary
- #1068: pdf-lib automatically add a layer without any operation

**Incremental:**
- #1741: Incremental PDF update, with automatic change tracking, or manual tracking of changes. Fixes issue #816
- #1418: incremental save
