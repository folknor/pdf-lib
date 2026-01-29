import Circle from './Circle.js';
import GraphElement from './GraphElement.js';
import Point from './Point.js';
export default class Arc extends GraphElement {
    O: Point;
    A: Point;
    B: Point;
    /** Last sweep. Used to deduce the angle orientation */
    lastSweep: number;
    constructor(O?: Point, A?: Point, B?: Point, lastSweep?: number);
    center(): Point;
    origin(): Point;
    destination(): Point;
    sweep(): number;
    ray(): number;
    isEqual(element: GraphElement): boolean;
    getCircle(): Circle;
    originVect(): import("../../index.js").Coordinates;
    middle(): Point;
    includes(P: Point): boolean;
    orthoProjection(P: Point): Point;
}
//# sourceMappingURL=Arc.d.ts.map