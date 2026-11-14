import Path from "../../src/fontkit/glyph/Path";
import TTFGlyphEncoder from "../../src/fontkit/glyph/TTFGlyphEncoder";

const header = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  return {
    numberOfContours: view.getInt16(0),
    xMin: view.getInt16(2),
    yMin: view.getInt16(4),
    xMax: view.getInt16(6),
    yMax: view.getInt16(8),
  };
};

describe("TTFGlyphEncoder.encodeSimple", () => {
  it("includes off-curve control points in the glyph bbox", () => {
    const path = new Path();
    path.moveTo(0, 0);
    path.quadraticCurveTo(100, 200, 200, 0);
    path.closePath();

    // The curve itself only reaches y = 100, but the glyf header must span
    // every encoded point, including the control point at y = 200.
    expect(header(new TTFGlyphEncoder().encodeSimple(path))).toEqual({
      numberOfContours: 1,
      xMin: 0,
      yMin: 0,
      xMax: 200,
      yMax: 200,
    });
  });

  it("rounds fractional coordinates into the bbox", () => {
    const path = new Path();
    path.moveTo(0.4, -0.6);
    path.lineTo(10.5, 3.2);
    path.closePath();

    expect(header(new TTFGlyphEncoder().encodeSimple(path))).toEqual({
      numberOfContours: 1,
      xMin: 0,
      yMin: -1,
      xMax: 11,
      yMax: 3,
    });
  });
});
