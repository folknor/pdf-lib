import { DecodeStream } from '../vendors/restructure/index.js';
export const logErrors = false;
const formats = [];
export function registerFormat(format) {
    formats.push(format);
}
export function create(buffer, postscriptName) {
    for (let i = 0; i < formats.length; i++) {
        const format = formats[i];
        if (format.probe(buffer)) {
            const font = new format(new DecodeStream(buffer));
            if (postscriptName) {
                return font.getFont(postscriptName);
            }
            return font;
        }
    }
    throw new Error('Unknown font format');
}
export let defaultLanguage = 'en';
export function setDefaultLanguage(lang = 'en') {
    defaultLanguage = lang;
}
//# sourceMappingURL=base.js.map