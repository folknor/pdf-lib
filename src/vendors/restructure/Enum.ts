/**
 * Restructure - Enum type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */

import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import type { NumberT } from './Number.js';

export class Enum<T extends string = string> extends Base<T | number> {
  type: NumberT;
  options: T[];

  constructor(type: NumberT, options: T[] = []) {
    super();
    this.type = type;
    this.options = options;
  }

  decode(stream: DecodeStream): T | number {
    const index = this.type.decode(stream);
    return this.options[index] ?? index;
  }

  size(): number {
    return this.type.size();
  }

  encode(stream: EncodeStream, val: T | number): void {
    const index = this.options.indexOf(val as T);
    if (index === -1) {
      throw new Error(`Unknown option in enum: ${val}`);
    }

    this.type.encode(stream, index);
  }
}
