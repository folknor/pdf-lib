/**
 * Restructure - Reserved type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */

import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import type { NumberT } from './Number.js';
import * as utils from './utils.js';

type CountType = number | string | ((parent: unknown) => number);

export class Reserved extends Base<undefined> {
  type: NumberT;
  count: CountType;

  constructor(type: NumberT, count: CountType = 1) {
    super();
    this.type = type;
    this.count = count;
  }

  decode(stream: DecodeStream, parent?: unknown): undefined {
    stream.pos += this.size(null, parent);
    return;
  }

  size(_data?: unknown, parent?: unknown): number {
    const count = utils.resolveLength(
      this.count,
      null,
      parent as Record<string, unknown> | null,
    );
    return this.type.size() * count;
  }

  encode(stream: EncodeStream, _val: undefined, parent?: unknown): void {
    stream.fill(0, this.size(null, parent));
  }
}
