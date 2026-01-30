import * as r from '../../vendors/restructure/index.js';
import Tables from './index.js';

interface TableEntryData {
  tag: string;
  checkSum: number;
  offset: any;
  length: number;
}

interface DirectoryData {
  tag: string;
  numTables: number;
  searchRange: number;
  entrySelector: number;
  rangeShift: number;
  tables: TableEntryData[] | Record<string, TableEntryData>;
}

const TableEntry = new r.Struct({
  tag: new r.String(4),
  checkSum: r.uint32,
  offset: new r.Pointer(r.uint32, 'void', { type: 'global' }),
  length: r.uint32,
});

const Directory = new r.Struct({
  tag: new r.String(4),
  numTables: r.uint16,
  searchRange: r.uint16,
  entrySelector: r.uint16,
  rangeShift: r.uint16,
  tables: new r.Array(TableEntry, 'numTables'),
});

Directory.process = function (this: Record<string, unknown>) {
  const self = this as unknown as DirectoryData;
  const tables: Record<string, TableEntryData> = {};
  for (const table of self.tables as TableEntryData[]) {
    tables[table.tag] = table;
  }

  self.tables = tables;
};

Directory.preEncode = function (this: Record<string, unknown>) {
  const self = this as unknown as DirectoryData;
  if (!Array.isArray(self.tables)) {
    const tables: TableEntryData[] = [];
    for (const tag in self.tables) {
      const table = (self.tables as Record<string, TableEntryData>)[tag];
      if (table) {
        tables.push({
          tag: tag,
          checkSum: 0,
          offset: new r.VoidPointer(Tables[tag], table),
          length: Tables[tag].size(table),
        });
      }
    }

    self.tables = tables;
  }

  self.tag = 'true';
  self.numTables = (self.tables as TableEntryData[]).length;

  const maxExponentFor2 = Math.floor(Math.log(self.numTables) / Math.LN2);
  const maxPowerOf2 = 2 ** maxExponentFor2;

  self.searchRange = maxPowerOf2 * 16;
  self.entrySelector = Math.log(maxPowerOf2) / Math.LN2;
  self.rangeShift = self.numTables * 16 - self.searchRange;
};

export default Directory;
