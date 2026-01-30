import * as r from '../../vendors/restructure/index.js';

const HmtxEntry = new r.Struct({
  advance: r.uint16,
  bearing: r.int16,
});

export default new r.Struct({
  metrics: new r.LazyArray(
    HmtxEntry,
    (t: any) => t.parent.hhea.numberOfMetrics,
  ),
  bearings: new r.LazyArray(
    r.int16,
    (t: any) => t.parent.maxp.numGlyphs - t.parent.hhea.numberOfMetrics,
  ),
});
