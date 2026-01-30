import * as r from '../../vendors/restructure/index.js';

interface LocaTable {
  version: number;
  offsets: number[];
  _processed?: boolean;
}

const loca = new r.VersionedStruct('head.indexToLocFormat', {
  0: {
    offsets: new r.Array(r.uint16),
  },
  1: {
    offsets: new r.Array(r.uint32),
  },
});

loca.process = function (this: Record<string, unknown>) {
  const self = this as unknown as LocaTable;
  if (self.version === 0 && !self._processed) {
    for (let i = 0; i < self.offsets.length; i++) {
      self.offsets[i] = self.offsets[i]! << 1;
    }
    self._processed = true;
  }
};

loca.preEncode = function (this: Record<string, unknown>) {
  const self = this as unknown as LocaTable;
  if (self.version === 0 && self._processed !== false) {
    for (let i = 0; i < self.offsets.length; i++) {
      self.offsets[i] = self.offsets[i]! >>> 1;
    }
    self._processed = false;
  }
};

export default loca;
