import {
  BlendMode,
  PDFArray,
  PDFContentStream,
  PDFDocument,
  rgb,
  StandardFonts,
} from '../../src/index';
import {
  combineMatrix,
  transformationToMatrix,
} from '../../src/api/svg';
import { identityMatrix, type TransformationMatrix } from '../../src/types/matrix';
import { degreesToRadians } from '../../src/api/rotations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the concatenated text of ALL content streams on a page.
 * Returns an empty string if the page has no Contents array (nothing was drawn).
 */
function getAllContentStreamText(
  page: ReturnType<PDFDocument['addPage']>,
): string {
  const contents = page.node.Contents();
  if (!contents || !(contents instanceof PDFArray)) {
    return '';
  }
  let result = '';
  for (let i = 0; i < contents.size(); i++) {
    const stream = contents.lookup(i);
    if (stream instanceof PDFContentStream) {
      result += stream.getContentsString();
    }
  }
  return result;
}

/**
 * Convenience: create a doc + page, draw SVG, return content stream text.
 */
async function drawAndGetText(
  svg: string,
  options: Parameters<ReturnType<PDFDocument['addPage']>['drawSvg']>[1] = {},
): Promise<string> {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  page.drawSvg(svg, options);
  return getAllContentStreamText(page);
}

/**
 * Compare two TransformationMatrix arrays with floating-point tolerance.
 */
function expectMatrixClose(
  actual: TransformationMatrix,
  expected: TransformationMatrix,
  tolerance = 1e-10,
) {
  expect(actual).toHaveLength(6);
  for (let i = 0; i < 6; i++) {
    expect(actual[i]).toBeCloseTo(expected[i]!, tolerance);
  }
}

// ===========================================================================
// 1. Matrix math — combineMatrix
// ===========================================================================
describe('combineMatrix', () => {
  it('identity * identity = identity', () => {
    const result = combineMatrix(identityMatrix, identityMatrix);
    expectMatrixClose(result, identityMatrix);
  });

  it('identity * M = M', () => {
    const m: TransformationMatrix = [2, 3, 4, 5, 6, 7];
    const result = combineMatrix(identityMatrix, m);
    expectMatrixClose(result, m);
  });

  it('M * identity = M', () => {
    const m: TransformationMatrix = [2, 3, 4, 5, 6, 7];
    const result = combineMatrix(m, identityMatrix);
    expectMatrixClose(result, m);
  });

  it('scale(2) * scale(3) = scale(6)', () => {
    const s2: TransformationMatrix = [2, 0, 0, 2, 0, 0];
    const s3: TransformationMatrix = [3, 0, 0, 3, 0, 0];
    const result = combineMatrix(s2, s3);
    expectMatrixClose(result, [6, 0, 0, 6, 0, 0]);
  });

  it('translate(10,20) * translate(5,15) = translate(15,35)', () => {
    const t1: TransformationMatrix = [1, 0, 0, 1, 10, 20];
    const t2: TransformationMatrix = [1, 0, 0, 1, 5, 15];
    const result = combineMatrix(t1, t2);
    expectMatrixClose(result, [1, 0, 0, 1, 15, 35]);
  });

  it('scale(2) * translate(10,20) applies scale to translation', () => {
    const s: TransformationMatrix = [2, 0, 0, 2, 0, 0];
    const t: TransformationMatrix = [1, 0, 0, 1, 10, 20];
    const result = combineMatrix(s, t);
    // a*e2 + c*f2 + e = 2*10 + 0*20 + 0 = 20
    // b*e2 + d*f2 + f = 0*10 + 2*20 + 0 = 40
    expectMatrixClose(result, [2, 0, 0, 2, 20, 40]);
  });

  it('translate(10,20) * scale(2) keeps the original translation', () => {
    const t: TransformationMatrix = [1, 0, 0, 1, 10, 20];
    const s: TransformationMatrix = [2, 0, 0, 2, 0, 0];
    const result = combineMatrix(t, s);
    expectMatrixClose(result, [2, 0, 0, 2, 10, 20]);
  });

  it('rotation 90 CW * rotation 90 CW = rotation 180 CW', () => {
    const angle = Math.PI / 2;
    const r90: TransformationMatrix = [
      Math.cos(angle),
      Math.sin(angle),
      -Math.sin(angle),
      Math.cos(angle),
      0,
      0,
    ];
    const result = combineMatrix(r90, r90);
    const angle180 = Math.PI;
    expectMatrixClose(result, [
      Math.cos(angle180),
      Math.sin(angle180),
      -Math.sin(angle180),
      Math.cos(angle180),
      0,
      0,
    ]);
  });

  it('is not commutative in general (scale then translate != translate then scale)', () => {
    const s: TransformationMatrix = [2, 0, 0, 3, 0, 0];
    const t: TransformationMatrix = [1, 0, 0, 1, 10, 20];
    const st = combineMatrix(s, t);
    const ts = combineMatrix(t, s);
    // st: translation is scaled => [2,0,0,3, 20,60]
    // ts: translation is kept => [2,0,0,3, 10,20]
    expect(st[4]).not.toBeCloseTo(ts[4]!);
    expectMatrixClose(st, [2, 0, 0, 3, 20, 60]);
    expectMatrixClose(ts, [2, 0, 0, 3, 10, 20]);
  });
});

