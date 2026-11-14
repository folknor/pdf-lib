import fs from 'fs';

import fontkit from 'src/fontkit.js';

// Fixtures are fontkit's TestGVAR*/TestHVAR* corpus, in TTF, WOFF and WOFF2
// form (scripts/fetch-variation-fixtures.sh).
const open = (file: string): any =>
  fontkit.create(
    new Uint8Array(fs.readFileSync(`./assets/fonts/fonttest/${file}`)),
  );

const GVAR_300_SVG =
  'M371 -102L371 539L914 539L914 -27Q914 -102 840 -102Q796 -102 755 -98L742 -59Q790 -66 836 -66Q871 -66 871 -31L871 504L414 504L414 -102ZM203 -94Q138 -94 86 -90L74 -52Q137 -59 188 -59Q211 -59 222 -46.5Q233 -34 235.5 12Q238 58 240 134.5Q242 211 242 262L74 262L94 527L242 527L242 719L63 719L63 754L285 754L285 492L133 492L117 297L285 297Q285 241 284 185Q284 104 281 46Q278 -20 269 -49Q260 -78 241.5 -86Q223 -94 203 -94ZM461 12L434 43Q473 73 503 115Q478 150 441 188L469 211Q501 179 525 147Q538 172 559 230L594 211Q571 152 551 117Q577 84 602 43L566 20Q544 64 528 86Q500 44 461 12ZM465 258L438 285Q474 316 501 351Q474 388 445 418L473 441Q500 414 523 381Q546 413 563 453L598 434Q571 382 549 352Q576 320 598 285L563 262Q546 294 525 322Q491 280 465 258ZM707 12L680 43Q717 68 753 115Q731 147 691 188L719 211Q739 190 754 172Q769 154 774 147Q793 185 809 230L844 211Q822 155 801 117Q828 82 852 43L820 20Q798 58 778 87Q747 43 707 12ZM621 -94L621 730L664 730L664 -94ZM348 570L324 605Q425 629 527 688L555 656Q491 621 438.5 601Q386 581 348 570ZM715 258L688 285Q727 318 753 351Q733 378 695 418L723 441Q754 410 775 381Q794 407 813 453L848 434Q826 387 801 352Q823 321 848 281L813 262Q791 301 775 323Q749 288 715 258ZM348 719L348 754L941 754L941 719ZM936 570Q870 602 817 621.5Q764 641 727 652L749 688Q852 655 957 605Z';

const cases = [
  { name: 'TestGVAROne', char: '彌', settings: { wght: 300 } },
  { name: 'TestGVARTwo', char: '彌', settings: { wght: 300 } },
  { name: 'TestGVARThree', char: '彌', settings: { wght: 300 } },
  { name: 'TestGVARFour', char: 'O', settings: { wght: 150 } },
  { name: 'TestHVARTwo', char: 'A', settings: { wght: 400 } },
];

const variationGlyph = (
  file: string,
  settings: Record<string, number>,
  char: string,
) => {
  const font = open(file).getVariation(settings);

  return { font, glyph: font.glyphsForString(char)[0] };
};

