import type Arc from '../utils/elements/Arc';
import type Circle from '../utils/elements/Circle';
import type Ellipse from '../utils/elements/Ellipse';
import type Line from '../utils/elements/Line';
import type Plot from '../utils/elements/Plot';
import type Point from '../utils/elements/Point';
import type Rectangle from '../utils/elements/Rectangle';
import type Segment from '../utils/elements/Segment';
export type { TransformationMatrix } from './matrix';

export type Size = {
  width: number;
  height: number;
};

export type Coordinates = {
  x: number;
  y: number;
};

export type GraphicElement =
  | Arc
  | Circle
  | Ellipse
  | Line
  | Plot
  | Point
  | Rectangle
  | Segment;

export type Space = {
  topLeft: Coordinates;
  topRight: Coordinates;
  bottomRight: Coordinates;
  bottomLeft: Coordinates;
};

export type LinkElement = Rectangle | Ellipse;