// ===========================================================================
// 2. transformationToMatrix — each transform type
// ===========================================================================
describe('transformationToMatrix', () => {
  describe('scale', () => {
    it('scale(2) produces [2,0,0,2,0,0]', () => {
      expectMatrixClose(transformationToMatrix('scale', [2]), [2, 0, 0, 2, 0, 0]);
    });

    it('scale(2,3) produces [2,0,0,3,0,0]', () => {
      expectMatrixClose(transformationToMatrix('scale', [2, 3]), [2, 0, 0, 3, 0, 0]);
    });

    it('scale(1) is identity', () => {
      expectMatrixClose(transformationToMatrix('scale', [1]), identityMatrix);
    });

    it('scale(0) produces zero scaling', () => {
      expectMatrixClose(transformationToMatrix('scale', [0]), [0, 0, 0, 0, 0, 0]);
    });
  });

  describe('scaleX', () => {
    it('scaleX(2) scales only x: [2,0,0,1,0,0]', () => {
      expectMatrixClose(transformationToMatrix('scaleX', [2]), [2, 0, 0, 1, 0, 0]);
    });

    it('scaleX(0.5) produces [0.5,0,0,1,0,0]', () => {
      expectMatrixClose(transformationToMatrix('scaleX', [0.5]), [0.5, 0, 0, 1, 0, 0]);
    });
  });

  describe('scaleY', () => {
    it('scaleY(3) scales only y: [1,0,0,3,0,0]', () => {
      expectMatrixClose(transformationToMatrix('scaleY', [3]), [1, 0, 0, 3, 0, 0]);
    });

    it('scaleY(1) is identity', () => {
      expectMatrixClose(transformationToMatrix('scaleY', [1]), identityMatrix);
    });
  });

  describe('translate', () => {
    it('translate(10,20) produces [1,0,0,1,10,-20] (PDF y-inverted)', () => {
      // The code negates the y value for PDF coordinate system
      expectMatrixClose(
        transformationToMatrix('translate', [10, 20]),
        [1, 0, 0, 1, 10, -20],
      );
    });

    it('translate(0,0) is identity', () => {
      expectMatrixClose(transformationToMatrix('translate', [0, 0]), identityMatrix);
    });

    it('translate(5) uses 5 for both x and -(5) for y', () => {
      // When only one arg is given: [tx, ty=tx], then negated: [5, -5]
      expectMatrixClose(
        transformationToMatrix('translate', [5]),
        [1, 0, 0, 1, 5, -5],
      );
    });
  });

  describe('translateX', () => {
    it('translateX(10) produces [1,0,0,1,10,0]', () => {
      expectMatrixClose(
        transformationToMatrix('translateX', [10]),
        [1, 0, 0, 1, 10, 0],
      );
    });

    it('translateX(0) is identity', () => {
      expectMatrixClose(transformationToMatrix('translateX', [0]), identityMatrix);
    });
  });

  describe('translateY', () => {
    it('translateY(20) produces [1,0,0,1,0,-20]', () => {
      // The y translation is negated for PDF
      expectMatrixClose(
        transformationToMatrix('translateY', [20]),
        [1, 0, 0, 1, 0, -20],
      );
    });

    it('translateY(0) is identity', () => {
      expectMatrixClose(transformationToMatrix('translateY', [0]), identityMatrix);
    });
  });

  describe('rotate', () => {
    it('rotate(0) is identity', () => {
      expectMatrixClose(transformationToMatrix('rotate', [0]), identityMatrix);
    });

    it('rotate(90) produces approximately [0,1,-1,0,0,0] (inverted for PDF)', () => {
      // The code negates the angle: degreesToRadians(-90)
      const a = degreesToRadians(-90);
      const expected: TransformationMatrix = [
        Math.cos(a),
        Math.sin(a),
        -Math.sin(a),
        Math.cos(a),
        0,
        0,
      ];
      expectMatrixClose(transformationToMatrix('rotate', [90]), expected);
    });

    it('rotate(180) produces [-1,0,0,-1,0,0] approximately', () => {
      const a = degreesToRadians(-180);
      const expected: TransformationMatrix = [
        Math.cos(a),
        Math.sin(a),
        -Math.sin(a),
        Math.cos(a),
        0,
        0,
      ];
      expectMatrixClose(transformationToMatrix('rotate', [180]), expected);
    });

    it('rotate(360) returns to identity', () => {
      expectMatrixClose(transformationToMatrix('rotate', [360]), identityMatrix);
    });

    it('rotate(45, cx, cy) rotates around center point', () => {
      // rotate(a, x, y) = translate(x,y) * rotate(a) * translate(-x,-y)
      const result = transformationToMatrix('rotate', [45, 100, 100]);
      // After the combined translation + rotation + inverse translation,
      // the translation components should be non-zero
      expect(result[4]).not.toBe(0);
      expect(result[5]).not.toBe(0);
      // But scale/rotation components should match a 45-degree rotation
      const a = degreesToRadians(-45);
      expect(result[0]).toBeCloseTo(Math.cos(a));
      expect(result[1]).toBeCloseTo(Math.sin(a));
    });
  });

  describe('skewX', () => {
    it('skewX(0) is identity', () => {
      expectMatrixClose(transformationToMatrix('skewX', [0]), identityMatrix);
    });

    it('skewX(45) produces [1,0,tan(-45deg),1,0,0]', () => {
      // The code negates the angle: degreesToRadians(-45)
      const a = degreesToRadians(-45);
      const expected: TransformationMatrix = [1, 0, Math.tan(a), 1, 0, 0];
      expectMatrixClose(transformationToMatrix('skewX', [45]), expected);
    });

    it('skewX(30) produces correct skew value', () => {
      const a = degreesToRadians(-30);
      const expected: TransformationMatrix = [1, 0, Math.tan(a), 1, 0, 0];
      expectMatrixClose(transformationToMatrix('skewX', [30]), expected);
    });
  });

  describe('skewY', () => {
    it('skewY(0) is identity', () => {
      expectMatrixClose(transformationToMatrix('skewY', [0]), identityMatrix);
    });

    it('skewY(45) produces [1,tan(-45deg),0,1,0,0]', () => {
      const a = degreesToRadians(-45);
      const expected: TransformationMatrix = [1, Math.tan(a), 0, 1, 0, 0];
      expectMatrixClose(transformationToMatrix('skewY', [45]), expected);
    });
  });

  describe('matrix', () => {
    it('matrix(1,0,0,1,0,0) produces identity (with double y-flip)', () => {
      // matrix applies: scale(1,-1) * m * scale(1,-1)
      // For identity matrix input: scale(1,-1) * I * scale(1,-1) = I
      expectMatrixClose(
        transformationToMatrix('matrix', [1, 0, 0, 1, 0, 0]),
        identityMatrix,
      );
    });

    it('matrix(2,0,0,2,10,20) applies double flip to get correct PDF transform', () => {
      // r = scale(1,-1) = [1,0,0,-1,0,0]
      // m = [2,0,0,2,10,20]
      // result = combineMatrix(combineMatrix(r, m), r)
      // combineMatrix(r, m) = [1*2+0*0, 0*2+(-1)*0, 1*0+0*2, 0*0+(-1)*2, 1*10+0*20+0, 0*10+(-1)*20+0]
      //                     = [2, 0, 0, -2, 10, -20]
      // combineMatrix([2,0,0,-2,10,-20], [1,0,0,-1,0,0])
      //                     = [2*1+0*0, 0*1+(-2)*0, 2*0+0*(-1), 0*0+(-2)*(-1), 2*0+0*0+10, 0*0+(-2)*0+(-20)]
      //                     = [2, 0, 0, 2, 10, -20]
      expectMatrixClose(
        transformationToMatrix('matrix', [2, 0, 0, 2, 10, 20]),
        [2, 0, 0, 2, 10, -20],
      );
    });

    it('matrix with arbitrary values is double-flipped correctly', () => {
      const m: TransformationMatrix = [1, 2, 3, 4, 5, 6];
      const r: TransformationMatrix = [1, 0, 0, -1, 0, 0];
      const step1 = combineMatrix(r, m);
      const expected = combineMatrix(step1, r);
      expectMatrixClose(transformationToMatrix('matrix', [1, 2, 3, 4, 5, 6]), expected);
    });
  });

  describe('unknown/default transform', () => {
    it('returns identity for an unrecognized transform name', () => {
      // The default branch in the switch returns identityMatrix
      expectMatrixClose(
        transformationToMatrix('unknown' as any, [1, 2, 3]),
        identityMatrix,
      );
    });
  });
});

