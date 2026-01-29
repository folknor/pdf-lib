import type Arc from '../utils/elements/Arc.js';
import type Circle from '../utils/elements/Circle.js';
import type Ellipse from '../utils/elements/Ellipse.js';
import type Line from '../utils/elements/Line.js';
import type Plot from '../utils/elements/Plot.js';
import type Point from '../utils/elements/Point.js';
import type Rectangle from '../utils/elements/Rectangle.js';
import type Segment from '../utils/elements/Segment.js';
export type { TransformationMatrix } from './matrix.js';
export type Size = {
    width: number;
    height: number;
};
export type Coordinates = {
    x: number;
    y: number;
};
export type GraphicElement = Arc | Circle | Ellipse | Line | Plot | Point | Rectangle | Segment;
export type Space = {
    topLeft: Coordinates;
    topRight: Coordinates;
    bottomRight: Coordinates;
    bottomLeft: Coordinates;
};
export type LinkElement = Rectangle | Ellipse;
//# sourceMappingURL=index.d.ts.map