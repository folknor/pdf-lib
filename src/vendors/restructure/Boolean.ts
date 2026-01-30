/**
 * Restructure - Boolean type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */

import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import type { NumberT } from './Number.js';

export class BooleanT extends Base<boolean> {
  type: NumberT;

  constructor(type: NumberT) {
    super();
    this.type = type;
  }

  decode(stream: DecodeStream, _parent?: unknown): boolean {
    return Boolean(this.type.decode(stream));
  }

  size(_val?: boolean | null | undefined, _parent?: unknown): number {
    return this.type.size();
  }

  encode(stream: EncodeStream, val: boolean, _parent?: unknown): void {
    this.type.encode(stream, Number(val));
  }
}

export { BooleanT as Boolean };
