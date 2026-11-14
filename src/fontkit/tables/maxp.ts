import * as r from "../../vendors/restructure/index.js";

// maxiumum profile. Version 0.5 (CFF and bitmap-only fonts) holds only
// numGlyphs; reading it as the 1.0 layout would run past the table.
export default new r.VersionedStruct(r.uint32, {
  20480: {
    numGlyphs: r.uint16, // The number of glyphs in the font
  },
  65536: {
    numGlyphs: r.uint16, // The number of glyphs in the font
    maxPoints: r.uint16, // Maximum points in a non-composite glyph
    maxContours: r.uint16, // Maximum contours in a non-composite glyph
    maxComponentPoints: r.uint16, // Maximum points in a composite glyph
    maxComponentContours: r.uint16, // Maximum contours in a composite glyph
    maxZones: r.uint16, // 1 if instructions do not use the twilight zone, 2 otherwise
    maxTwilightPoints: r.uint16, // Maximum points used in Z0
    maxStorage: r.uint16, // Number of Storage Area locations
    maxFunctionDefs: r.uint16, // Number of FDEFs
    maxInstructionDefs: r.uint16, // Number of IDEFs
    maxStackElements: r.uint16, // Maximum stack depth
    maxSizeOfInstructions: r.uint16, // Maximum byte count for glyph instructions
    maxComponentElements: r.uint16, // Maximum number of components referenced at “top level” for any composite glyph
    maxComponentDepth: r.uint16, // Maximum levels of recursion; 1 for simple components
  },
});
