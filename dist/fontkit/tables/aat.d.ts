import * as r from '../../vendors/restructure/index.js';
declare class UnboundedArrayAccessor {
    type: any;
    stream: any;
    parent: any;
    base: number;
    _items: any[];
    constructor(type: any, stream: any, parent: any);
    getItem(index: number): any;
    inspect(): string;
}
export declare class UnboundedArray extends r.Array {
    constructor(type: any);
    decode(stream: any, parent: any): UnboundedArrayAccessor;
}
export declare const LookupTable: (ValueType?: any) => any;
export declare function StateTable(entryData?: Record<string, any>, lookupType?: any): any;
export declare function StateTable1(entryData?: Record<string, any>, _lookupType?: any): any;
export {};
//# sourceMappingURL=aat.d.ts.map