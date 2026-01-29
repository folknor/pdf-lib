import type { Coordinates } from '../../types/index.js';
import GraphElement from './GraphElement.js';
import Point from './Point.js';
export default class Plot extends GraphElement {
    points: Coordinates[];
    constructor(points?: Coordinates[]);
    getPoints(): Coordinates[];
    translate(translationVector: Coordinates): void;
    isEqual(element: GraphElement): boolean;
    orthoProjection(P: Point): Point;
}
//# sourceMappingURL=Plot.d.ts.map