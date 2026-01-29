import type { Size } from '../../types/index.js';
import GraphElement from './GraphElement.js';
import Point from './Point.js';
import Segment from './Segment.js';
export default class Ellipse extends GraphElement {
    A: Point;
    B: Point;
    C: Point;
    constructor(A?: Point, B?: Point, C?: Point);
    center(): Point;
    axis(): Segment;
    a(): number;
    b(): number;
    rotation(): number;
    getSize(): Size;
    isEqual(element: GraphElement): boolean;
    includes(P: Point): boolean;
    orthoProjection(P: Point): Point;
    polarRay(teta: number): number;
}
//# sourceMappingURL=Ellipse.d.ts.map