import * as r from '../../vendors/restructure/index.js';
const loca = new r.VersionedStruct('head.indexToLocFormat', {
    0: {
        offsets: new r.Array(r.uint16),
    },
    1: {
        offsets: new r.Array(r.uint32),
    },
});
loca.process = function () {
    const self = this;
    if (self.version === 0 && !self._processed) {
        for (let i = 0; i < self.offsets.length; i++) {
            self.offsets[i] = self.offsets[i] << 1;
        }
        self._processed = true;
    }
};
loca.preEncode = function () {
    const self = this;
    if (self.version === 0 && self._processed !== false) {
        for (let i = 0; i < self.offsets.length; i++) {
            self.offsets[i] = self.offsets[i] >>> 1;
        }
        self._processed = false;
    }
};
export default loca;
//# sourceMappingURL=loca.js.map