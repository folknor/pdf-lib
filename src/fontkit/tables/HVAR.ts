import * as r from '../../vendors/restructure/index.js';
import { resolveLength } from '../../vendors/restructure/index.js';
import { ItemVariationStore } from './variations.js';

// TODO: add this to restructure
class VariableSizeNumber {
  private _size: any;

  constructor(size: any) {
    this._size = size;
  }

  decode(stream: any, parent: any): number {
    switch (this.size(0, parent)) {
      case 1:
        return stream.readUInt8();
      case 2:
        return stream.readUInt16BE();
      case 3:
        return stream.readUInt24BE();
      case 4:
        return stream.readUInt32BE();
      default:
        return 0;
    }
  }

  size(_val: any, parent: any): number {
    return resolveLength(this._size, null, parent);
  }
}

const MapDataEntry = new r.Struct({
  entry: new VariableSizeNumber(
    (t: any) => ((t.parent.entryFormat & 0x0030) >> 4) + 1,
  ) as any,
  outerIndex: (t: any) =>
    t['entry'] >> ((t['parent'].entryFormat & 0x000f) + 1),
  innerIndex: (t: any) =>
    t['entry'] & ((1 << ((t['parent'].entryFormat & 0x000f) + 1)) - 1),
});

const DeltaSetIndexMap = new r.Struct({
  entryFormat: r.uint16,
  mapCount: r.uint16,
  mapData: new r.Array(MapDataEntry, 'mapCount'),
});

export default new r.Struct({
  majorVersion: r.uint16,
  minorVersion: r.uint16,
  itemVariationStore: new r.Pointer(r.uint32, ItemVariationStore),
  advanceWidthMapping: new r.Pointer(r.uint32, DeltaSetIndexMap),
  LSBMapping: new r.Pointer(r.uint32, DeltaSetIndexMap),
  RSBMapping: new r.Pointer(r.uint32, DeltaSetIndexMap),
});
