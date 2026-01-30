/**
 * Restructure - Optional type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */

import { Base } from './Base.js';
import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';

type ConditionType = boolean | ((this: unknown, parent: unknown) => boolean);

export class Optional<T = unknown> extends Base<T | undefined> {
  type: Base<T>;
  condition: ConditionType;

  constructor(type: Base<T>, condition: ConditionType = true) {
    super();
    this.type = type;
    this.condition = condition;
  }

  decode(stream: DecodeStream, parent?: unknown): T | undefined {
    let condition = this.condition;
    if (typeof condition === 'function') {
      condition = condition.call(parent, parent);
    }

    if (condition) {
      return this.type.decode(stream, parent);
    }

    return;
  }

  size(val?: T | null, parent?: unknown): number {
    let condition = this.condition;
    if (typeof condition === 'function') {
      condition = condition.call(parent, parent);
    }

    if (condition) {
      return this.type.size(val, parent);
    } else {
      return 0;
    }
  }

  encode(stream: EncodeStream, val: T | undefined, parent?: unknown): void {
    let condition = this.condition;
    if (typeof condition === 'function') {
      condition = condition.call(parent, parent);
    }

    if (condition && val !== undefined) {
      this.type.encode(stream, val, parent);
    }
  }
}
