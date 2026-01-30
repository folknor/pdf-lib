import ArabicShaper from './ArabicShaper.js';
import DefaultShaper from './DefaultShaper.js';
import HangulShaper from './HangulShaper.js';
import IndicShaper from './IndicShaper.js';
import UniversalShaper from './UniversalShaper.js';
type ShaperClass = typeof DefaultShaper | typeof ArabicShaper | typeof HangulShaper | typeof IndicShaper | typeof UniversalShaper;
export declare function choose(script: string | string[]): ShaperClass;
export {};
//# sourceMappingURL=index.d.ts.map