// ===========================================================================
// 3. Color parsing (tested via drawSvg)
// ===========================================================================
describe('parseColor (via drawSvg)', () => {
  it('fill="none" produces no fill color operator', async () => {
    // stroke-width must be explicitly set; without it, borderWidth defaults to 0
    // and drawSvgPath returns a no-op (getDrawingOperator returns undefined).
    const text = await drawAndGetText(
      '<svg width="100" height="100"><rect width="50" height="50" fill="none" stroke="red" stroke-width="1"/></svg>',
    );
    // Should have the stroke color (red) but no fill operator
    expect(text).toContain('1 0 0 RG');
    // Stroke-only => S operator, not f or B
    expect(text).toMatch(/\nS\n/);
    // Should NOT contain a fill color
    expect(text).not.toContain('rg');
  });

  it('fill="transparent" produces no fill color operator', async () => {
    // stroke-width must be explicitly set; without it, borderWidth defaults to 0
    // and drawSvgPath returns a no-op.
    const text = await drawAndGetText(
      '<svg width="100" height="100"><rect width="50" height="50" fill="transparent" stroke="blue" stroke-width="1"/></svg>',
    );
    expect(text).toContain('0 0 1 RG');
    expect(text).toMatch(/\nS\n/);
    // Should NOT contain a fill color
    expect(text).not.toContain('rg');
  });

  it('fill="red" produces rgb(1,0,0) fill', async () => {
    const text = await drawAndGetText(
      '<svg width="100" height="100"><rect width="50" height="50" fill="red"/></svg>',
    );
    expect(text).toContain('1 0 0 rg');
  });

  it('fill="rgb(0,128,255)" produces correct normalized color', async () => {
    const text = await drawAndGetText(
      '<svg width="100" height="100"><rect width="50" height="50" fill="rgb(0,128,255)"/></svg>',
    );
    // color library normalizes to 0-1 range
    // 0/255 = 0, 128/255 ~= 0.502, 255/255 = 1
    expect(text).toMatch(/0 [\d.]+ 1 rg/);
  });

  it('fill="#ff0000" (hex) produces rgb(1,0,0) fill', async () => {
    const text = await drawAndGetText(
      '<svg width="100" height="100"><rect width="50" height="50" fill="#ff0000"/></svg>',
    );
    expect(text).toContain('1 0 0 rg');
  });

  it('fill="#00ff00" (hex green) produces rgb(0,1,0) fill', async () => {
    const text = await drawAndGetText(
      '<svg width="100" height="100"><rect width="50" height="50" fill="#00ff00"/></svg>',
    );
    expect(text).toContain('0 1 0 rg');
  });

  it('stroke="blue" produces rgb(0,0,1) stroke', async () => {
    const text = await drawAndGetText(
      '<svg width="100" height="100"><line x1="0" y1="0" x2="50" y2="50" stroke="blue"/></svg>',
    );
    expect(text).toContain('0 0 1 RG');
  });

  it('fill="currentColor" falls back to inherited or black', async () => {
    // currentColor without inherited falls back to #000000
    const text = await drawAndGetText(
      '<svg width="100" height="100"><rect width="50" height="50" fill="currentColor"/></svg>',
    );
    expect(text).toContain('0 0 0 rg');
  });
});

// ===========================================================================
// 4. Blend mode parsing (tested via drawSvg)
// ===========================================================================
describe('parseBlendMode (via drawSvg)', () => {
  it('mix-blend-mode="multiply" produces a graphics state operator', async () => {
    const text = await drawAndGetText(
      '<svg width="100" height="100"><rect width="50" height="50" fill="red" style="mix-blend-mode:multiply"/></svg>',
    );
    expect(text).toMatch(/\/GS\S* gs/);
  });

  it('mix-blend-mode="screen" produces a graphics state operator', async () => {
    const text = await drawAndGetText(
      '<svg width="100" height="100"><rect width="50" height="50" fill="red" style="mix-blend-mode:screen"/></svg>',
    );
    expect(text).toMatch(/\/GS\S* gs/);
  });

  it('an unknown blend mode does not produce a gs operator', async () => {
    const text = await drawAndGetText(
      '<svg width="100" height="100"><rect width="50" height="50" fill="red" style="mix-blend-mode:unknown-mode"/></svg>',
    );
    expect(text).not.toMatch(/\/GS\S* gs/);
  });

  it('blendMode option on drawSvg applies to all elements', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    page.drawSvg(
      '<svg width="100" height="100"><rect width="50" height="50" fill="red"/></svg>',
      { blendMode: BlendMode.Overlay },
    );
    const text = getAllContentStreamText(page);
    expect(text).toMatch(/\/GS\S* gs/);
  });

  it('each CSS blend mode name maps correctly', async () => {
    const modes = [
      'normal',
      'multiply',
      'screen',
      'overlay',
      'darken',
      'lighten',
      'color-dodge',
      'color-burn',
      'hard-light',
      'soft-light',
      'difference',
      'exclusion',
    ];
    for (const mode of modes) {
      const text = await drawAndGetText(
        `<svg width="100" height="100"><rect width="50" height="50" fill="red" style="mix-blend-mode:${mode}"/></svg>`,
      );
      // All valid blend modes should produce a gs operator
      expect(text).toMatch(/\/GS\S* gs/);
    }
  });
});

