import { DecodeStream } from '../vendors/restructure/index.js';

export const logErrors: boolean = false;

export interface FontFormat {
  new (stream: DecodeStream): any;
  probe(buffer: Uint8Array): boolean;
}

const formats: FontFormat[] = [];

export function registerFormat(format: FontFormat): void {
  formats.push(format);
}

export function create(buffer: Uint8Array, postscriptName?: string): any {
  for (let i = 0; i < formats.length; i++) {
    const format = formats[i]!;
    if (format.probe(buffer)) {
      const font = new format(new DecodeStream(buffer));
      if (postscriptName) {
        // Collections (TTC, DFont): select the face by PostScript name.
        if ('fonts' in font) return font.getFont(postscriptName);
        // Variable fonts: select a named instance if one matches.
        if (
          font.directory?.tables?.fvar &&
          Object.prototype.hasOwnProperty.call(
            font.namedVariations ?? {},
            postscriptName,
          )
        ) {
          return font.getFont(postscriptName);
        }
        // Single, non-variable font: the name is ignored (as upstream
        // fontkit documents) rather than throwing.
      }

      return font;
    }
  }

  throw new Error('Unknown font format');
}

export let defaultLanguage: string = 'en';
export function setDefaultLanguage(lang: string = 'en'): void {
  defaultLanguage = lang;
}
