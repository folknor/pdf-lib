import { create, defaultLanguage, logErrors, registerFormat, setDefaultLanguage, } from './base.js';
import DFont from './DFont.js';
import TrueTypeCollection from './TrueTypeCollection.js';
import TTFFont from './TTFFont.js';
import WOFF2Font from './WOFF2Font.js';
import WOFFFont from './WOFFFont.js';
// Register font formats
registerFormat(TTFFont);
registerFormat(WOFFFont);
registerFormat(WOFF2Font);
registerFormat(TrueTypeCollection);
registerFormat(DFont);
// Named exports
export * from './base.js';
const fontkit = {
    create,
    registerFormat,
    defaultLanguage,
    setDefaultLanguage,
    logErrors,
};
export default fontkit;
//# sourceMappingURL=index.js.map