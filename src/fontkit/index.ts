import {
  create,
  defaultLanguage,
  type FontFormat,
  logErrors,
  registerFormat,
  setDefaultLanguage,
} from './base.js';
import DFont from './DFont.js';
import TrueTypeCollection from './TrueTypeCollection.js';
import TTFFont from './TTFFont.js';
import WOFF2Font from './WOFF2Font.js';
import WOFFFont from './WOFFFont.js';

// Register font formats
registerFormat(TTFFont as unknown as FontFormat);
registerFormat(WOFFFont as unknown as FontFormat);
registerFormat(WOFF2Font as unknown as FontFormat);
registerFormat(TrueTypeCollection as unknown as FontFormat);
registerFormat(DFont as unknown as FontFormat);

// Named exports
export * from './base.js';

// Default export for compatibility with @pdf-lib/fontkit API
interface Fontkit {
  create: typeof create;
  registerFormat: typeof registerFormat;
  defaultLanguage: string;
  setDefaultLanguage: typeof setDefaultLanguage;
  logErrors: boolean;
}

const fontkit: Fontkit = {
  create,
  registerFormat,
  defaultLanguage,
  setDefaultLanguage,
  logErrors,
};
export default fontkit;
