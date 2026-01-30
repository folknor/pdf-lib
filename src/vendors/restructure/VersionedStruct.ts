/**
 * Restructure - VersionedStruct type
 * Originally from https://github.com/foliojs/restructure
 * Absorbed and converted to TypeScript for pdf-lib
 */

import type { DecodeStream } from './DecodeStream.js';
import type { EncodeStream } from './EncodeStream.js';
import type { NumberT } from './Number.js';
import { type Fields, Struct } from './Struct.js';

type VersionType = NumberT | string;
type VersionFields = Record<string | number, Fields | VersionedStruct> & {
  header?: Fields;
};

const getPath = (
  object: Record<string, unknown>,
  pathArray: string[],
): unknown =>
  pathArray.reduce<unknown>(
    (prevObj, key) => (prevObj as Record<string, unknown>)?.[key],
    object,
  );

interface VersionedStructContext {
  parent?: unknown;
  _startOffset: number;
  _currentOffset: number;
  _length: number;
  version: unknown;
  [key: string]: unknown;
}

export class VersionedStruct extends Struct {
  type: VersionType;
  versions: VersionFields;
  versionPath?: string[];

  constructor(type: VersionType, versions: VersionFields = {}) {
    super();
    this.type = type;
    this.versions = versions;
    if (typeof type === 'string') {
      this.versionPath = type.split('.');
    }
  }

  override decode(
    stream: DecodeStream,
    parent?: unknown,
    length = 0,
  ): Record<string, unknown> {
    const res = this._setup(stream, parent, length) as VersionedStructContext;

    if (typeof this.type === 'string') {
      res.version = getPath(
        parent as Record<string, unknown>,
        this.versionPath!,
      );
    } else {
      res.version = this.type.decode(stream);
    }

    if (this.versions.header) {
      this._parseFields(stream, res, this.versions.header);
    }

    const fields = this.versions[res.version as string | number];
    if (fields == null) {
      throw new Error(`Unknown version ${res.version}`);
    }

    if (fields instanceof VersionedStruct) {
      return fields.decode(stream, parent);
    }

    this._parseFields(stream, res, fields);

    if (this.process != null) {
      this.process.call(res, stream);
    }
    return res;
  }

  override size(
    val?: Record<string, unknown> | null,
    parent?: unknown,
    includePointers = true,
  ): number {
    if (!val) {
      throw new Error('Not a fixed size');
    }

    if (this.preEncode != null) {
      this.preEncode.call(val);
    }

    const ctx = {
      parent,
      val,
      pointerSize: 0,
    };

    let size = 0;
    if (typeof this.type !== 'string') {
      size += this.type.size();
    }

    if (this.versions.header) {
      for (const key in this.versions.header) {
        const type = this.versions.header[key]!;
        if (typeof type !== 'function' && type.size != null) {
          size += type.size(val[key], ctx);
        }
      }
    }

    const fields = this.versions[val['version'] as string | number];
    if (fields == null) {
      throw new Error(`Unknown version ${val['version']}`);
    }

    if (!(fields instanceof VersionedStruct)) {
      for (const key in fields) {
        const type = fields[key]!;
        if (typeof type !== 'function' && type.size != null) {
          size += type.size(val[key], ctx);
        }
      }
    }

    if (includePointers) {
      size += ctx.pointerSize;
    }

    return size;
  }

  override encode(
    stream: EncodeStream,
    val: Record<string, unknown>,
    parent?: unknown,
  ): void {
    if (this.preEncode != null) {
      this.preEncode.call(val, stream);
    }

    const ctx = {
      pointers: [] as Array<{
        type: { encode: (s: EncodeStream, v: unknown, p: unknown) => void };
        val: unknown;
        parent: unknown;
      }>,
      startOffset: stream.pos,
      parent,
      val,
      pointerOffset: 0,
      pointerSize: 0,
    };

    ctx.pointerOffset = stream.pos + this.size(val, ctx, false);

    if (typeof this.type !== 'string') {
      this.type.encode(stream, val['version'] as number);
    }

    if (this.versions.header) {
      for (const key in this.versions.header) {
        const type = this.versions.header[key]!;
        if (typeof type !== 'function' && type.encode != null) {
          type.encode(stream, val[key], ctx);
        }
      }
    }

    const fields = this.versions[val['version'] as string | number];
    if (!(fields instanceof VersionedStruct)) {
      for (const key in fields as Fields) {
        const type = (fields as Fields)[key]!;
        if (typeof type !== 'function' && type.encode != null) {
          type.encode(stream, val[key], ctx);
        }
      }
    }

    let i = 0;
    while (i < ctx.pointers.length) {
      const ptr = ctx.pointers[i++]!;
      ptr.type.encode(stream, ptr.val, ptr.parent);
    }
  }
}