describe('TrueType variations', () => {
  it('applies gvar deltas (shared, enumerated and no shared points)', () => {
    for (const name of ['TestGVAROne', 'TestGVARTwo', 'TestGVARThree']) {
      const { glyph } = variationGlyph(`${name}.ttf`, { wght: 300 }, '彌');
      expect(glyph.path.toSVG()).toBe(GVAR_300_SVG);
    }
  });

  // TestGVAR* glyph 1 is empty and has gvar data, but none of the fixtures
  // move a phantom point, so these tests shift them through a wrapped
  // transformPoints: +50 on the right origin, -30 on the bottom origin.
  const shiftPhantoms = (font: any) => {
    const processor = font._variationProcessor;
    const transform = processor.transformPoints.bind(processor);
    processor.transformPoints = (gid: number, points: any[]) => {
      transform(gid, points);
      points[points.length - 3].x += 50;
      points[points.length - 1].y -= 30;
    };
  };

  for (const ext of ['ttf', 'woff', 'woff2']) {
    it(`varies an empty ${ext} glyph's metrics through its phantom points without HVAR`, () => {
      const font = open(`TestGVAROne.${ext}`).getVariation({ wght: 300 });
      expect(font.HVAR).toBeUndefined();
      shiftPhantoms(font);
      const empty = font.getGlyph(1);
      expect(empty._decode().numberOfContours).toBe(0);
      expect(empty.path.commands).toEqual([]);
      const unvaried = open(`TestGVAROne.${ext}`).getGlyph(1);
      expect(empty.advanceWidth).toBe(unvaried.advanceWidth + 50);
      expect(empty.advanceHeight).toBe(unvaried.advanceHeight + 30);
    });
  }

  it('applies phantom deltas once however often a glyph is decoded', () => {
    const font = open('TestGVAROne.ttf').getVariation({ wght: 300 });
    shiftPhantoms(font);
    const glyph = font.glyphsForString('彌')[0];
    const unvaried = open('TestGVAROne.ttf').getGlyph(glyph.id);

    for (let i = 0; i < 3; i++) glyph._getContours();
    expect(glyph._getMetrics().advanceWidth).toBe(unvaried.advanceWidth + 50);
  });

  it('gives COLR glyphs their varied base outline metrics', () => {
    const font = open('TestGVAROne.ttf').getVariation({ wght: 300 });
    expect(font.HVAR).toBeUndefined();
    shiftPhantoms(font);
    font.directory.tables = { ...font.directory.tables, COLR: {}, CPAL: {} };
    Object.defineProperty(font, 'COLR', { value: { version: 1 } });
    Object.defineProperty(font, 'CPAL', { value: {} });
    const colr = font.glyphsForString('彌')[0];
    expect(colr.type).toBe('COLR');
    expect(font._glyphs[colr.id]).toBe(colr);
    const unvaried = open('TestGVAROne.ttf').getGlyph(colr.id);
    // Width first, as the embedder reads it, before any geometry.
    expect(colr.advanceWidth).toBe(unvaried.advanceWidth + 50);
    const metrics = colr._getMetrics();
    const base = font._getBaseGlyph(colr.id)._getMetrics();
    expect(metrics).toEqual(base);
    expect(metrics).not.toBe(base);
    expect(colr._getMetrics()).toBe(metrics);
    expect(colr.name).toBe(font._getBaseGlyph(colr.id).name);
  });

  // Bearings run from the varied outline's extents to the varied phantom
  // points; the left origin is xMin - lsb, the top one yMax + tsb.
  const origins = (glyph: any) => {
    const { leftBearing, topBearing } = glyph._getMetrics();

    return {
      left: glyph.cbox.minX - leftBearing,
      top: glyph.cbox.maxY + topBearing,
    };
  };

  it('measures varied bearings from the varied outline', () => {
    const moved: string[] = [];

    for (const [file, settings, char] of [
      ['TestGVAROne.ttf', { wght: 300 }, '彌'],
      ['TestGVARFour.ttf', { wght: 150 }, 'O'],
      ['TestHVARTwo.ttf', { wght: 400 }, 'A'],
    ] as const) {
      const { glyph } = variationGlyph(file, settings, char);
      const unvaried = open(file).getGlyph(glyph.id);

      if (glyph.cbox.minX !== unvaried.cbox.minX) moved.push(file);
      // The varied outline is placed relative to its left origin; the
      // fixtures may move the top one.
      expect(origins(glyph).left).toBe(0);
      expect(origins(glyph).top).toBe(glyph._decode().phantomPoints[2].y);
    }

    // Only an outline whose extents moved tells the two measures apart.
    expect(moved).toContain('TestGVARFour.ttf');
  });

  // A moved left phantom point moves the outline with it: the outline is
  // placed relative to the varied origin, so the bearing is its xMin.
  it('shifts the varied outline by a moved left phantom point', () => {
    const plain = variationGlyph('TestGVAROne.ttf', { wght: 300 }, '彌').glyph;
    const font = open('TestGVAROne.ttf').getVariation({ wght: 300 });
    const processor = font._variationProcessor;
    const transform = processor.transformPoints.bind(processor);
    processor.transformPoints = (gid: number, points: any[]) => {
      transform(gid, points);
      points[points.length - 4].x += 20;
    };

    const glyph = font.glyphsForString('彌')[0];
    expect(origins(glyph).left).toBe(0);
    expect(glyph.cbox.minX).toBe(plain.cbox.minX - 20);
    expect(glyph._getMetrics().leftBearing).toBe(
      plain._getMetrics().leftBearing - 20,
    );
    expect(glyph._getMetrics().advanceWidth).toBe(
      plain._getMetrics().advanceWidth - 20,
    );
  });

  it('keeps the HVAR advance when the path is read first', () => {
    const { glyph } = variationGlyph('TestHVARTwo.ttf', { wght: 400 }, 'A');
    void glyph.path;
    expect(Math.round(glyph.advanceWidth)).toBe(584);
  });

  it('uses HVAR for variation metrics', () => {
    expect(
      Math.round(
        variationGlyph('TestGVARFour.ttf', { wght: 150 }, 'O').glyph
          .advanceWidth,
      ),
    ).toBe(706);
    expect(
      Math.round(
        variationGlyph('TestHVARTwo.ttf', { wght: 400 }, 'A').glyph
          .advanceWidth,
      ),
    ).toBe(584);
  });
});

