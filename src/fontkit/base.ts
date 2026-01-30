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
        return font.getFont(postscriptName);
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
