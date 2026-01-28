import {
  rgb,
  cmyk,
  grayscale,
  ColorTypes,
  colorToComponents,
  componentsToColor,
  setFillingColor,
  setStrokingColor,
  colorString,
  setFillingGrayscaleColor,
  setFillingRgbColor,
  setFillingCmykColor,
  setStrokingGrayscaleColor,
  setStrokingRgbColor,
  setStrokingCmykColor,
} from '../../src/index';

describe('colors', () => {
  // ===================== rgb() =====================
  describe('rgb()', () => {
    it('returns a Color with type RGB and correct components', () => {
      const color = rgb(1, 0, 0);
      expect(color.type).toBe(ColorTypes.RGB);
      expect(color.type).toBe('RGB');
      expect(color.red).toBe(1);
      expect(color.green).toBe(0);
      expect(color.blue).toBe(0);
    });

    it('handles fractional values', () => {
      const color = rgb(0.5, 0.3, 0.7);
      expect(color).toEqual({
        type: ColorTypes.RGB,
        red: 0.5,
        green: 0.3,
        blue: 0.7,
      });
    });

    it('handles all zeros', () => {
      const color = rgb(0, 0, 0);
      expect(color).toEqual({
        type: ColorTypes.RGB,
        red: 0,
        green: 0,
        blue: 0,
      });
    });

    it('handles all ones', () => {
      const color = rgb(1, 1, 1);
      expect(color).toEqual({
        type: ColorTypes.RGB,
        red: 1,
        green: 1,
        blue: 1,
      });
    });
  });

  // ===================== cmyk() =====================
  describe('cmyk()', () => {
    it('returns a Color with type CMYK and correct components', () => {
      const color = cmyk(1, 0, 0, 0);
      expect(color.type).toBe(ColorTypes.CMYK);
      expect(color.type).toBe('CMYK');
      expect(color.cyan).toBe(1);
      expect(color.magenta).toBe(0);
      expect(color.yellow).toBe(0);
      expect(color.key).toBe(0);
    });

    it('handles fractional values', () => {
      const color = cmyk(0.1, 0.2, 0.3, 0.4);
      expect(color).toEqual({
        type: ColorTypes.CMYK,
        cyan: 0.1,
        magenta: 0.2,
        yellow: 0.3,
        key: 0.4,
      });
    });

    it('handles all zeros', () => {
      const color = cmyk(0, 0, 0, 0);
      expect(color).toEqual({
        type: ColorTypes.CMYK,
        cyan: 0,
        magenta: 0,
        yellow: 0,
        key: 0,
      });
    });

    it('handles all ones', () => {
      const color = cmyk(1, 1, 1, 1);
      expect(color).toEqual({
        type: ColorTypes.CMYK,
        cyan: 1,
        magenta: 1,
        yellow: 1,
        key: 1,
      });
    });
  });

  // ===================== grayscale() =====================
  describe('grayscale()', () => {
    it('returns a Color with type Grayscale and correct gray value', () => {
      const color = grayscale(0.5);
      expect(color.type).toBe(ColorTypes.Grayscale);
      expect(color.type).toBe('Grayscale');
      expect(color.gray).toBe(0.5);
    });

    it('handles black (0)', () => {
      const color = grayscale(0);
      expect(color).toEqual({ type: ColorTypes.Grayscale, gray: 0 });
    });

    it('handles white (1)', () => {
      const color = grayscale(1);
      expect(color).toEqual({ type: ColorTypes.Grayscale, gray: 1 });
    });

    it('handles mid-gray', () => {
      const color = grayscale(0.75);
      expect(color).toEqual({ type: ColorTypes.Grayscale, gray: 0.75 });
    });
  });

  // ===================== colorToComponents() =====================
  describe('colorToComponents()', () => {
    it('returns [gray] for Grayscale color', () => {
      expect(colorToComponents(grayscale(0.5))).toEqual([0.5]);
    });

    it('returns [red, green, blue] for RGB color', () => {
      expect(colorToComponents(rgb(0.1, 0.2, 0.3))).toEqual([0.1, 0.2, 0.3]);
    });

    it('returns [cyan, magenta, yellow, key] for CMYK color', () => {
      expect(colorToComponents(cmyk(0.1, 0.2, 0.3, 0.4))).toEqual([
        0.1, 0.2, 0.3, 0.4,
      ]);
    });

    it('returns single-element array for grayscale(0)', () => {
      expect(colorToComponents(grayscale(0))).toEqual([0]);
    });

    it('returns three-element array for rgb(1,1,1)', () => {
      expect(colorToComponents(rgb(1, 1, 1))).toEqual([1, 1, 1]);
    });

    it('returns four-element array for cmyk(0,0,0,0)', () => {
      expect(colorToComponents(cmyk(0, 0, 0, 0))).toEqual([0, 0, 0, 0]);
    });
  });

  // ===================== componentsToColor() =====================
  describe('componentsToColor()', () => {
    it('returns Grayscale for a 1-element array', () => {
      const color = componentsToColor([0.5]);
      expect(color).toEqual({ type: ColorTypes.Grayscale, gray: 0.5 });
    });

    it('returns RGB for a 3-element array', () => {
      const color = componentsToColor([0.1, 0.2, 0.3]);
      expect(color).toEqual({
        type: ColorTypes.RGB,
        red: 0.1,
        green: 0.2,
        blue: 0.3,
      });
    });

    it('returns CMYK for a 4-element array', () => {
      const color = componentsToColor([0.1, 0.2, 0.3, 0.4]);
      expect(color).toEqual({
        type: ColorTypes.CMYK,
        cyan: 0.1,
        magenta: 0.2,
        yellow: 0.3,
        key: 0.4,
      });
    });

    it('returns undefined for undefined input', () => {
      expect(componentsToColor(undefined)).toBeUndefined();
    });

    it('returns undefined for a 2-element array', () => {
      expect(componentsToColor([0.1, 0.2])).toBeUndefined();
    });

    it('returns undefined for a 5-element array', () => {
      expect(componentsToColor([0.1, 0.2, 0.3, 0.4, 0.5])).toBeUndefined();
    });

    it('returns undefined for an empty array', () => {
      expect(componentsToColor([])).toBeUndefined();
    });

    it('applies scale factor to components', () => {
      const color = componentsToColor([128, 64, 32], 1 / 255);
      expect(color).toBeDefined();
      expect(color!.type).toBe(ColorTypes.RGB);
      if (color!.type === ColorTypes.RGB) {
        expect(color.red).toBeCloseTo(128 / 255);
        expect(color.green).toBeCloseTo(64 / 255);
        expect(color.blue).toBeCloseTo(32 / 255);
      }
    });

    it('applies scale factor to grayscale', () => {
      const color = componentsToColor([200], 1 / 255);
      expect(color).toBeDefined();
      expect(color!.type).toBe(ColorTypes.Grayscale);
      if (color!.type === ColorTypes.Grayscale) {
        expect(color.gray).toBeCloseTo(200 / 255);
      }
    });

    it('applies scale factor to CMYK', () => {
      const color = componentsToColor([100, 150, 200, 50], 1 / 255);
      expect(color).toBeDefined();
      expect(color!.type).toBe(ColorTypes.CMYK);
      if (color!.type === ColorTypes.CMYK) {
        expect(color.cyan).toBeCloseTo(100 / 255);
        expect(color.magenta).toBeCloseTo(150 / 255);
        expect(color.yellow).toBeCloseTo(200 / 255);
        expect(color.key).toBeCloseTo(50 / 255);
      }
    });
  });

  // ===================== colorString() =====================
  describe('colorString()', () => {
    it('parses rgb(255,0,0) to RGB(1,0,0) with no alpha', () => {
      const result = colorString('rgb(255,0,0)');
      expect(result.rgb).toEqual({
        type: ColorTypes.RGB,
        red: 1,
        green: 0,
        blue: 0,
      });
      expect(result.alpha).toBeUndefined();
    });

    it('parses rgba(255,0,0,0.5) to RGB(1,0,0) with alpha 0.5', () => {
      const result = colorString('rgba(255,0,0,0.5)');
      expect(result.rgb).toEqual({
        type: ColorTypes.RGB,
        red: 1,
        green: 0,
        blue: 0,
      });
      expect(result.alpha).toBe(0.5);
    });

    it('parses #ff0000 to RGB(1,0,0)', () => {
      const result = colorString('#ff0000');
      expect(result.rgb).toEqual({
        type: ColorTypes.RGB,
        red: 1,
        green: 0,
        blue: 0,
      });
      expect(result.alpha).toBeUndefined();
    });

    it('parses short hex #f00 to RGB(1,0,0)', () => {
      const result = colorString('#f00');
      expect(result.rgb).toEqual({
        type: ColorTypes.RGB,
        red: 1,
        green: 0,
        blue: 0,
      });
      expect(result.alpha).toBeUndefined();
    });

    it('parses named color "red" to RGB(1,0,0)', () => {
      const result = colorString('red');
      expect(result.rgb).toEqual({
        type: ColorTypes.RGB,
        red: 1,
        green: 0,
        blue: 0,
      });
    });

    it('parses named color "blue" to RGB(0,0,1)', () => {
      const result = colorString('blue');
      expect(result.rgb).toEqual({
        type: ColorTypes.RGB,
        red: 0,
        green: 0,
        blue: 1,
      });
    });

    it('parses named color "green" to RGB(0,128/255,0)', () => {
      const result = colorString('green');
      // CSS "green" is rgb(0, 128, 0) => unitObject: r=0, g=128/255, b=0
      expect(result.rgb.type).toBe(ColorTypes.RGB);
      if (result.rgb.type === ColorTypes.RGB) {
        expect(result.rgb.red).toBeCloseTo(0);
        expect(result.rgb.green).toBeCloseTo(128 / 255);
        expect(result.rgb.blue).toBeCloseTo(0);
      }
    });

    it('parses "white" to RGB(1,1,1)', () => {
      const result = colorString('white');
      expect(result.rgb).toEqual({
        type: ColorTypes.RGB,
        red: 1,
        green: 1,
        blue: 1,
      });
    });

    it('parses "black" to RGB(0,0,0)', () => {
      const result = colorString('black');
      expect(result.rgb).toEqual({
        type: ColorTypes.RGB,
        red: 0,
        green: 0,
        blue: 0,
      });
    });

    it('parses #000000 to RGB(0,0,0)', () => {
      const result = colorString('#000000');
      expect(result.rgb).toEqual({
        type: ColorTypes.RGB,
        red: 0,
        green: 0,
        blue: 0,
      });
    });

    it('parses #ffffff to RGB(1,1,1)', () => {
      const result = colorString('#ffffff');
      expect(result.rgb).toEqual({
        type: ColorTypes.RGB,
        red: 1,
        green: 1,
        blue: 1,
      });
    });

    it('parses rgba with alpha=1 (alpha should be undefined in unitObject)', () => {
      const result = colorString('rgba(255,0,0,1)');
      expect(result.rgb).toEqual({
        type: ColorTypes.RGB,
        red: 1,
        green: 0,
        blue: 0,
      });
      expect(result.alpha).toBeUndefined();
    });

    it('parses rgba with alpha=0', () => {
      const result = colorString('rgba(0,0,255,0)');
      expect(result.rgb).toEqual({
        type: ColorTypes.RGB,
        red: 0,
        green: 0,
        blue: 1,
      });
      expect(result.alpha).toBe(0);
    });
  });

  // ===================== setFillingColor() =====================
  describe('setFillingColor()', () => {
    it('returns operator with name "g" for Grayscale color', () => {
      const op = setFillingColor(grayscale(0.5));
      expect(op.toString()).toBe('0.5 g');
    });

    it('returns operator with name "rg" for RGB color', () => {
      const op = setFillingColor(rgb(1, 0, 0));
      expect(op.toString()).toBe('1 0 0 rg');
    });

    it('returns operator with name "k" for CMYK color', () => {
      const op = setFillingColor(cmyk(1, 0, 0, 0));
      expect(op.toString()).toBe('1 0 0 0 k');
    });

    it('includes correct numeric values for Grayscale', () => {
      const op = setFillingColor(grayscale(0));
      expect(op.toString()).toBe('0 g');
    });

    it('includes correct numeric values for RGB', () => {
      const op = setFillingColor(rgb(0.5, 0.3, 0.7));
      expect(op.toString()).toBe('0.5 0.3 0.7 rg');
    });

    it('includes correct numeric values for CMYK', () => {
      const op = setFillingColor(cmyk(0.1, 0.2, 0.3, 0.4));
      expect(op.toString()).toBe('0.1 0.2 0.3 0.4 k');
    });
  });

  // ===================== setStrokingColor() =====================
  describe('setStrokingColor()', () => {
    it('returns operator with name "G" for Grayscale color', () => {
      const op = setStrokingColor(grayscale(0.5));
      expect(op.toString()).toBe('0.5 G');
    });

    it('returns operator with name "RG" for RGB color', () => {
      const op = setStrokingColor(rgb(1, 0, 0));
      expect(op.toString()).toBe('1 0 0 RG');
    });

    it('returns operator with name "K" for CMYK color', () => {
      const op = setStrokingColor(cmyk(1, 0, 0, 0));
      expect(op.toString()).toBe('1 0 0 0 K');
    });

    it('includes correct numeric values for Grayscale', () => {
      const op = setStrokingColor(grayscale(1));
      expect(op.toString()).toBe('1 G');
    });

    it('includes correct numeric values for RGB', () => {
      const op = setStrokingColor(rgb(0, 1, 0));
      expect(op.toString()).toBe('0 1 0 RG');
    });

    it('includes correct numeric values for CMYK', () => {
      const op = setStrokingColor(cmyk(0, 0, 1, 1));
      expect(op.toString()).toBe('0 0 1 1 K');
    });
  });

  // ===================== setFillingGrayscaleColor() =====================
  describe('setFillingGrayscaleColor()', () => {
    it('returns operator with name "g"', () => {
      const op = setFillingGrayscaleColor(0.5);
      expect(op.toString()).toBe('0.5 g');
    });

    it('handles 0', () => {
      const op = setFillingGrayscaleColor(0);
      expect(op.toString()).toBe('0 g');
    });

    it('handles 1', () => {
      const op = setFillingGrayscaleColor(1);
      expect(op.toString()).toBe('1 g');
    });
  });

  // ===================== setFillingRgbColor() =====================
  describe('setFillingRgbColor()', () => {
    it('returns operator with name "rg"', () => {
      const op = setFillingRgbColor(1, 0, 0);
      expect(op.toString()).toBe('1 0 0 rg');
    });

    it('handles all zeros', () => {
      const op = setFillingRgbColor(0, 0, 0);
      expect(op.toString()).toBe('0 0 0 rg');
    });

    it('handles all ones', () => {
      const op = setFillingRgbColor(1, 1, 1);
      expect(op.toString()).toBe('1 1 1 rg');
    });

    it('handles fractional values', () => {
      const op = setFillingRgbColor(0.25, 0.5, 0.75);
      expect(op.toString()).toBe('0.25 0.5 0.75 rg');
    });
  });

  // ===================== setFillingCmykColor() =====================
  describe('setFillingCmykColor()', () => {
    it('returns operator with name "k"', () => {
      const op = setFillingCmykColor(1, 0, 0, 0);
      expect(op.toString()).toBe('1 0 0 0 k');
    });

    it('handles all zeros', () => {
      const op = setFillingCmykColor(0, 0, 0, 0);
      expect(op.toString()).toBe('0 0 0 0 k');
    });

    it('handles all ones', () => {
      const op = setFillingCmykColor(1, 1, 1, 1);
      expect(op.toString()).toBe('1 1 1 1 k');
    });

    it('handles mixed values', () => {
      const op = setFillingCmykColor(0.1, 0.2, 0.3, 0.4);
      expect(op.toString()).toBe('0.1 0.2 0.3 0.4 k');
    });
  });

  // ===================== setStrokingGrayscaleColor() =====================
  describe('setStrokingGrayscaleColor()', () => {
    it('returns operator with name "G"', () => {
      const op = setStrokingGrayscaleColor(0.5);
      expect(op.toString()).toBe('0.5 G');
    });

    it('handles 0', () => {
      const op = setStrokingGrayscaleColor(0);
      expect(op.toString()).toBe('0 G');
    });

    it('handles 1', () => {
      const op = setStrokingGrayscaleColor(1);
      expect(op.toString()).toBe('1 G');
    });
  });

  // ===================== setStrokingRgbColor() =====================
  describe('setStrokingRgbColor()', () => {
    it('returns operator with name "RG"', () => {
      const op = setStrokingRgbColor(1, 0, 0);
      expect(op.toString()).toBe('1 0 0 RG');
    });

    it('handles all zeros', () => {
      const op = setStrokingRgbColor(0, 0, 0);
      expect(op.toString()).toBe('0 0 0 RG');
    });

    it('handles all ones', () => {
      const op = setStrokingRgbColor(1, 1, 1);
      expect(op.toString()).toBe('1 1 1 RG');
    });

    it('handles fractional values', () => {
      const op = setStrokingRgbColor(0.25, 0.5, 0.75);
      expect(op.toString()).toBe('0.25 0.5 0.75 RG');
    });
  });

  // ===================== setStrokingCmykColor() =====================
  describe('setStrokingCmykColor()', () => {
    it('returns operator with name "K"', () => {
      const op = setStrokingCmykColor(1, 0, 0, 0);
      expect(op.toString()).toBe('1 0 0 0 K');
    });

    it('handles all zeros', () => {
      const op = setStrokingCmykColor(0, 0, 0, 0);
      expect(op.toString()).toBe('0 0 0 0 K');
    });

    it('handles all ones', () => {
      const op = setStrokingCmykColor(1, 1, 1, 1);
      expect(op.toString()).toBe('1 1 1 1 K');
    });

    it('handles mixed values', () => {
      const op = setStrokingCmykColor(0.1, 0.2, 0.3, 0.4);
      expect(op.toString()).toBe('0.1 0.2 0.3 0.4 K');
    });
  });
});
