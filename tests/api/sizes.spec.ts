import { describe, expect, it } from 'vitest';

import {
  cmToPoints,
  inchesToPoints,
  mmToPoints,
  PageSizes,
  POINTS_PER_CM,
  POINTS_PER_INCH,
  POINTS_PER_MM,
  pointsToCm,
  pointsToInches,
  pointsToMm,
} from '../../src/api/sizes.js';

describe('PDF units', () => {
  describe('constants', () => {
    it('defines POINTS_PER_INCH as 72', () => {
      expect(POINTS_PER_INCH).toBe(72);
    });

    it('defines POINTS_PER_MM correctly', () => {
      expect(POINTS_PER_MM).toBeCloseTo(72 / 25.4, 10);
    });

    it('defines POINTS_PER_CM correctly', () => {
      expect(POINTS_PER_CM).toBeCloseTo(72 / 2.54, 10);
    });
  });

  describe('inchesToPoints', () => {
    it('converts 1 inch to 72 points', () => {
      expect(inchesToPoints(1)).toBe(72);
    });

    it('converts 8.5 inches (Letter width) to 612 points', () => {
      expect(inchesToPoints(8.5)).toBe(612);
    });

    it('converts 11 inches (Letter height) to 792 points', () => {
      expect(inchesToPoints(11)).toBe(792);
    });

    it('handles fractional inches', () => {
      expect(inchesToPoints(0.5)).toBe(36);
      expect(inchesToPoints(0.25)).toBe(18);
    });

    it('handles zero', () => {
      expect(inchesToPoints(0)).toBe(0);
    });
  });

  describe('pointsToInches', () => {
    it('converts 72 points to 1 inch', () => {
      expect(pointsToInches(72)).toBe(1);
    });

    it('converts 612 points to 8.5 inches', () => {
      expect(pointsToInches(612)).toBe(8.5);
    });

    it('is the inverse of inchesToPoints', () => {
      const inches = 3.75;
      expect(pointsToInches(inchesToPoints(inches))).toBe(inches);
    });
  });

  describe('mmToPoints', () => {
    it('converts 25.4 mm (1 inch) to 72 points', () => {
      expect(mmToPoints(25.4)).toBeCloseTo(72, 10);
    });

    it('converts 210 mm (A4 width) correctly', () => {
      // A4 width is 210mm = 595.28 points
      expect(mmToPoints(210)).toBeCloseTo(595.28, 1);
    });

    it('converts 297 mm (A4 height) correctly', () => {
      // A4 height is 297mm = 841.89 points
      expect(mmToPoints(297)).toBeCloseTo(841.89, 1);
    });

    it('handles zero', () => {
      expect(mmToPoints(0)).toBe(0);
    });
  });

  describe('pointsToMm', () => {
    it('converts 72 points to 25.4 mm', () => {
      expect(pointsToMm(72)).toBeCloseTo(25.4, 10);
    });

    it('is the inverse of mmToPoints', () => {
      const mm = 150;
      expect(pointsToMm(mmToPoints(mm))).toBeCloseTo(mm, 10);
    });
  });

  describe('cmToPoints', () => {
    it('converts 2.54 cm (1 inch) to 72 points', () => {
      expect(cmToPoints(2.54)).toBeCloseTo(72, 10);
    });

    it('converts 21 cm (A4 width) correctly', () => {
      expect(cmToPoints(21)).toBeCloseTo(595.28, 1);
    });

    it('handles zero', () => {
      expect(cmToPoints(0)).toBe(0);
    });
  });

  describe('pointsToCm', () => {
    it('converts 72 points to 2.54 cm', () => {
      expect(pointsToCm(72)).toBeCloseTo(2.54, 10);
    });

    it('is the inverse of cmToPoints', () => {
      const cm = 15;
      expect(pointsToCm(cmToPoints(cm))).toBeCloseTo(cm, 10);
    });
  });
});

describe('PageSizes', () => {
  it('defines Letter as 8.5 x 11 inches', () => {
    expect(PageSizes.Letter).toEqual([612, 792]);
  });

  it('defines A4 correctly', () => {
    expect(PageSizes.A4[0]).toBeCloseTo(595.28, 1);
    expect(PageSizes.A4[1]).toBeCloseTo(841.89, 1);
  });

  it('defines Legal as 8.5 x 14 inches', () => {
    expect(PageSizes.Legal).toEqual([612, 1008]);
  });
});
