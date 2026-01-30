export interface CFFIndexEntry {
    offset: number;
    length: number;
}
export default class CFFIndex {
    type: any;
    constructor(type?: any);
    getCFFVersion(ctx: any): number;
    decode(stream: any, parent: any): any[];
    size(arr: any[], parent: any): number;
    encode(stream: any, arr: any[], parent: any): void;
}
//# sourceMappingURL=CFFIndex.d.ts.map