import Subset from './Subset.js';
export default class CFFSubset extends Subset {
    cff: any;
    charstrings: Uint8Array[];
    gsubrs: Uint8Array[];
    strings?: string[];
    constructor(font: any);
    subsetCharstrings(): void;
    subsetSubrs(subrs: any[], used: Record<number, boolean>): Uint8Array[];
    subsetFontdict(topDict: any): void;
    createCIDFontdict(topDict: any): any;
    addString(string: string | null | undefined): number | null;
    encode(): Uint8Array;
}
//# sourceMappingURL=CFFSubset.d.ts.map