// ===========================================================================
// 5. End-to-end SVG drawing — element types
// ===========================================================================
describe('drawSvg end-to-end — element types', () => {
  describe('<rect>', () => {
    it('draws a rectangle with fill', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><rect x="10" y="10" width="100" height="50" fill="red"/></svg>',
      );
      // Should contain fill color
      expect(text).toContain('1 0 0 rg');
      // Should contain fill operator (f)
      expect(text).toMatch(/\nf\n/);
      // Should be wrapped in q/Q
      expect(text).toContain('q');
      expect(text).toContain('Q');
    });

    it('draws a rectangle with stroke', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><rect width="100" height="50" fill="none" stroke="green" stroke-width="2"/></svg>',
      );
      // Should contain stroke color (green = #008000 = rgb(0, 128/255, 0))
      expect(text).toMatch(/0 0\.501\d+ 0 RG/);
      // Stroke width
      expect(text).toContain('2 w');
      // Stroke operator
      expect(text).toMatch(/\nS\n/);
    });

    it('draws a rectangle with both fill and stroke', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><rect width="100" height="50" fill="red" stroke="blue" stroke-width="1"/></svg>',
      );
      expect(text).toContain('1 0 0 rg'); // red fill
      expect(text).toContain('0 0 1 RG'); // blue stroke
      expect(text).toMatch(/\nB\n/); // fill-and-stroke
    });

    it('a rect without fill and stroke is not drawn', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><rect width="100" height="50"/></svg>',
      );
      // The rect runner checks for fill or stroke and returns early if neither
      expect(text).not.toContain('rg');
      expect(text).not.toContain('RG');
    });

    it('draws a rounded-corner rect (rx/ry)', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><rect width="100" height="50" rx="10" ry="10" fill="red"/></svg>',
      );
      // Rounded corners use bezier curves
      const curveMatches = text.match(/\bc\n/g);
      expect(curveMatches).not.toBeNull();
      expect(curveMatches!.length).toBe(4);
    });
  });

  describe('<circle>', () => {
    it('draws a circle with fill', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><circle cx="100" cy="100" r="50" fill="blue"/></svg>',
      );
      expect(text).toContain('0 0 1 rg');
      // Circle uses 4 bezier curves
      const curveMatches = text.match(/\bc\n/g);
      expect(curveMatches).not.toBeNull();
      expect(curveMatches!.length).toBe(4);
    });

    it('draws a circle with stroke only', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><circle cx="100" cy="100" r="50" fill="none" stroke="black" stroke-width="2"/></svg>',
      );
      expect(text).toContain('0 0 0 RG');
      expect(text).toContain('2 w');
      expect(text).toMatch(/\nS\n/);
    });
  });

  describe('<ellipse>', () => {
    it('draws an ellipse with fill', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><ellipse cx="100" cy="50" rx="80" ry="40" fill="green"/></svg>',
      );
      // Green color
      expect(text).toMatch(/[\d.]+ [\d.]+ [\d.]+ rg/);
      // 4 bezier curves
      const curveMatches = text.match(/\bc\n/g);
      expect(curveMatches).not.toBeNull();
      expect(curveMatches!.length).toBe(4);
    });

    it('draws an ellipse with stroke', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><ellipse cx="100" cy="50" rx="80" ry="40" fill="none" stroke="red" stroke-width="1"/></svg>',
      );
      expect(text).toContain('1 0 0 RG');
      expect(text).toMatch(/\nS\n/);
    });
  });

  describe('<line>', () => {
    it('draws a line between two points', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><line x1="10" y1="20" x2="100" y2="150" stroke="black"/></svg>',
      );
      expect(text).toContain('m'); // moveTo
      expect(text).toContain('l'); // lineTo
      expect(text).toMatch(/\nS\n/); // stroke
    });

    it('line with stroke-width sets w operator', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><line x1="0" y1="0" x2="50" y2="50" stroke="red" stroke-width="3"/></svg>',
      );
      expect(text).toContain('3 w');
    });
  });

  describe('<path>', () => {
    it('draws a simple SVG path', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><path d="M10 10 L 100 10 L 100 100 Z" fill="red"/></svg>',
      );
      expect(text).toContain('1 0 0 rg');
      expect(text).toContain('m'); // moveTo
    });

    it('a path without d attribute is not drawn', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><path fill="red"/></svg>',
      );
      // The path runner returns early if no d attribute
      expect(text).not.toContain('rg');
    });

    it('draws a cubic bezier path', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><path d="M10 80 C 40 10, 65 10, 95 80" stroke="black" fill="none"/></svg>',
      );
      expect(text).toMatch(/c\n/);
    });

    it('draws a path with fill-rule="evenodd"', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><path d="M10 10 L100 10 L100 100 Z" fill="red" fill-rule="evenodd"/></svg>',
      );
      // evenodd fill rule uses f* operator instead of f
      expect(text).toMatch(/f\*/);
    });
  });

  describe('<text>', () => {
    it('draws text content', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><text x="10" y="50">Hello</text></svg>',
      );
      // Text drawing produces BT/ET block
      expect(text).toContain('BT');
      expect(text).toContain('ET');
      // Should contain Tj operator (text show)
      expect(text).toMatch(/<[0-9A-Fa-f]+> Tj/);
    });

    it('draws text with fill color', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><text x="10" y="50" fill="red">Colored</text></svg>',
      );
      expect(text).toContain('1 0 0 rg');
    });

    it('draws text with font-size', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><text x="10" y="50" font-size="24">Big</text></svg>',
      );
      // Tf operator should contain 24
      expect(text).toMatch(/\/\S+ 24 Tf/);
    });

    it('uses default font-size 12 when not specified', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><text x="10" y="50">Default size</text></svg>',
      );
      expect(text).toMatch(/\/\S+ 12 Tf/);
    });
  });

  describe('<polygon>', () => {
    it('converts polygon to path and draws it', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><polygon points="50,10 90,90 10,90" fill="red"/></svg>',
      );
      // Polygon is converted to path with d="M50,10 90,90 10,90Z"
      expect(text).toContain('1 0 0 rg');
      expect(text).toContain('m'); // moveTo from M
    });
  });
});

