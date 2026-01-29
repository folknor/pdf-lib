# Hopding/pdf-lib Issues Analysis

## Investigation Results (High-Engagement Issues)

### #951 - Corrupted PDF (22 comments) - FIXED

**Root Cause**: `PDFContext.enumerateIndirectObjects()` always sorts by ascending object number, breaking PDFs with incremental updates where object order matters for XRef offsets.

**Fix**: Added `needsReordering` flag to PDFContext. Set when `nextRef()` creates new objects. `enumerateIndirectObjects()` only sorts when flag is true; otherwise preserves insertion order from parser.

**Complexity**: LOW - ~15 lines of code

---

### #1338 - File Size 433MB from 15MB (10 comments) - NOT FIXED

**Root Cause**: `PDFObjectCopier.copyPDFPage()` copies **entire inherited Resources dictionary** (all fonts, images, XObjects) even if the page only uses a subset. Copying 10 pages from a document with 100 shared images = 10 × 100 = 1000 image copies.

**Why Difficult**: Proper fix requires parsing content streams to identify which resources are actually used. pdf-lib lacks a content stream parser.

**Partial Solutions**:
1. Object deduplication at save time (helps file size, not memory)
2. User-provided resource filter option
3. Post-copy resource pruning utility

**Complexity**: MEDIUM-HIGH

---

### #1390 - Copying Encrypted PDF → Blank Pages (16 comments) - FIXED

**Root Cause**: `ignoreEncryption: true` loads encrypted bytes without decrypting. When copied, encrypted content streams go to destination without encryption dictionary → unreadable.

**Fix**: Added `EncryptedPDFCopyError` thrown in `copyPages()` when source is encrypted but not decrypted. Guides users to use password parameter instead.

**Complexity**: LOW - ~10 lines of code

---

### #1284 - JPEG EXIF Orientation (16 comments) - FIXED

**Root Cause**: `JpegEmbedder` only parses SOF markers for dimensions/colorspace. Ignores APP1/EXIF segment containing orientation tag.

**Fix**: Added EXIF orientation parsing to JpegEmbedder. Exposed `orientation` property (1-8) on PDFImage for JPEG images. Users can apply rotation manually based on orientation value.

**EXIF Orientation Values**:
- 1: Normal
- 2: Horizontal flip
- 3: Rotate 180°
- 4: Vertical flip
- 5: Rotate 90° CW + horizontal flip
- 6: Rotate 90° CW
- 7: Rotate 90° CW + vertical flip
- 8: Rotate 270° CW (90° CCW)

**Complexity**: LOW - ~80 lines for EXIF parsing

---

### #1010 - Thai Font Spacing (11 comments) - NOT FIXED

**Root Cause**: Width calculation uses `font.glyphsForString()` (no OpenType shaping) while encoding uses `font.layout()` (full shaping). For complex scripts like Thai, glyph count and positions differ after shaping.

**Why Difficult**: Using `layout()` for width is ~50x slower. Would affect all text operations.

**Recommended Fix**: Detect complex script Unicode ranges, only use `layout()` for those. Preserves performance for Latin text.

**Workarounds**:
- `embedFont(bytes, { subset: true })`
- `embedFont(bytes, { features: { liga: false } })`

**Complexity**: MEDIUM

---

## Remaining Open Issues

### Parsing / Loading
- #1718, #1713, #1646, #1641, #1491, #1408, #1400, #1424, #1414, #1372, #1355, #1361, #1274, #1192, #1189, #1160, #1103, #1136, #1520, #1497, #1294, #1751

### Forms / AcroFields
- Field detection: #1732, #1705, #1670, #1635, #1620, #1406, #1185, #1483, #1375, #1268
- Manipulation: #1748, #1652, #1553, #1548, #1538, #1504, #1488, #1240, #1077, #1104, #1112
- Styling: #1597, #1581, #1378, #1334
- Checkboxes/Radio: #1685, #1574, #1546
- Flattening: #1757, #1519, #1482, #1387, #1267
- Features: #1758, #1540, #1415

### Text / Fonts
- Encoding: #1759, #1754, #1649, #1528, #1492, #1429, #1409, #1398, #1396, #1395, #1325, #1297, #1275, #1232, #1147, #1665
- Errors: #1506
- Rendering: #1750, #1450, #1272, #1169

### Images
- #1760, #1634, #1529, #1472, #1404, #1341, #1146, #784

### Pages / Copy
- #1772, #1769, #1755, #1701, #1662, #1639, #1615, #1587, #1486, #1389, #1362, #1349, #1307, #1205, #1155, #612
- Manipulation: #1563, #1348, #1317, #1399
- Size/Transform: #1765, #1336, #1204

### Encryption / Signing
- #1757, #1673, #1643, #1680, #1601, #1343, #1326, #1315, #1296, #1530

### Build / Integration
- #1707, #1682, #1654, #1645, #1619, #1582, #1448, #1319, #1309, #1148, #1126, #1107, #1186, #1366

### API / Features
- #1765, #1758, #1748, #1741, #1691, #1679, #1614, #1576, #1556, #1531, #1495, #1494, #1467, #1458, #1413, #1388, #1379, #1289, #1257, #1247, #1230, #1216, #1215, #1209, #1177, #1151, #1135, #1017, #1266, #444, #1322

### Corruption / Save
- #1767, #1639, #1615, #1515, #1510, #1445, #1224, #1206
- File size: #1404, #1306, #1204
- Save: #1589, #1504, #1422, #1410, #1068
- Incremental: #1741, #1418

---

## Already Fixed in This Fork

- #951 - Object ordering (needsReordering flag)
- #1390 - Encrypted PDF copy error
- #1284 - JPEG EXIF orientation
- #1260 - PDFDict undefined (graceful degradation)
- #1287 - constructor.name examples (instanceof checks)
- #1443 - SVG T command
- #1703 - Stale comment typo
- #1744 - German umlauts (UTF-16 works)
- #1407 - Graceful degradation (findWidgetPage)
- #1544 - fontkit.create error (InvalidFontkitError)
- #1549 - Flatten checkboxes/radios (PDFRef dereference)
- #1069 - drawSvgPath (cantoo SVG fixes)
- #1015 - Encryption support (cantoo)
