/**
 * Restructure - Bitfield type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */

import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import type { NumberT } from './Number.js';

export class Bitfield extends Base<Record<string, boolean>> {
  type: NumberT;
  flags: (string | null)[];

  constructor(type: NumberT, flags: (string | null)[] = []) {
    super();
    this.type = type;
    this.flags = flags;
  }

  decode(stream: DecodeStream): Record<string, boolean> {
    const val = this.type.decode(stream);

    const res: Record<string, boolean> = {};
    for (let i = 0; i < this.flags.length; i++) {
      const flag = this.flags[i];
      if (flag != null) {
        res[flag] = !!(val & (1 << i));
      }
    }

    return res;
  }

  size(): number {
    return this.type.size();
  }

  encode(stream: EncodeStream, keys: Record<string, boolean>): void {
    let val = 0;
    for (let i = 0; i < this.flags.length; i++) {
      const flag = this.flags[i];
      if (flag != null) {
        if (keys[flag]) {
          val |= 1 << i;
        }
      }
    }

    this.type.encode(stream, val);
  }
}
