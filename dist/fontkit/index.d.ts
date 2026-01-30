import { create, registerFormat, setDefaultLanguage } from './base.js';
export * from './base.js';
interface Fontkit {
    create: typeof create;
    registerFormat: typeof registerFormat;
    defaultLanguage: string;
    setDefaultLanguage: typeof setDefaultLanguage;
    logErrors: boolean;
}
declare const fontkit: Fontkit;
export default fontkit;
//# sourceMappingURL=index.d.ts.map