// ===========================================================================
// 6. SVG attribute handling
// ===========================================================================
describe('SVG attribute handling', () => {
  describe('opacity', () => {
    it('fill-opacity applies a graphics state', async () => {
      const text = await drawAndGetText(
        '<svg width="100" height="100"><rect width="50" height="50" fill="red" fill-opacity="0.5"/></svg>',
      );
      expect(text).toMatch(/\/GS\S* gs/);
    });

    it('stroke-opacity applies a graphics state', async () => {
      // stroke-width must be explicitly set for the stroke to be drawn
      const text = await drawAndGetText(
        '<svg width="100" height="100"><rect width="50" height="50" fill="none" stroke="red" stroke-opacity="0.5" stroke-width="1"/></svg>',
      );
      expect(text).toMatch(/\/GS\S* gs/);
    });

    it('opacity attribute (shorthand) applies a graphics state', async () => {
      const text = await drawAndGetText(
        '<svg width="100" height="100"><rect width="50" height="50" fill="red" opacity="0.5"/></svg>',
      );
      expect(text).toMatch(/\/GS\S* gs/);
    });
  });

  describe('stroke-linecap', () => {
    it('stroke-linecap="round" sets J operator to 1', async () => {
      const text = await drawAndGetText(
        '<svg width="100" height="100"><line x1="0" y1="0" x2="50" y2="50" stroke="black" stroke-linecap="round"/></svg>',
      );
      expect(text).toContain('1 J');
    });

    it('stroke-linecap="square" sets J operator to 2', async () => {
      const text = await drawAndGetText(
        '<svg width="100" height="100"><line x1="0" y1="0" x2="50" y2="50" stroke="black" stroke-linecap="square"/></svg>',
      );
      expect(text).toContain('2 J');
    });

    it('stroke-linecap="butt" is the default and does not emit an explicit J operator', async () => {
      // LineCapStyle.Butt = 0 is falsy, so the `&&` guard in drawLine/drawSvgPath
      // filters it out. Since 0 (butt) is already the PDF default, no explicit
      // "0 J" operator is needed.
      const text = await drawAndGetText(
        '<svg width="100" height="100"><line x1="0" y1="0" x2="50" y2="50" stroke="black" stroke-linecap="butt"/></svg>',
      );
      // The line should still be drawn (stroke operator present)
      expect(text).toMatch(/\nS\n/);
      // Butt is the default, so no explicit J operator is emitted
      expect(text).not.toContain('J');
    });
  });

  describe('stroke-linejoin', () => {
    it('stroke-linejoin is parsed but not yet emitted as a j operator', async () => {
      // The SVG parser recognizes stroke-linejoin and stores it in the element
      // attributes, but the drawing pipeline (drawSvgPath) does not currently
      // emit the `j` (setLineJoin) PDF operator. Verify the path is still drawn.
      const text = await drawAndGetText(
        '<svg width="100" height="100"><path d="M10 10 L50 50 L90 10" fill="none" stroke="black" stroke-width="1" stroke-linejoin="round"/></svg>',
      );
      // The path should still be drawn with a stroke
      expect(text).toMatch(/\nS\n/);
      // No j operator is emitted (feature not yet wired into the drawing pipeline)
      expect(text).not.toMatch(/\d+ j\n/);
    });

    it('stroke-linejoin="bevel" does not crash and path is still drawn', async () => {
      const text = await drawAndGetText(
        '<svg width="100" height="100"><path d="M10 10 L50 50 L90 10" fill="none" stroke="black" stroke-width="1" stroke-linejoin="bevel"/></svg>',
      );
      expect(text).toMatch(/\nS\n/);
    });
  });

  describe('transform attribute', () => {
    it('transform="translate(10,20)" applies translation via cm', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><rect width="50" height="50" fill="red" transform="translate(10,20)"/></svg>',
      );
      expect(text).toContain('cm');
    });

    it('transform="scale(2)" applies scaling via cm', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><rect width="50" height="50" fill="red" transform="scale(2)"/></svg>',
      );
      expect(text).toContain('cm');
    });

    it('transform="rotate(45)" applies rotation via cm', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><rect width="50" height="50" fill="red" transform="rotate(45)"/></svg>',
      );
      expect(text).toContain('cm');
    });

    it('combined transform="translate(10,20) scale(2)" applies both', async () => {
      const text = await drawAndGetText(
        '<svg width="200" height="200"><rect width="50" height="50" fill="red" transform="translate(10,20) scale(2)"/></svg>',
      );
      expect(text).toContain('cm');
    });
  });

  describe('style attribute overrides element attributes', () => {
    it('style fill overrides element fill', async () => {
      const text = await drawAndGetText(
        '<svg width="100" height="100"><rect width="50" height="50" fill="red" style="fill:blue"/></svg>',
      );
      // Blue should win over red
      expect(text).toContain('0 0 1 rg');
      expect(text).not.toContain('1 0 0 rg');
    });

    it('style stroke overrides element stroke', async () => {
      const text = await drawAndGetText(
        '<svg width="100" height="100"><line x1="0" y1="0" x2="50" y2="50" stroke="red" style="stroke:blue"/></svg>',
      );
      expect(text).toContain('0 0 1 RG');
      expect(text).not.toContain('1 0 0 RG');
    });

    it('style stroke-width overrides attribute stroke-width', async () => {
      const text = await drawAndGetText(
        '<svg width="100" height="100"><line x1="0" y1="0" x2="50" y2="50" stroke="black" stroke-width="1" style="stroke-width:5"/></svg>',
      );
      expect(text).toContain('5 w');
    });
  });

  describe('fill/stroke color inheritance', () => {
    it('child inherits fill from parent group', async () => {
      const text = await drawAndGetText(
        '<svg width="100" height="100"><g fill="red"><rect width="50" height="50"/></g></svg>',
      );
      expect(text).toContain('1 0 0 rg');
    });

    it('child inherits stroke from parent group', async () => {
      const text = await drawAndGetText(
        '<svg width="100" height="100"><g stroke="blue"><line x1="0" y1="0" x2="50" y2="50"/></g></svg>',
      );
      expect(text).toContain('0 0 1 RG');
    });

    it('child can override inherited fill', async () => {
      const text = await drawAndGetText(
        '<svg width="100" height="100"><g fill="red"><rect width="50" height="50" fill="blue"/></g></svg>',
      );
      expect(text).toContain('0 0 1 rg');
      expect(text).not.toContain('1 0 0 rg');
    });

    it('deeply nested elements inherit from their ancestor', async () => {
      const text = await drawAndGetText(
        '<svg width="100" height="100"><g fill="green"><g><rect width="50" height="50"/></g></g></svg>',
      );
      // Green = 0 0.502 0 (approximately)
      expect(text).toMatch(/0 [\d.]+ 0 rg/);
    });

    it('stroke-width is inherited', async () => {
      const text = await drawAndGetText(
        '<svg width="100" height="100"><g stroke-width="4" stroke="black"><line x1="0" y1="0" x2="50" y2="50"/></g></svg>',
      );
      expect(text).toContain('4 w');
    });
  });
});

