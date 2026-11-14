// Lists fonts whose GSUB/GPOS lookups set UseMarkFilteringSet (0x0010),
// and their GDEF version. Raw sfnt parse; TTF/OTF only.
import { readFileSync } from 'node:fs';

for (const path of process.argv.slice(2)) {
  const b = readFileSync(path);
  const u16 = (o) => b.readUInt16BE(o);
  const u32 = (o) => b.readUInt32BE(o);
  const n = u16(4);
  const tables = {};
  for (let i = 0; i < n; i++) {
    const r = 12 + i * 16;
    tables[b.toString('latin1', r, r + 4)] = u32(r + 8);
  }
  const gdef = tables.GDEF;
  let line = `${path}: GDEF ${gdef == null ? 'none' : u32(gdef).toString(16)}`;
  if (gdef != null && u32(gdef) >= 0x10002) {
    const off = u16(gdef + 12);
    line += off ? ` sets=${u16(gdef + off + 2)}` : ' sets=null';
  }
  for (const tag of ['GSUB', 'GPOS']) {
    const t = tables[tag];
    if (t == null) continue;
    const ll = t + u16(t + 8);
    const count = u16(ll);
    const hits = [];
    for (let i = 0; i < count; i++) {
      const lk = ll + u16(ll + 2 + i * 2);
      const flag = u16(lk + 2);
      if (flag & 0x10) {
        const sub = u16(lk + 4);
        hits.push(`${i}:set${u16(lk + 6 + sub * 2)}`);
      }
    }
    line += ` ${tag} ${count} lookups, filtered [${hits.join(' ')}]`;
  }
  console.log(line);
}
