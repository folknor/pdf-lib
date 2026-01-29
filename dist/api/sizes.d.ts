/**
 * The number of PDF points per inch. This is the fundamental unit of
 * measurement in PDF documents. All dimensions in pdf-lib (page sizes,
 * coordinates, font sizes, line widths, etc.) are specified in PDF points.
 *
 * 1 inch = 72 points
 * 1 point = 1/72 inch ≈ 0.3528 mm
 */
export declare const POINTS_PER_INCH = 72;
/**
 * The number of PDF points per millimeter.
 * 1 mm ≈ 2.8346 points
 */
export declare const POINTS_PER_MM: number;
/**
 * The number of PDF points per centimeter.
 * 1 cm ≈ 28.346 points
 */
export declare const POINTS_PER_CM: number;
/**
 * Convert inches to PDF points.
 * @param inches The measurement in inches
 * @returns The equivalent measurement in PDF points
 *
 * @example
 * import { inchesToPoints } from 'pdf-lib';
 * const margin = inchesToPoints(0.5); // 36 points
 */
export declare const inchesToPoints: (inches: number) => number;
/**
 * Convert PDF points to inches.
 * @param points The measurement in PDF points
 * @returns The equivalent measurement in inches
 */
export declare const pointsToInches: (points: number) => number;
/**
 * Convert millimeters to PDF points.
 * @param mm The measurement in millimeters
 * @returns The equivalent measurement in PDF points
 *
 * @example
 * import { mmToPoints } from 'pdf-lib';
 * const margin = mmToPoints(10); // ≈ 28.35 points
 */
export declare const mmToPoints: (mm: number) => number;
/**
 * Convert PDF points to millimeters.
 * @param points The measurement in PDF points
 * @returns The equivalent measurement in millimeters
 */
export declare const pointsToMm: (points: number) => number;
/**
 * Convert centimeters to PDF points.
 * @param cm The measurement in centimeters
 * @returns The equivalent measurement in PDF points
 *
 * @example
 * import { cmToPoints } from 'pdf-lib';
 * const margin = cmToPoints(2.5); // ≈ 70.87 points
 */
export declare const cmToPoints: (cm: number) => number;
/**
 * Convert PDF points to centimeters.
 * @param points The measurement in PDF points
 * @returns The equivalent measurement in centimeters
 */
export declare const pointsToCm: (points: number) => number;
/**
 * Standard page sizes in PDF points [width, height].
 *
 * All measurements in pdf-lib use PDF points as the unit.
 * 72 points = 1 inch = 25.4 mm
 *
 * For example, US Letter size (8.5" × 11") is [612, 792] points.
 */
export declare const PageSizes: {
    '4A0': [number, number];
    '2A0': [number, number];
    A0: [number, number];
    A1: [number, number];
    A2: [number, number];
    A3: [number, number];
    A4: [number, number];
    A5: [number, number];
    A6: [number, number];
    A7: [number, number];
    A8: [number, number];
    A9: [number, number];
    A10: [number, number];
    B0: [number, number];
    B1: [number, number];
    B2: [number, number];
    B3: [number, number];
    B4: [number, number];
    B5: [number, number];
    B6: [number, number];
    B7: [number, number];
    B8: [number, number];
    B9: [number, number];
    B10: [number, number];
    C0: [number, number];
    C1: [number, number];
    C2: [number, number];
    C3: [number, number];
    C4: [number, number];
    C5: [number, number];
    C6: [number, number];
    C7: [number, number];
    C8: [number, number];
    C9: [number, number];
    C10: [number, number];
    RA0: [number, number];
    RA1: [number, number];
    RA2: [number, number];
    RA3: [number, number];
    RA4: [number, number];
    SRA0: [number, number];
    SRA1: [number, number];
    SRA2: [number, number];
    SRA3: [number, number];
    SRA4: [number, number];
    Executive: [number, number];
    Folio: [number, number];
    Legal: [number, number];
    Letter: [number, number];
    Tabloid: [number, number];
};
//# sourceMappingURL=sizes.d.ts.map