describe('subsetting a variation instance', () => {
  for (const ext of ['ttf', 'woff', 'woff2']) {
    it(`bakes the varied outline into the ${ext} subset`, () => {
      const font = open(`TestGVAROne.${ext}`).getVariation({ wght: 300 });
      const glyph = font.glyphsForString('彌')[0];
      const subset = font.createSubset();
      const id = subset.includeGlyph(glyph.id);
      const reopened: any = fontkit.create(subset.encode());
      expect(reopened.getGlyph(id).path.toSVG()).toBe(GVAR_300_SVG);
    });
  }

  // The written bearing is the written xMin even when gvar moves the left
  // origin, so no renderer translates the outline by a phantom point.
  it('writes each glyph bearing as its encoded xMin', () => {
    const font = open('TestGVAROne.ttf').getVariation({ wght: 300 });
    const processor = font._variationProcessor;
    const transform = processor.transformPoints.bind(processor);
    processor.transformPoints = (gid: number, points: any[]) => {
      transform(gid, points);
      points[points.length - 4].x += 20;
    };

    const subset = font.createSubset();
    const id = subset.includeGlyph(font.glyphsForString('彌')[0].id);
    const reopened: any = fontkit.create(subset.encode());
    const written = reopened.getGlyph(id);
    expect(written._getMetrics().leftBearing).toBe(written._decode().xMin);
    const source = font.glyphsForString('彌')[0];
    expect(written._decode().xMin).toBe(Math.round(source.cbox.minX));
    expect(written._decode().xMin).toBe(
      Math.round(source._getMetrics().leftBearing),
    );
  });
});

describe('WOFF and WOFF2 variations', () => {
  for (const { name, char, settings } of cases) {
    describe(name, () => {
      const ttf = variationGlyph(`${name}.ttf`, settings, char).glyph;
      const ttfSvg = ttf.path.toSVG();
      const ttfAdvance = Math.round(ttf.advanceWidth);
      const ttfCBox = ttf.cbox;

      for (const [ext, type] of [
        ['woff', 'WOFF'],
        ['woff2', 'WOFF2'],
      ] as const) {
        it(`matches the TTF instance when loaded from ${type}`, () => {
          const { font, glyph } = variationGlyph(
            `${name}.${ext}`,
            settings,
            char,
          );

          expect(font.type).toBe(type);
          expect(glyph.path.toSVG()).toBe(ttfSvg);
          expect(Math.round(glyph.advanceWidth)).toBe(ttfAdvance);
          expect(glyph.cbox).toEqual(ttfCBox);
        });
      }
    });
  }

  for (const ext of ['woff', 'woff2']) {
    it(`leaves the ${ext} source font and sibling instances independent`, () => {
      const font = open(`TestGVAROne.${ext}`);
      const original = font.glyphsForString('彌')[0].path.toSVG();

      const light = font
        .getVariation({ wght: 0 })
        .glyphsForString('彌')[0]
        .path.toSVG();

      const bold = font
        .getVariation({ wght: 1000 })
        .glyphsForString('彌')[0]
        .path.toSVG();

      expect(light).not.toBe(bold);
      expect(
        font.getVariation({ wght: 0 }).glyphsForString('彌')[0].path.toSVG(),
      ).toBe(light);
      expect(font.glyphsForString('彌')[0].path.toSVG()).toBe(original);
    });
  }

  it('reports the unvaried WOFF2 glyph bbox from the transformed glyf table', () => {
    const ttf = open('TestGVAROne.ttf');
    const woff2 = open('TestGVAROne.woff2');
    let compared = 0;

    for (let id = 0; id < ttf.numGlyphs; id++) {
      compared++;
      expect(woff2.getGlyph(id)._getCBox(true)).toEqual(
        ttf.getGlyph(id)._getCBox(true),
      );
    }

    expect(compared).toBeGreaterThan(0);
  });
});
