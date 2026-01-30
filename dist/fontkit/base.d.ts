import { DecodeStream } from '../vendors/restructure/index.js';
export declare const logErrors: boolean;
export interface FontFormat {
    new (stream: DecodeStream): any;
    probe(buffer: Uint8Array): boolean;
}
export declare function registerFormat(format: FontFormat): void;
export declare function create(buffer: Uint8Array, postscriptName?: string): any;
export declare let defaultLanguage: string;
export declare function setDefaultLanguage(lang?: string): void;
//# sourceMappingURL=base.d.ts.map