import * as r from '../../vendors/restructure/index.js';
import type { ForceLargeValue } from './CFFOperand.js';
export default class CFFPointer extends r.Pointer {
    constructor(type: any, options?: Record<string, any>);
    decode(stream: any, parent: any, operands?: number[]): any;
    encode(stream: any, value: any, ctx: any): Ptr[];
}
declare class Ptr implements ForceLargeValue {
    val: number;
    forceLarge: boolean;
    constructor(val: number);
    valueOf(): number;
}
export {};
//# sourceMappingURL=CFFPointer.d.ts.map