/**
 * The number of PDF points per inch. This is the fundamental unit of
 * measurement in PDF documents. All dimensions in pdf-lib (page sizes,
 * coordinates, font sizes, line widths, etc.) are specified in PDF points.
 *
 * 1 inch = 72 points
 * 1 point = 1/72 inch ≈ 0.3528 mm
 */
export const POINTS_PER_INCH = 72;

/**
 * The number of PDF points per millimeter.
 * 1 mm ≈ 2.8346 points
 */
export const POINTS_PER_MM = 72 / 25.4;

/**
 * The number of PDF points per centimeter.
 * 1 cm ≈ 28.346 points
 */
export const POINTS_PER_CM = 72 / 2.54;

/**
 * Convert inches to PDF points.
 * @param inches The measurement in inches
 * @returns The equivalent measurement in PDF points
 *
 * @example
 * import { inchesToPoints } from 'pdf-lib';
 * const margin = inchesToPoints(0.5); // 36 points
 */
export const inchesToPoints = (inches: number): number => inches * 72;

/**
 * Convert PDF points to inches.
 * @param points The measurement in PDF points
 * @returns The equivalent measurement in inches
 */
export const pointsToInches = (points: number): number => points / 72;

/**
 * Convert millimeters to PDF points.
 * @param mm The measurement in millimeters
 * @returns The equivalent measurement in PDF points
 *
 * @example
 * import { mmToPoints } from 'pdf-lib';
 * const margin = mmToPoints(10); // ≈ 28.35 points
 */
export const mmToPoints = (mm: number): number => mm * POINTS_PER_MM;

/**
 * Convert PDF points to millimeters.
 * @param points The measurement in PDF points
 * @returns The equivalent measurement in millimeters
 */
export const pointsToMm = (points: number): number => points / POINTS_PER_MM;

/**
 * Convert centimeters to PDF points.
 * @param cm The measurement in centimeters
 * @returns The equivalent measurement in PDF points
 *
 * @example
 * import { cmToPoints } from 'pdf-lib';
 * const margin = cmToPoints(2.5); // ≈ 70.87 points
 */
export const cmToPoints = (cm: number): number => cm * POINTS_PER_CM;

/**
 * Convert PDF points to centimeters.
 * @param points The measurement in PDF points
 * @returns The equivalent measurement in centimeters
 */
export const pointsToCm = (points: number): number => points / POINTS_PER_CM;

/**
 * Standard page sizes in PDF points [width, height].
 *
 * All measurements in pdf-lib use PDF points as the unit.
 * 72 points = 1 inch = 25.4 mm
 *
 * For example, US Letter size (8.5" × 11") is [612, 792] points.
 */
export const PageSizes = {
  '4A0': [4767.87, 6740.79] as [number, number],
  '2A0': [3370.39, 4767.87] as [number, number],
  A0: [2383.94, 3370.39] as [number, number],
  A1: [1683.78, 2383.94] as [number, number],
  A2: [1190.55, 1683.78] as [number, number],
  A3: [841.89, 1190.55] as [number, number],
  A4: [595.28, 841.89] as [number, number],
  A5: [419.53, 595.28] as [number, number],
  A6: [297.64, 419.53] as [number, number],
  A7: [209.76, 297.64] as [number, number],
  A8: [147.4, 209.76] as [number, number],
  A9: [104.88, 147.4] as [number, number],
  A10: [73.7, 104.88] as [number, number],
  B0: [2834.65, 4008.19] as [number, number],
  B1: [2004.09, 2834.65] as [number, number],
  B2: [1417.32, 2004.09] as [number, number],
  B3: [1000.63, 1417.32] as [number, number],
  B4: [708.66, 1000.63] as [number, number],
  B5: [498.9, 708.66] as [number, number],
  B6: [354.33, 498.9] as [number, number],
  B7: [249.45, 354.33] as [number, number],
  B8: [175.75, 249.45] as [number, number],
  B9: [124.72, 175.75] as [number, number],
  B10: [87.87, 124.72] as [number, number],
  C0: [2599.37, 3676.54] as [number, number],
  C1: [1836.85, 2599.37] as [number, number],
  C2: [1298.27, 1836.85] as [number, number],
  C3: [918.43, 1298.27] as [number, number],
  C4: [649.13, 918.43] as [number, number],
  C5: [459.21, 649.13] as [number, number],
  C6: [323.15, 459.21] as [number, number],
  C7: [229.61, 323.15] as [number, number],
  C8: [161.57, 229.61] as [number, number],
  C9: [113.39, 161.57] as [number, number],
  C10: [79.37, 113.39] as [number, number],
  RA0: [2437.8, 3458.27] as [number, number],
  RA1: [1729.13, 2437.8] as [number, number],
  RA2: [1218.9, 1729.13] as [number, number],
  RA3: [864.57, 1218.9] as [number, number],
  RA4: [609.45, 864.57] as [number, number],
  SRA0: [2551.18, 3628.35] as [number, number],
  SRA1: [1814.17, 2551.18] as [number, number],
  SRA2: [1275.59, 1814.17] as [number, number],
  SRA3: [907.09, 1275.59] as [number, number],
  SRA4: [637.8, 907.09] as [number, number],
  Executive: [521.86, 756.0] as [number, number],
  Folio: [612.0, 936.0] as [number, number],
  Legal: [612.0, 1008.0] as [number, number],
  Letter: [612.0, 792.0] as [number, number],
  Tabloid: [792.0, 1224.0] as [number, number],
};
