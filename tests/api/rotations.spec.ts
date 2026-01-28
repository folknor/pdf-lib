import {
  degrees,
  radians,
  toRadians,
  toDegrees,
  reduceRotation,
  adjustDimsForRotation,
  rotateRectangle,
  RotationTypes,
  degreesToRadians,
  radiansToDegrees,
} from '../../src/api/rotations';

describe('rotations', () => {
  // ===================== degrees() =====================
  describe('degrees()', () => {
    it('returns a Rotation object with type "degrees"', () => {
      const rot = degrees(90);
      expect(rot.type).toBe(RotationTypes.Degrees);
      expect(rot.type).toBe('degrees');
      expect(rot.angle).toBe(90);
    });

    it('handles zero', () => {
      const rot = degrees(0);
      expect(rot).toEqual({ type: RotationTypes.Degrees, angle: 0 });
    });

    it('handles negative values', () => {
      const rot = degrees(-45);
      expect(rot).toEqual({ type: RotationTypes.Degrees, angle: -45 });
    });

    it('handles fractional values', () => {
      const rot = degrees(33.33);
      expect(rot).toEqual({ type: RotationTypes.Degrees, angle: 33.33 });
    });

    it('handles 360 degrees', () => {
      const rot = degrees(360);
      expect(rot).toEqual({ type: RotationTypes.Degrees, angle: 360 });
    });
  });

  // ===================== radians() =====================
  describe('radians()', () => {
    it('returns a Rotation object with type "radians"', () => {
      const rot = radians(Math.PI);
      expect(rot.type).toBe(RotationTypes.Radians);
      expect(rot.type).toBe('radians');
      expect(rot.angle).toBe(Math.PI);
    });

    it('handles zero', () => {
      const rot = radians(0);
      expect(rot).toEqual({ type: RotationTypes.Radians, angle: 0 });
    });

    it('handles negative values', () => {
      const rot = radians(-Math.PI / 4);
      expect(rot).toEqual({
        type: RotationTypes.Radians,
        angle: -Math.PI / 4,
      });
    });

    it('handles full rotation (2*PI)', () => {
      const rot = radians(2 * Math.PI);
      expect(rot).toEqual({
        type: RotationTypes.Radians,
        angle: 2 * Math.PI,
      });
    });
  });

  // ===================== degreesToRadians() =====================
  describe('degreesToRadians()', () => {
    it('converts 0 degrees to 0 radians', () => {
      expect(degreesToRadians(0)).toBe(0);
    });

    it('converts 90 degrees to PI/2 radians', () => {
      expect(degreesToRadians(90)).toBeCloseTo(Math.PI / 2);
    });

    it('converts 180 degrees to PI radians', () => {
      expect(degreesToRadians(180)).toBeCloseTo(Math.PI);
    });

    it('converts 270 degrees to 3*PI/2 radians', () => {
      expect(degreesToRadians(270)).toBeCloseTo((3 * Math.PI) / 2);
    });

    it('converts 360 degrees to 2*PI radians', () => {
      expect(degreesToRadians(360)).toBeCloseTo(2 * Math.PI);
    });

    it('converts 45 degrees to PI/4 radians', () => {
      expect(degreesToRadians(45)).toBeCloseTo(Math.PI / 4);
    });

    it('converts negative degrees', () => {
      expect(degreesToRadians(-90)).toBeCloseTo(-Math.PI / 2);
    });
  });

  // ===================== radiansToDegrees() =====================
  describe('radiansToDegrees()', () => {
    it('converts 0 radians to 0 degrees', () => {
      expect(radiansToDegrees(0)).toBe(0);
    });

    it('converts PI/2 radians to 90 degrees', () => {
      expect(radiansToDegrees(Math.PI / 2)).toBeCloseTo(90);
    });

    it('converts PI radians to 180 degrees', () => {
      expect(radiansToDegrees(Math.PI)).toBeCloseTo(180);
    });

    it('converts 3*PI/2 radians to 270 degrees', () => {
      expect(radiansToDegrees((3 * Math.PI) / 2)).toBeCloseTo(270);
    });

    it('converts 2*PI radians to 360 degrees', () => {
      expect(radiansToDegrees(2 * Math.PI)).toBeCloseTo(360);
    });

    it('converts negative radians', () => {
      expect(radiansToDegrees(-Math.PI)).toBeCloseTo(-180);
    });
  });

  // ===================== toRadians() =====================
  describe('toRadians()', () => {
    it('returns the angle directly for a Radians rotation', () => {
      const rot = radians(Math.PI / 3);
      expect(toRadians(rot)).toBe(Math.PI / 3);
    });

    it('converts a Degrees rotation to radians', () => {
      expect(toRadians(degrees(90))).toBeCloseTo(Math.PI / 2);
    });

    it('converts 0 degrees to 0 radians', () => {
      expect(toRadians(degrees(0))).toBe(0);
    });

    it('converts 180 degrees to PI radians', () => {
      expect(toRadians(degrees(180))).toBeCloseTo(Math.PI);
    });

    it('converts 360 degrees to 2*PI radians', () => {
      expect(toRadians(degrees(360))).toBeCloseTo(2 * Math.PI);
    });

    it('passes through radians unchanged', () => {
      const angle = 1.2345;
      expect(toRadians(radians(angle))).toBe(angle);
    });
  });

  // ===================== toDegrees() =====================
  describe('toDegrees()', () => {
    it('returns the angle directly for a Degrees rotation', () => {
      const rot = degrees(45);
      expect(toDegrees(rot)).toBe(45);
    });

    it('converts a Radians rotation to degrees', () => {
      expect(toDegrees(radians(Math.PI / 2))).toBeCloseTo(90);
    });

    it('converts 0 radians to 0 degrees', () => {
      expect(toDegrees(radians(0))).toBe(0);
    });

    it('converts PI radians to 180 degrees', () => {
      expect(toDegrees(radians(Math.PI))).toBeCloseTo(180);
    });

    it('converts 2*PI radians to 360 degrees', () => {
      expect(toDegrees(radians(2 * Math.PI))).toBeCloseTo(360);
    });

    it('passes through degrees unchanged', () => {
      expect(toDegrees(degrees(123.456))).toBe(123.456);
    });
  });

  // ===================== reduceRotation() =====================
  describe('reduceRotation()', () => {
    it('reduces 0 to 0', () => {
      expect(reduceRotation(0)).toBe(0);
    });

    it('reduces 90 to 90', () => {
      expect(reduceRotation(90)).toBe(90);
    });

    it('reduces 180 to 180', () => {
      expect(reduceRotation(180)).toBe(180);
    });

    it('reduces 270 to 270', () => {
      expect(reduceRotation(270)).toBe(270);
    });

    it('reduces 360 to 0', () => {
      expect(reduceRotation(360)).toBe(0);
    });

    it('reduces 450 to 90', () => {
      expect(reduceRotation(450)).toBe(90);
    });

    it('reduces 540 to 180', () => {
      expect(reduceRotation(540)).toBe(180);
    });

    it('reduces 630 to 270', () => {
      expect(reduceRotation(630)).toBe(270);
    });

    it('reduces 720 to 0', () => {
      expect(reduceRotation(720)).toBe(0);
    });

    it('returns 0 for non-multiple-of-90 angles (45)', () => {
      expect(reduceRotation(45)).toBe(0);
    });

    it('returns 0 for non-multiple-of-90 angles (135)', () => {
      expect(reduceRotation(135)).toBe(0);
    });

    it('returns 0 for non-multiple-of-90 angles (60)', () => {
      expect(reduceRotation(60)).toBe(0);
    });

    it('handles negative multiples of 90: -90 maps to 270', () => {
      // (-90 / 90) % 4 = -1 which is not 0,1,2,3 => falls through to 0
      expect(reduceRotation(-90)).toBe(0);
    });

    it('handles negative -180', () => {
      // (-180 / 90) % 4 = -2 which is not 0,1,2,3 => falls through to 0
      expect(reduceRotation(-180)).toBe(0);
    });

    it('defaults to 0 when called with no argument', () => {
      expect(reduceRotation()).toBe(0);
    });

    it('defaults to 0 when called with undefined', () => {
      expect(reduceRotation(undefined)).toBe(0);
    });
  });

  // ===================== adjustDimsForRotation() =====================
  describe('adjustDimsForRotation()', () => {
    const dims = { width: 100, height: 50 };

    it('does not swap at 0 degrees', () => {
      expect(adjustDimsForRotation(dims, 0)).toEqual({
        width: 100,
        height: 50,
      });
    });

    it('swaps width and height at 90 degrees', () => {
      expect(adjustDimsForRotation(dims, 90)).toEqual({
        width: 50,
        height: 100,
      });
    });

    it('does not swap at 180 degrees', () => {
      expect(adjustDimsForRotation(dims, 180)).toEqual({
        width: 100,
        height: 50,
      });
    });

    it('swaps width and height at 270 degrees', () => {
      expect(adjustDimsForRotation(dims, 270)).toEqual({
        width: 50,
        height: 100,
      });
    });

    it('does not swap at 360 degrees (reduces to 0)', () => {
      expect(adjustDimsForRotation(dims, 360)).toEqual({
        width: 100,
        height: 50,
      });
    });

    it('swaps width and height at 450 degrees (reduces to 90)', () => {
      expect(adjustDimsForRotation(dims, 450)).toEqual({
        width: 50,
        height: 100,
      });
    });

    it('does not swap for non-multiples of 90 (reduces to 0)', () => {
      expect(adjustDimsForRotation(dims, 45)).toEqual({
        width: 100,
        height: 50,
      });
    });

    it('defaults to 0 when angle is omitted', () => {
      expect(adjustDimsForRotation(dims)).toEqual({
        width: 100,
        height: 50,
      });
    });

    it('works with square dimensions', () => {
      const squareDims = { width: 100, height: 100 };
      expect(adjustDimsForRotation(squareDims, 90)).toEqual({
        width: 100,
        height: 100,
      });
    });
  });

  // ===================== rotateRectangle() =====================
  describe('rotateRectangle()', () => {
    const rect = { x: 10, y: 20, width: 100, height: 50 };
    const borderWidth = 2;
    // b = borderWidth / 2 = 1

    describe('with rect {x:10, y:20, width:100, height:50} and borderWidth=2', () => {
      it('at 0 degrees: x=x-b, y=y-b, width=w, height=h', () => {
        const result = rotateRectangle(rect, borderWidth, 0);
        // r=0, b=1: x=10-1=9, y=20-1=19, width=100, height=50
        expect(result).toEqual({ x: 9, y: 19, width: 100, height: 50 });
      });

      it('at 90 degrees: x=x-h+b, y=y-b, width=h, height=w', () => {
        const result = rotateRectangle(rect, borderWidth, 90);
        // r=90, b=1: x=10-50+1=-39, y=20-1=19, width=50, height=100
        expect(result).toEqual({ x: -39, y: 19, width: 50, height: 100 });
      });

      it('at 180 degrees: x=x-w+b, y=y-h+b, width=w, height=h', () => {
        const result = rotateRectangle(rect, borderWidth, 180);
        // r=180, b=1: x=10-100+1=-89, y=20-50+1=-29, width=100, height=50
        expect(result).toEqual({ x: -89, y: -29, width: 100, height: 50 });
      });

      it('at 270 degrees: x=x-b, y=y-w+b, width=h, height=w', () => {
        const result = rotateRectangle(rect, borderWidth, 270);
        // r=270, b=1: x=10-1=9, y=20-100+1=-79, width=50, height=100
        expect(result).toEqual({ x: 9, y: -79, width: 50, height: 100 });
      });
    });

    describe('with borderWidth=0', () => {
      it('at 0 degrees: no border offset', () => {
        const result = rotateRectangle(rect, 0, 0);
        // b=0: x=10, y=20, width=100, height=50
        expect(result).toEqual({ x: 10, y: 20, width: 100, height: 50 });
      });

      it('at 90 degrees: no border offset', () => {
        const result = rotateRectangle(rect, 0, 90);
        // b=0: x=10-50=-40, y=20, width=50, height=100
        expect(result).toEqual({ x: -40, y: 20, width: 50, height: 100 });
      });

      it('at 180 degrees: no border offset', () => {
        const result = rotateRectangle(rect, 0, 180);
        // b=0: x=10-100=-90, y=20-50=-30, width=100, height=50
        expect(result).toEqual({ x: -90, y: -30, width: 100, height: 50 });
      });

      it('at 270 degrees: no border offset', () => {
        const result = rotateRectangle(rect, 0, 270);
        // b=0: x=10, y=20-100=-80, width=50, height=100
        expect(result).toEqual({ x: 10, y: -80, width: 50, height: 100 });
      });
    });

    describe('with non-multiple-of-90 angle', () => {
      it('falls through to default (same as 0 degrees)', () => {
        const result = rotateRectangle(rect, borderWidth, 45);
        // Non-multiple of 90 reduces to 0 (fallthrough), b=1
        expect(result).toEqual({ x: 9, y: 19, width: 100, height: 50 });
      });
    });

    describe('default parameters', () => {
      it('defaults borderWidth to 0 and degreeAngle to 0', () => {
        const result = rotateRectangle(rect);
        // borderWidth=0, degreeAngle=0: x=10, y=20, width=100, height=50
        expect(result).toEqual({ x: 10, y: 20, width: 100, height: 50 });
      });

      it('defaults degreeAngle to 0', () => {
        const result = rotateRectangle(rect, 4);
        // borderWidth=4, b=2, degreeAngle=0: x=10-2=8, y=20-2=18
        expect(result).toEqual({ x: 8, y: 18, width: 100, height: 50 });
      });
    });

    describe('with a large borderWidth', () => {
      it('at 0 degrees with borderWidth=10', () => {
        const result = rotateRectangle(rect, 10, 0);
        // b=5: x=10-5=5, y=20-5=15
        expect(result).toEqual({ x: 5, y: 15, width: 100, height: 50 });
      });

      it('at 90 degrees with borderWidth=10', () => {
        const result = rotateRectangle(rect, 10, 90);
        // b=5: x=10-50+5=-35, y=20-5=15, width=50, height=100
        expect(result).toEqual({ x: -35, y: 15, width: 50, height: 100 });
      });
    });

    describe('with zero-size rectangle', () => {
      it('handles a zero-width and zero-height rectangle at 0 degrees', () => {
        const zeroRect = { x: 5, y: 10, width: 0, height: 0 };
        const result = rotateRectangle(zeroRect, 0, 0);
        expect(result).toEqual({ x: 5, y: 10, width: 0, height: 0 });
      });

      it('handles a zero-width and zero-height rectangle at 90 degrees', () => {
        const zeroRect = { x: 5, y: 10, width: 0, height: 0 };
        const result = rotateRectangle(zeroRect, 0, 90);
        expect(result).toEqual({ x: 5, y: 10, width: 0, height: 0 });
      });
    });
  });
});
