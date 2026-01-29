import GraphElement from './GraphElement.js';
import Line from './Line.js';
import Point from './Point.js';
export default class Segment extends GraphElement {
    static type: string;
    A: Point;
    B: Point;
    constructor(A?: Point, B?: Point);
    origin(): Point;
    destination(): Point;
    dirVect(): import("../../index.js").Coordinates;
    length(): number;
    isEqual(element: GraphElement): boolean;
    /** Returns an equivalent line object */
    getLine(): Line;
    includes(P: Point): boolean;
    middle(): Point;
    orthoProjection(P: Point): Point;
}
//# sourceMappingURL=Segment.d.ts.map