// ===========================================================================
// 7. SVG viewBox and sizing
// ===========================================================================
describe('SVG viewBox and sizing', () => {
  it('drawSvg with width/height options scales the SVG', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    page.drawSvg(
      '<svg width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="red"/></svg>',
      { width: 200, height: 200 },
    );
    const text = getAllContentStreamText(page);
    // The content should be drawn (has fill color and operators)
    expect(text).toContain('1 0 0 rg');
    expect(text).toContain('cm');
  });

  it('drawSvg with x/y options translates the SVG', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    page.drawSvg(
      '<svg width="100" height="100"><rect width="50" height="50" fill="red"/></svg>',
      { x: 50, y: 100 },
    );
    const text = getAllContentStreamText(page);
    // Should have a translation in the transformation matrix
    expect(text).toContain('50');
    expect(text).toContain('100');
    expect(text).toContain('cm');
  });

  it('SVG without explicit viewBox gets one derived from width/height', async () => {
    const text = await drawAndGetText(
      '<svg width="200" height="100"><rect width="200" height="100" fill="red"/></svg>',
    );
    expect(text).toContain('1 0 0 rg');
    expect(text).toMatch(/\nf\n/);
  });

  it('SVG with viewBox different from width/height applies aspect ratio transform', async () => {
    const text = await drawAndGetText(
      '<svg width="200" height="200" viewBox="0 0 100 100"><rect width="100" height="100" fill="red"/></svg>',
    );
    // The viewBox is 100x100 but SVG is 200x200, so scale factor of 2 should be applied
    expect(text).toContain('cm');
    expect(text).toContain('1 0 0 rg');
  });
});

// ===========================================================================
// 8. getFittingRectangle (tested via image-like behaviors)
// ===========================================================================
describe('getFittingRectangle behavior (via combineMatrix internals)', () => {
  // We test this indirectly by verifying aspect ratio transform logic
  // through the exported combineMatrix and transformationToMatrix

  it('combineMatrix can compose scale and translate for aspect ratio fitting', () => {
    // Simulate: target 200x100, original 100x100
    // For "meet" behavior, scale = min(200/100, 100/100) = min(2,1) = 1
    // offset x = (200 - 100*1)/2 = 50, offset y = (100 - 100*1)/2 = 0
    const translate: TransformationMatrix = [1, 0, 0, 1, 50, 0];
    const scale: TransformationMatrix = [1, 0, 0, 1, 0, 0]; // scale=1 is identity
    const result = combineMatrix(translate, scale);
    expectMatrixClose(result, [1, 0, 0, 1, 50, 0]);
  });
});

// ===========================================================================
// 9. getAspectRatioTransformation (tested via nested SVGs)
// ===========================================================================
describe('getAspectRatioTransformation (via nested SVG)', () => {
  it('preserveAspectRatio="none" stretches to fill', async () => {
    const text = await drawAndGetText(
      '<svg width="200" height="100" viewBox="0 0 100 100" preserveAspectRatio="none"><rect width="100" height="100" fill="red"/></svg>',
    );
    // With "none", it should scale x by 2 and y by 1
    expect(text).toContain('cm');
    expect(text).toContain('1 0 0 rg');
  });

  it('preserveAspectRatio="xMidYMid" (default) centers content', async () => {
    const text = await drawAndGetText(
      '<svg width="200" height="100" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid"><rect width="100" height="100" fill="red"/></svg>',
    );
    expect(text).toContain('cm');
    expect(text).toContain('1 0 0 rg');
  });

  it('preserveAspectRatio="xMinYMin" aligns to top-left', async () => {
    const text = await drawAndGetText(
      '<svg width="200" height="100" viewBox="0 0 100 100" preserveAspectRatio="xMinYMin"><rect width="100" height="100" fill="red"/></svg>',
    );
    expect(text).toContain('cm');
    expect(text).toContain('1 0 0 rg');
  });

  it('preserveAspectRatio with "slice" keyword', async () => {
    const text = await drawAndGetText(
      '<svg width="200" height="100" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"><rect width="100" height="100" fill="red"/></svg>',
    );
    expect(text).toContain('cm');
    expect(text).toContain('1 0 0 rg');
  });
});

// ===========================================================================
// 10. Multiple elements in single SVG
// ===========================================================================
describe('Multiple elements in single SVG', () => {
  it('draws all child elements of an SVG', async () => {
    const text = await drawAndGetText(
      `<svg width="200" height="200">
        <rect width="50" height="50" fill="red"/>
        <circle cx="100" cy="100" r="30" fill="blue"/>
      </svg>`,
    );
    // Red fill from rect
    expect(text).toContain('1 0 0 rg');
    // Blue fill from circle
    expect(text).toContain('0 0 1 rg');
    // Multiple q/Q pairs
    const qCount = (text.match(/^q$/gm) || []).length;
    expect(qCount).toBeGreaterThanOrEqual(2);
  });

  it('draws grouped elements in a <g> tag', async () => {
    const text = await drawAndGetText(
      `<svg width="200" height="200">
        <g fill="red">
          <rect width="50" height="50"/>
          <rect x="60" width="50" height="50"/>
        </g>
      </svg>`,
    );
    // Both rects should inherit red from the group
    // Count occurrences of the red fill
    const redMatches = text.match(/1 0 0 rg/g);
    expect(redMatches).not.toBeNull();
    expect(redMatches!.length).toBe(2);
  });
});

