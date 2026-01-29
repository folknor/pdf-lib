import type { Coordinates, GraphicElement } from '../types/index.js';
import Circle from './elements/Circle.js';
import Line from './elements/Line.js';
export declare const intersections: (A: GraphicElement, B: GraphicElement) => Coordinates[];
export declare const intersection: (A: GraphicElement, B: GraphicElement) => Coordinates | undefined;
export declare const intersectionLine: (A: Line, B: Line) => Coordinates[];
export declare const intersectionCircleLine: (A: Circle, B: Line) => Coordinates[];
export declare const intersectionCircle: (A: Circle, B: Circle) => Coordinates[];
export declare const getIntersections: (elements: GraphicElement[]) => Coordinates[];
//# sourceMappingURL=intersections.d.ts.map