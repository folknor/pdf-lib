export type CFFDictOp = [number | [number, number], string, any, any];
export default class CFFDict {
    ops: CFFDictOp[];
    fields: Record<number, CFFDictOp>;
    constructor(ops?: CFFDictOp[]);
    decodeOperands(type: any, stream: any, ret: any, operands: any[]): any;
    encodeOperands(type: any, stream: any, ctx: any, operands: any): any[];
    decode(stream: any, parent: any): Record<string, any>;
    size(dict: Record<string, any>, parent: any, includePointers?: boolean): number;
    encode(stream: any, dict: Record<string, any>, parent: any): void;
}
//# sourceMappingURL=CFFDict.d.ts.map