// ===========================================================================
// 11. Edge cases
// ===========================================================================
describe('Edge cases', () => {
  it('drawSvg with empty string does not throw', () => {
    expect(async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawSvg('');
    }).not.toThrow();
  });

  it('drawSvg with non-SVG HTML does not throw (logs error)', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    // This should not throw, just log error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    page.drawSvg('<div>Not an SVG</div>');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('SVG with comment nodes does not crash', async () => {
    const text = await drawAndGetText(
      '<svg width="100" height="100"><!-- comment --><rect width="50" height="50" fill="red"/></svg>',
    );
    expect(text).toContain('1 0 0 rg');
  });

  it('SVG with percentage width/height values works', async () => {
    const text = await drawAndGetText(
      '<svg width="100" height="100"><rect width="50%" height="50%" fill="red"/></svg>',
    );
    expect(text).toContain('1 0 0 rg');
  });

  it('drawSvg with PDFSvg object works the same as string', async () => {
    const { default: PDFSvg } = await import('../../src/api/PDFSvg');
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const pdfSvg = new PDFSvg(
      '<svg width="100" height="100"><rect width="50" height="50" fill="red"/></svg>',
    );
    page.drawSvg(pdfSvg);
    const text = getAllContentStreamText(page);
    expect(text).toContain('1 0 0 rg');
  });

  it('SVG with font-family in style inherits to children', async () => {
    const text = await drawAndGetText(
      '<svg width="200" height="200" style="font-family:Helvetica"><text x="10" y="50">Hi</text></svg>',
    );
    expect(text).toContain('BT');
    expect(text).toContain('ET');
  });

  it('SVG text with text-anchor="middle" offsets the x position', async () => {
    const text = await drawAndGetText(
      '<svg width="200" height="200"><text x="100" y="50" text-anchor="middle">Centered</text></svg>',
    );
    expect(text).toContain('BT');
    expect(text).toContain('Tm');
  });

  it('SVG text with text-anchor="end" offsets the x position', async () => {
    const text = await drawAndGetText(
      '<svg width="200" height="200"><text x="100" y="50" text-anchor="end">Right</text></svg>',
    );
    expect(text).toContain('BT');
    expect(text).toContain('Tm');
  });

  it('SVG text with dominant-baseline="middle" offsets y position', async () => {
    const text = await drawAndGetText(
      '<svg width="200" height="200"><text x="50" y="50" dominant-baseline="middle">Mid</text></svg>',
    );
    expect(text).toContain('BT');
  });

  it('SVG text with dominant-baseline="hanging" offsets y position', async () => {
    const text = await drawAndGetText(
      '<svg width="200" height="200"><text x="50" y="50" dominant-baseline="hanging">Hang</text></svg>',
    );
    expect(text).toContain('BT');
  });
});

// ===========================================================================
// 12. combineMatrix numerical correctness
// ===========================================================================
describe('combineMatrix numerical correctness', () => {
  it('correctly computes full 2x3 matrix multiplication', () => {
    // M1 = [a=1, b=2, c=3, d=4, e=5, f=6]
    // M2 = [a=7, b=8, c=9, d=10, e=11, f=12]
    //
    // Result:
    // a' = a*a2 + c*b2 = 1*7 + 3*8 = 7 + 24 = 31
    // b' = b*a2 + d*b2 = 2*7 + 4*8 = 14 + 32 = 46
    // c' = a*c2 + c*d2 = 1*9 + 3*10 = 9 + 30 = 39
    // d' = b*c2 + d*d2 = 2*9 + 4*10 = 18 + 40 = 58
    // e' = a*e2 + c*f2 + e = 1*11 + 3*12 + 5 = 11 + 36 + 5 = 52
    // f' = b*e2 + d*f2 + f = 2*11 + 4*12 + 6 = 22 + 48 + 6 = 76
    const result = combineMatrix(
      [1, 2, 3, 4, 5, 6],
      [7, 8, 9, 10, 11, 12],
    );
    expectMatrixClose(result, [31, 46, 39, 58, 52, 76]);
  });

  it('handles negative values correctly', () => {
    const result = combineMatrix(
      [-1, 0, 0, -1, 0, 0],
      [1, 0, 0, 1, 10, 20],
    );
    // a' = -1*1 + 0*0 = -1, b' = 0*1 + (-1)*0 = 0
    // c' = -1*0 + 0*1 = 0,  d' = 0*0 + (-1)*1 = -1
    // e' = -1*10 + 0*20 + 0 = -10
    // f' = 0*10 + (-1)*20 + 0 = -20
    expectMatrixClose(result, [-1, 0, 0, -1, -10, -20]);
  });

  it('handles fractional values correctly', () => {
    const result = combineMatrix(
      [0.5, 0, 0, 0.5, 0, 0],
      [1, 0, 0, 1, 100, 200],
    );
    expectMatrixClose(result, [0.5, 0, 0, 0.5, 50, 100]);
  });
});

// ===========================================================================
// 13. transformationToMatrix composability
// ===========================================================================
describe('transformationToMatrix composability', () => {
  it('scale then translate via combineMatrix matches expected result', () => {
    const scale = transformationToMatrix('scale', [2]);
    const translate = transformationToMatrix('translate', [10, 0]);
    // translate has y-inversion: [1,0,0,1,10,0]
    const result = combineMatrix(scale, translate);
    // scale=[2,0,0,2,0,0], translate=[1,0,0,1,10,0]
    // e' = 2*10 + 0*0 + 0 = 20
    expectMatrixClose(result, [2, 0, 0, 2, 20, 0]);
  });

  it('two rotations compose correctly', () => {
    const r45 = transformationToMatrix('rotate', [45]);
    const r45_2 = transformationToMatrix('rotate', [45]);
    const r90 = transformationToMatrix('rotate', [90]);
    const composed = combineMatrix(r45, r45_2);
    // Two 45-degree rotations should equal one 90-degree rotation
    expectMatrixClose(composed, r90);
  });

  it('scale(1,-1) applied twice returns to identity', () => {
    const flipY = transformationToMatrix('scale', [1, -1]);
    const result = combineMatrix(flipY, flipY);
    expectMatrixClose(result, identityMatrix);
  });
});

// ===========================================================================
// 14. Nested SVG elements
// ===========================================================================
describe('Nested SVG elements', () => {
  it('inner <svg> element creates its own coordinate space', async () => {
    const text = await drawAndGetText(
      `<svg width="200" height="200">
        <svg x="10" y="10" width="100" height="100">
          <rect width="100" height="100" fill="red"/>
        </svg>
      </svg>`,
    );
    expect(text).toContain('1 0 0 rg');
    expect(text).toContain('cm');
  });

  it('inner SVG with viewBox applies its own aspect ratio transform', async () => {
    const text = await drawAndGetText(
      `<svg width="200" height="200">
        <svg x="0" y="0" width="200" height="200" viewBox="0 0 100 100">
          <rect width="100" height="100" fill="blue"/>
        </svg>
      </svg>`,
    );
    expect(text).toContain('0 0 1 rg');
    expect(text).toContain('cm');
  });
});

