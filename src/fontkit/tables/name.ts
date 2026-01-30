import * as r from '../../vendors/restructure/index.js';
import { getEncoding, LANGUAGES } from '../encodings.js';

interface NameRecordData {
  platformID: number;
  encodingID: number;
  languageID: number;
  nameID: number;
  length: number;
  string: string;
}

interface LangTagRecordData {
  length: number;
  tag: string;
}

interface NameTableData {
  version: number;
  count: number;
  stringOffset: number;
  records: NameRecordData[] | Record<string, any>;
  langTags?: LangTagRecordData[];
}

const NameRecord = new r.Struct({
  platformID: r.uint16,
  encodingID: r.uint16,
  languageID: r.uint16,
  nameID: r.uint16,
  length: r.uint16,
  string: new r.Pointer(
    r.uint16,
    new r.String('length', ((t: any) =>
      getEncoding(t.platformID, t.encodingID, t.languageID)) as any),
    {
      type: 'parent',
      relativeTo: (ctx: any) => ctx.parent.stringOffset,
      allowNull: false,
    },
  ),
});

const LangTagRecord = new r.Struct({
  length: r.uint16,
  tag: new r.Pointer(r.uint16, new r.String('length', 'utf16be'), {
    type: 'parent',
    relativeTo: (ctx: any) => ctx.stringOffset,
  }),
});

const NameTable = new r.VersionedStruct(r.uint16, {
  0: {
    count: r.uint16,
    stringOffset: r.uint16,
    records: new r.Array(NameRecord, 'count'),
  },
  1: {
    count: r.uint16,
    stringOffset: r.uint16,
    records: new r.Array(NameRecord, 'count'),
    langTagCount: r.uint16,
    langTags: new r.Array(LangTagRecord, 'langTagCount'),
  },
});

export default NameTable;

const NAMES: (string | null)[] = [
  'copyright',
  'fontFamily',
  'fontSubfamily',
  'uniqueSubfamily',
  'fullName',
  'version',
  'postscriptName', // Note: A font may have only one PostScript name and that name must be ASCII.
  'trademark',
  'manufacturer',
  'designer',
  'description',
  'vendorURL',
  'designerURL',
  'license',
  'licenseURL',
  null, // reserved
  'preferredFamily',
  'preferredSubfamily',
  'compatibleFull',
  'sampleText',
  'postscriptCIDFontName',
  'wwsFamilyName',
  'wwsSubfamilyName',
];

NameTable.process = function (this: Record<string, unknown>) {
  const self = this as unknown as NameTableData;
  const records: Record<string, any> = {};
  for (const record of self.records as NameRecordData[]) {
    // find out what language this is for
    let language = LANGUAGES[record.platformID]?.[record.languageID];

    if (
      language == null &&
      self.langTags != null &&
      record.languageID >= 0x8000
    ) {
      language = self.langTags[record.languageID - 0x8000]?.tag;
    }

    if (language == null) {
      language = `${record.platformID}-${record.languageID}`;
    }

    // if the nameID is >= 256, it is a font feature record (AAT)
    const key =
      record.nameID >= 256
        ? 'fontFeatures'
        : NAMES[record.nameID] || record.nameID;
    if (records[key] == null) {
      records[key] = {};
    }

    let obj = records[key];
    if (record.nameID >= 256) {
      obj = obj[record.nameID] || (obj[record.nameID] = {});
    }

    if (
      typeof record.string === 'string' ||
      typeof obj[language] !== 'string'
    ) {
      obj[language] = record.string;
    }
  }

  self.records = records;
};

NameTable.preEncode = function (this: Record<string, unknown>) {
  const self = this as unknown as NameTableData;
  if (Array.isArray(self.records)) return;
  self.version = 0;

  const records: NameRecordData[] = [];
  for (const key in self.records) {
    const val = self.records[key];
    if (key === 'fontFeatures') continue;

    records.push({
      platformID: 3,
      encodingID: 1,
      languageID: 0x409,
      nameID: NAMES.indexOf(key),
      length: val.en.length * 2,
      string: val.en,
    });

    if (key === 'postscriptName') {
      records.push({
        platformID: 1,
        encodingID: 0,
        languageID: 0,
        nameID: NAMES.indexOf(key),
        length: val.en.length,
        string: val.en,
      });
    }
  }

  self.records = records;
  self.count = records.length;
  self.stringOffset = NameTable.size(self as unknown as Record<string, unknown>, null, false);
};
