/**
 * Restructure - Shared types
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */

import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';

// Base type interface for all restructure types
export interface RType<T = unknown> {
  decode(stream: DecodeStream, parent?: unknown): T;
  encode?(stream: EncodeStream, value: T, parent?: unknown): void;
  size(value?: T | null, parent?: unknown): number;
}

// Context passed during struct decoding
export interface DecodeContext {
  parent?: DecodeContext;
  _startOffset: number;
  _currentOffset: number;
  _length: number;
  [key: string]: unknown;
}

// Context passed during struct encoding
export interface EncodeContext {
  parent?: EncodeContext;
  val: Record<string, unknown>;
  pointers: Array<{ type: RType; val: unknown; parent: EncodeContext }>;
  startOffset: number;
  pointerOffset: number;
  pointerSize: number;
}

// Context for size calculation
export interface SizeContext {
  parent?: SizeContext;
  val?: Record<string, unknown>;
  pointerSize: number;
}

// Property descriptor for lazy evaluation
export class PropertyDescriptor implements PropertyDescriptor {
  enumerable = true;
  configurable = true;
  get?: () => unknown;
  value?: unknown;

  constructor(opts: Partial<PropertyDescriptor> = {}) {
    for (const key in opts) {
      (this as Record<string, unknown>)[key] =
        opts[key as keyof PropertyDescriptor];
    }
    // Object.defineProperty doesn't allow both accessor (get/set) and data (value/writable) properties
    // Remove value if get is defined to avoid conflict
    if (this.get !== undefined) {
      delete this.value;
    }
  }
}