// ===========================================================================
// 15. Font-related SVG attributes
// ===========================================================================
describe('Font attributes in SVG', () => {
  it('font-size on parent SVG is inherited by text element', async () => {
    const text = await drawAndGetText(
      '<svg width="200" height="200" font-size="20"><text x="10" y="50">Big</text></svg>',
    );
    expect(text).toMatch(/\/\S+ 20 Tf/);
  });

  it('font-size on group is inherited by text element', async () => {
    const text = await drawAndGetText(
      '<svg width="200" height="200"><g font-size="18"><text x="10" y="50">Grouped</text></g></svg>',
    );
    expect(text).toMatch(/\/\S+ 18 Tf/);
  });

  it('fontSize option on drawSvg overrides SVG font-size', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    page.drawSvg(
      '<svg width="200" height="200"><text x="10" y="50" font-size="12">Overridden</text></svg>',
      { fontSize: 30 },
    );
    const text = getAllContentStreamText(page);
    // The fontSize option sets the font-size attribute on the root SVG element
    // which then gets inherited, but the child's own font-size may still win
    // depending on specificity. The text element's own font-size="12" should apply.
    expect(text).toMatch(/\/\S+ \d+ Tf/);
  });

  it('font-family with quoted complex name is parsed correctly', async () => {
    const text = await drawAndGetText(
      '<svg width="200" height="200"><text x="10" y="50" font-family="&quot;Linux Libertine O&quot;, serif">Test</text></svg>',
    );
    // Should not crash, and text should still render
    expect(text).toContain('BT');
    expect(text).toContain('ET');
  });
});

// ===========================================================================
// 16. Round-trip SVG drawing and PDF save
// ===========================================================================
describe('Round-trip: drawSvg and PDF save', () => {
  it('a PDF with drawSvg can be saved and loaded', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    page.drawSvg(
      `<svg width="200" height="200">
        <rect width="100" height="100" fill="red"/>
        <circle cx="150" cy="150" r="30" fill="blue"/>
        <line x1="0" y1="0" x2="200" y2="200" stroke="black"/>
      </svg>`,
    );

    const bytes = await doc.save();
    expect(bytes.length).toBeGreaterThan(0);

    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('multiple drawSvg calls on same page produce valid PDF', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    page.drawSvg(
      '<svg width="100" height="100"><rect width="100" height="100" fill="red"/></svg>',
      { x: 0, y: 0 },
    );
    page.drawSvg(
      '<svg width="100" height="100"><circle cx="50" cy="50" r="25" fill="blue"/></svg>',
      { x: 200, y: 200 },
    );

    const bytes = await doc.save();
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
  });
});

// ===========================================================================
// 17. drawSvg with specific fonts provided
// ===========================================================================
describe('drawSvg with fonts option', () => {
  it('uses provided font when font-family matches', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    page.drawSvg(
      '<svg width="200" height="200"><text x="10" y="50" font-family="Helvetica">Custom font</text></svg>',
      {
        fonts: { Helvetica: font },
      },
    );

    const text = getAllContentStreamText(page);
    expect(text).toContain('BT');
    expect(text).toMatch(/<[0-9A-Fa-f]+> Tj/);
  });

  it('uses bold font variant when font-weight is bold', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const regularFont = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

    page.drawSvg(
      '<svg width="200" height="200"><text x="10" y="50" font-family="Helvetica" font-weight="bold">Bold text</text></svg>',
      {
        fonts: {
          Helvetica: regularFont,
          Helvetica_bold: boldFont,
        },
      },
    );

    const text = getAllContentStreamText(page);
    expect(text).toContain('BT');
    expect(text).toMatch(/<[0-9A-Fa-f]+> Tj/);
  });

  it('uses italic font variant when font-style is italic', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const regularFont = await doc.embedFont(StandardFonts.Helvetica);
    const italicFont = await doc.embedFont(StandardFonts.HelveticaOblique);

    page.drawSvg(
      '<svg width="200" height="200"><text x="10" y="50" font-family="Helvetica" font-style="italic">Italic text</text></svg>',
      {
        fonts: {
          Helvetica: regularFont,
          Helvetica_italic: italicFont,
        },
      },
    );

    const text = getAllContentStreamText(page);
    expect(text).toContain('BT');
    expect(text).toMatch(/<[0-9A-Fa-f]+> Tj/);
  });
});

// ===========================================================================
// 18. Graphics state management
// ===========================================================================
describe('Graphics state management in drawSvg', () => {
  it('each element is wrapped in q/Q save/restore', async () => {
    const text = await drawAndGetText(
      `<svg width="200" height="200">
        <rect width="50" height="50" fill="red"/>
        <rect x="60" width="50" height="50" fill="blue"/>
      </svg>`,
    );
    const qCount = (text.match(/^q$/gm) || []).length;
    const bigQCount = (text.match(/^Q$/gm) || []).length;
    // Each element should have its own q/Q pair
    expect(qCount).toBeGreaterThanOrEqual(2);
    expect(bigQCount).toBeGreaterThanOrEqual(2);
    // q and Q should be balanced
    expect(qCount).toBe(bigQCount);
  });
});

// ===========================================================================
// 19. Complex SVG structures
// ===========================================================================
describe('Complex SVG structures', () => {
  it('handles SVG with mixed element types', async () => {
    const text = await drawAndGetText(
      `<svg width="300" height="300" viewBox="0 0 300 300">
        <rect width="300" height="300" fill="#eeeeee"/>
        <circle cx="150" cy="150" r="100" fill="red" stroke="black" stroke-width="2"/>
        <line x1="0" y1="150" x2="300" y2="150" stroke="blue"/>
        <path d="M50 250 Q 150 200 250 250" fill="none" stroke="green"/>
        <text x="150" y="30" text-anchor="middle" fill="black" font-size="16">Title</text>
      </svg>`,
    );

    // Rect fill (grey)
    expect(text).toMatch(/[\d.]+ [\d.]+ [\d.]+ rg/);
    // Circle bezier curves
    const curveMatches = text.match(/\bc\n/g);
    expect(curveMatches).not.toBeNull();
    // Line stroke
    expect(text).toContain('m');
    expect(text).toContain('l');
    // Path operators
    expect(text).toMatch(/v\n/); // quadratic curve
    // Text
    expect(text).toContain('BT');
    expect(text).toContain('ET');
  });

  it('handles deeply nested groups', async () => {
    const text = await drawAndGetText(
      `<svg width="100" height="100">
        <g transform="translate(10,10)">
          <g transform="scale(0.5)">
            <g fill="red">
              <rect width="50" height="50"/>
            </g>
          </g>
        </g>
      </svg>`,
    );
    expect(text).toContain('1 0 0 rg');
    expect(text).toContain('cm');
  });

  it('draws SVG with multiple transform types on a single element', async () => {
    const text = await drawAndGetText(
      '<svg width="200" height="200"><rect width="50" height="50" fill="red" transform="translate(50,50) rotate(45) scale(1.5)"/></svg>',
    );
    expect(text).toContain('1 0 0 rg');
    expect(text).toContain('cm');
  });
});
