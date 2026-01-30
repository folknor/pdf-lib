/**
 * Represents a glyph bounding box
 */
export default class BBox {
  /**
   * The minimum X position in the bounding box
   */
  minX: number;

  /**
   * The minimum Y position in the bounding box
   */
  minY: number;

  /**
   * The maxmimum X position in the bounding box
   */
  maxX: number;

  /**
   * The maxmimum Y position in the bounding box
   */
  maxY: number;

  constructor(
    minX: number = Infinity,
    minY: number = Infinity,
    maxX: number = -Infinity,
    maxY: number = -Infinity,
  ) {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
  }

  /**
   * The width of the bounding box
   * @type {number}
   */
  get width(): number {
    return this.maxX - this.minX;
  }

  /**
   * The height of the bounding box
   * @type {number}
   */
  get height(): number {
    return this.maxY - this.minY;
  }

  addPoint(x: number, y: number): void {
    if (Math.abs(x) !== Infinity) {
      if (x < this.minX) {
        this.minX = x;
      }

      if (x > this.maxX) {
        this.maxX = x;
      }
    }

    if (Math.abs(y) !== Infinity) {
      if (y < this.minY) {
        this.minY = y;
      }

      if (y > this.maxY) {
        this.maxY = y;
      }
    }
  }

  copy(): BBox {
    return new BBox(this.minX, this.minY, this.maxX, this.maxY);
  }
}
