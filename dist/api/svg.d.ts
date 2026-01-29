import { type HTMLElement } from 'node-html-better-parser';
import type { Space } from '../types/index.js';
import { type TransformationMatrix } from '../types/matrix.js';
import { type Color } from './colors.js';
import { FillRule, LineCapStyle, LineJoinStyle } from './operators.js';
import type PDFPage from './PDFPage.js';
import { BlendMode, type PDFPageDrawSVGElementOptions } from './PDFPageOptions.js';
import PDFSvg from './PDFSvg.js';
import { type Degrees } from './rotations.js';
interface Position {
    x: number;
    y: number;
}
interface Size {
    width: number;
    height: number;
}
type Box = Position & Size;
type InheritedAttributes = {
    width: number;
    height: number;
    fill: Color | undefined;
    fillOpacity: number | undefined;
    stroke: Color | undefined;
    strokeWidth: number | undefined;
    strokeOpacity: number | undefined;
    strokeLineCap: LineCapStyle | undefined;
    fillRule: FillRule | undefined;
    strokeLineJoin: LineJoinStyle | undefined;
    fontFamily: string | undefined;
    fontStyle: string | undefined;
    fontWeight: string | undefined;
    fontSize: number | undefined;
    rotation: Degrees | undefined;
    viewBox: Box;
    blendMode: BlendMode | undefined;
};
type SVGAttributes = {
    rotate?: Degrees;
    scale?: number;
    skewX?: Degrees;
    skewY?: Degrees;
    width: number | undefined;
    height: number | undefined;
    x: number | undefined;
    y: number | undefined;
    cx: number | undefined;
    cy: number | undefined;
    r?: number;
    rx: number | undefined;
    ry: number | undefined;
    x1: number | undefined;
    y1: number | undefined;
    x2: number | undefined;
    y2: number | undefined;
    d?: string;
    src: string | undefined;
    textAnchor: string | undefined;
    preserveAspectRatio: string | undefined;
    strokeWidth?: number;
    dominantBaseline: 'auto' | 'text-bottom' | 'alphabetic' | 'ideographic' | 'middle' | 'central' | 'mathematical' | 'hanging' | 'text-top' | 'use-script' | 'no-change' | 'reset-size' | 'text-after-edge' | 'text-before-edge' | undefined;
    points?: string;
};
type TransformAttributes = {
    matrix: TransformationMatrix;
    clipSpaces: Space[];
};
export type SVGElement = HTMLElement & {
    svgAttributes: InheritedAttributes & SVGAttributes & TransformAttributes;
};
export declare const combineMatrix: ([a, b, c, d, e, f]: TransformationMatrix, [a2, b2, c2, d2, e2, f2]: TransformationMatrix) => TransformationMatrix;
type TransformationName = 'scale' | 'scaleX' | 'scaleY' | 'translate' | 'translateX' | 'translateY' | 'rotate' | 'skewX' | 'skewY' | 'matrix';
export declare const transformationToMatrix: (name: TransformationName, args: number[]) => TransformationMatrix;
export declare const drawSvg: (page: PDFPage, svg: PDFSvg | string, options: PDFPageDrawSVGElementOptions) => void;
export {};
//# sourceMappingURL=svg.d.ts.map