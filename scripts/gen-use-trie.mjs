// Regenerates the Universal Shaping Engine category trie (trieUse.ts) the way
// @pdf-lib/fontkit's src/opentype/shapers/gen-use.js did, from UCD files laid
// out as in the `codepoints` npm package (UnicodeData.txt,
// IndicSyllabicCategory.txt, IndicPositionalCategory.txt).
//
// The category numbering is taken from use.ts (the compiled state machine
// indexes its columns by it), so the trie stays consistent with use.ts.
//
// The UCD files are not committed. Fetch them from `codepoints` 1.3.0
// (commit 9004b7fa6d, Unicode 12.0.0) into scripts/ucd-cache/9004b7fa6d/:
//   gh api "repos/devongovett/codepoints/contents/data/<File>.txt?ref=9004b7fa6d" \
//     --header "Accept: application/vnd.github.raw" > scripts/ucd-cache/9004b7fa6d/<File>.txt
// That snapshot reproduces use.ts's category order and decompositions
// exactly (codepoints 1.2.1 / Unicode 9 does not), so it is what use.ts was
// generated from.
//
// Needs `unicode-trie` 2.x for its builder, which is no longer a dependency
// (temporarily `pnpm add -D unicode-trie@2` to run).
//
// Run directly to compare a UCD snapshot against use.ts:
//   node scripts/gen-use-trie.mjs scripts/ucd-cache/9004b7fa6d
// and with --write to also write trieUse.ts and the trieUse.ts values of
// tests/fontkit/shaperTries.fixture.json (each code point of the written
// blob is checked against the builder first):
//   node scripts/gen-use-trie.mjs scripts/ucd-cache/9004b7fa6d --write

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzlibSync, zlibSync } from 'fflate';

const require = createRequire(import.meta.url);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// --- verbatim tables from gen-use.js ---------------------------------------
const CATEGORIES = {
  B: [
    { UISC: 'Number' },
    { UISC: 'Avagraha', UGC: 'Lo' },
    { UISC: 'Bindu', UGC: 'Lo' },
    { UISC: 'Consonant' },
    { UISC: 'Consonant_Final', UGC: 'Lo' },
    { UISC: 'Consonant_Head_Letter' },
    { UISC: 'Consonant_Medial', UGC: 'Lo' },
    { UISC: 'Consonant_Subjoined', UGC: 'Lo' },
    { UISC: 'Tone_Letter' },
    { UISC: 'Vowel', UGC: 'Lo' },
    { UISC: 'Vowel_Independent' },
    { UISC: 'Vowel_Dependent', UGC: 'Lo' },
  ],
  CGJ: [0x034f],
  CM: ['Nukta', 'Gemination_Mark', 'Consonant_Killer'],
  CS: ['Consonant_With_Stacker'],
  F: [
    { UISC: 'Consonant_Final', UGC: { not: 'Lo' } },
    { UISC: 'Consonant_Succeeding_Repha' },
  ],
  FM: ['Syllable_Modifier'],
  GB: ['Consonant_Placeholder', 0x2015, 0x2022, 0x25fb, 0x25fc, 0x25fd, 0x25fe],
  H: ['Virama', 'Invisible_Stacker'],
  HN: ['Number_Joiner'],
  IND: [
    'Consonant_Dead',
    'Modifying_Letter',
    { UGC: 'Po', U: { not: [0x104e, 0x2022] } },
  ],
  M: [{ UISC: 'Consonant_Medial', UGC: { not: 'Lo' } }],
  N: ['Brahmi_Joining_Number'],
  R: ['Consonant_Preceding_Repha', 'Consonant_Prefixed'],
  Rsv: [{ UGC: 'Cn' }],
  S: [{ UGC: 'So', U: { not: 0x25cc } }, { UGC: 'Sc' }],
  SM: [0x1b6b, 0x1b6c, 0x1b6d, 0x1b6e, 0x1b6f, 0x1b70, 0x1b71, 0x1b72, 0x1b73],
  SUB: [{ UISC: 'Consonant_Subjoined', UGC: { not: 'Lo' } }],
  V: [
    { UISC: 'Vowel', UGC: { not: 'Lo' } },
    { UISC: 'Vowel_Dependent', UGC: { not: 'Lo' } },
    { UISC: 'Pure_Killer' },
  ],
  VM: [
    { UISC: 'Bindu', UGC: { not: 'Lo' } },
    'Tone_Mark',
    'Cantillation_Mark',
    'Register_Shifter',
    'Visarga',
  ],
  VS: [
    0xfe00, 0xfe01, 0xfe02, 0xfe03, 0xfe04, 0xfe05, 0xfe06, 0xfe07, 0xfe08,
    0xfe09, 0xfe0a, 0xfe0b, 0xfe0c, 0xfe0d, 0xfe0e, 0xfe0f,
  ],
  WJ: [0x2060],
  ZWJ: ['Joiner'],
  ZWNJ: ['Non_Joiner'],
  O: ['Other'],
};

const USE_POSITIONS = {
  F: { Abv: ['Top'], Blw: ['Bottom'], Pst: ['Right'] },
  M: { Abv: ['Top'], Blw: ['Bottom'], Pst: ['Right'], Pre: ['Left'] },
  CM: { Abv: ['Top'], Blw: ['Bottom'] },
  V: {
    Abv: ['Top', 'Top_And_Bottom', 'Top_And_Bottom_And_Right', 'Top_And_Right'],
    Blw: ['Bottom', 'Overstruck', 'Bottom_And_Right'],
    Pst: ['Right'],
    Pre: ['Left', 'Top_And_Left', 'Top_And_Left_And_Right', 'Left_And_Right'],
  },
  VM: { Abv: ['Top'], Blw: ['Bottom', 'Overstruck'], Pst: ['Right'], Pre: ['Left'] },
  SM: { Abv: ['Top'], Blw: ['Bottom'] },
};

// --- Tibetan overrides from the USE specification ---------------------------
// The USE specification's "Overrides to Unicode categories" are the data
// files IndicSyllabicCategory-Additional.txt and
// IndicPositionalCategory-Additional.txt in github.com/microsoft/font-tools
// (USE/, MIT; read at commit 9dcd14bcc9, Unicode 18). Those files are
// written against the current USE cluster grammar and the current UCD; the
// grammar compiled into use.ts is fontkit's older one and this trie is
// built from Unicode 12, so the files are not applied wholesale. Doing so
// fails outright (Duployan U+1BC9D-1BC9E Nukta + Overstruck derive a bare CM
// that use.ts has no column for; hieroglyph classes do not exist) and breaks
// shaping where the old grammar differs (Balinese musical symbols become CM,
// which its symbol cluster S SM* does not accept). Only these Tibetan
// entries are taken, each checked against use.ts's state machine:
const TIBETAN_UISC_OVERRIDE = {
  0x0f00: 'Consonant', // SYLLABLE OM
  0x0f01: 'Consonant',
  0x0f04: 'Consonant',
  0x0f05: 'Consonant',
  0x0f06: 'Consonant',
  // AA as a nukta (CMBlw) so it precedes any vowel sign in the cluster, as
  // in Unicode canonical order (ccc 129 before 130/132) and in the
  // decompositions of U+0F73, U+0F75 and U+0F81 that UniversalShaper makes.
  // The mark reorder in CanonicalCompose.ts puts a typed I or U after AA.
  0x0f71: 'Nukta',
  0x0f86: 'Tone_Mark',
  0x0f87: 'Tone_Mark',
};
// Not taken from the Tibetan block, deliberately:
// - U+0F7F RNAM BCAD -> Consonant_Dead (independent cluster): a following
//   U+0F35, U+0F37 or U+0FC6 (Syllable_Modifier, FM) would then start a
//   broken cluster (font-tools issue 19).
// --- gen-use.js's own override tables (verbatim, plus the Tibetan entries) --
const UISC_OVERRIDE = {
  ...TIBETAN_UISC_OVERRIDE,
  0x17dd: 'Vowel_Dependent',
  0x1ce2: 'Cantillation_Mark',
  0x1ce3: 'Cantillation_Mark',
  0x1ce4: 'Cantillation_Mark',
  0x1ce5: 'Cantillation_Mark',
  0x1ce6: 'Cantillation_Mark',
  0x1ce7: 'Cantillation_Mark',
  0x1ce8: 'Cantillation_Mark',
  0x1ced: 'Tone_Mark',
};

// These positions describe grammar order, not where the glyph is drawn.
// VAbv precedes VBlw: pair this table with U's rank in MarkOrder.ts.
const UIPC_OVERRIDE = {
  0x0f72: 'Bottom',
  0x0f7a: 'Bottom',
  0x0f7b: 'Bottom',
  0x0f7c: 'Bottom',
  0x0f7d: 'Bottom',
  0x0f80: 'Bottom',
  0x0f74: 'Top',
  0x1b6c: 'Bottom',
  0x953: 'Not_Applicable',
  0x954: 'Not_Applicable',
  0x103c: 'Left',
  0xa926: 'Top',
  0xa927: 'Top',
  0xa928: 'Top',
  0xa929: 'Top',
  0xa92a: 'Top',
  0x111ca: 'Bottom',
  0x11300: 'Top',
  0x1133c: 'Bottom',
  0x1171e: 'Left',
  0x1cf2: 'Right',
  0x1cf3: 'Right',
  0x1cf8: 'Top',
  0x1cf9: 'Top',
};

function check(pattern, value) {
  if (typeof pattern === 'object' && pattern.not) {
    if (Array.isArray(pattern.not)) return pattern.not.indexOf(value) === -1;
    return value !== pattern.not;
  }
  return value === pattern;
}

function matches(pattern, code) {
  if (typeof pattern === 'number') pattern = { U: pattern };
  else if (typeof pattern === 'string') pattern = { UISC: pattern };
  for (const key in pattern) {
    if (!check(pattern[key], code[key])) return false;
  }
  return true;
}

const getUISC = (c) => UISC_OVERRIDE[c.code] || c.indicSyllabicCategory || 'Other';
const getUIPC = (c) => UIPC_OVERRIDE[c.code] || c.indicPositionalCategory;

function getPositionalCategory(c, USE) {
  const UIPC = getUIPC(c);
  const pos = USE_POSITIONS[USE];
  if (pos) {
    for (const key in pos) {
      if (pos[key].indexOf(UIPC) !== -1) return USE + key;
    }
  }
  return USE;
}

function getCategory(c) {
  for (const category in CATEGORIES) {
    for (const pattern of CATEGORIES[category]) {
      if (matches(pattern, { UISC: getUISC(c), UGC: c.category, U: c.code })) {
        return getPositionalCategory(c, category);
      }
    }
  }
  return null;
}

// --- minimal port of the `codepoints` parser (only the fields used) -------
function parseUcd(ucdDir) {
  const cps = [];
  const lines = readFileSync(join(ucdDir, 'UnicodeData.txt'), 'ascii').split('\n');
  let rangeStart = -1;
  for (const line of lines) {
    if (!line) continue;
    const parts = line.split(';');
    const code = parseInt(parts[0], 16);
    let decomposition = parts[5]
      ? parts[5].split(' ').filter(Boolean).map((x) => parseInt(x, 16))
      : [];
    if (decomposition.length && Number.isNaN(decomposition[0])) {
      decomposition = decomposition.slice(1); // compatibility tag
    }
    const mk = (cp) => ({
      code: cp,
      category: parts[2],
      decomposition,
      indicSyllabicCategory: null,
      indicPositionalCategory: null,
    });
    if (rangeStart >= 0) {
      for (let cp = rangeStart; cp <= code; cp++) cps[cp] = mk(cp);
      rangeStart = -1;
    } else if (/<.+, First>/.test(parts[1])) {
      rangeStart = code;
    } else {
      cps[code] = mk(code);
    }
  }
  const readProp = (file, field) => {
    for (const line of readFileSync(join(ucdDir, file), 'ascii').split('\n')) {
      if (!line || line[0] === '#') continue;
      const parts = line.replace(/\s*#.*$/, '').split(/\s*;\s*/);
      const m = /([a-z0-9]+)\.\.([a-z0-9]+)/i.exec(parts[0]);
      const [s, e] = m
        ? [parseInt(m[1], 16), parseInt(m[2], 16)]
        : [parseInt(parts[0], 16), parseInt(parts[0], 16)];
      if (Number.isNaN(s)) continue;
      for (let cp = s; cp <= e; cp++) if (cps[cp]) cps[cp][field] = parts[1];
    }
  };
  readProp('IndicPositionalCategory.txt', 'indicPositionalCategory');
  readProp('IndicSyllabicCategory.txt', 'indicSyllabicCategory');
  return cps;
}

export function readUseJson() {
  const src = readFileSync(join(root, 'src/fontkit/opentype/shapers/use.ts'), 'utf8');
  const m = /'([A-Za-z0-9+/=]+)'/.exec(src);
  return JSON.parse(
    Buffer.from(unzlibSync(Buffer.from(m[1], 'base64'))).toString('latin1'),
  );
}

// Returns { trie (frozen unicode-trie), categories (generation order),
// decompositions }. Values are indices into use.ts's categories.
export function buildUseTrie(ucdDir) {
  const cps = parseUcd(ucdDir);
  const useCats = readUseJson().categories;
  const symbols = {};
  const order = [];
  const decompositions = {};
  const UnicodeTrieBuilder = require('unicode-trie/builder');
  const builder = new UnicodeTrieBuilder();
  const decompose = (code) => {
    const out = [];
    for (const c of cps[code].decomposition) {
      const sub = decompose(c);
      out.push(...(sub.length > 0 ? sub : [c]));
    }
    return out;
  };
  for (let i = 0; i < cps.length; i++) {
    const c = cps[i];
    if (!c) continue;
    const category = String(getCategory(c));
    if (!(category in symbols)) {
      symbols[category] = order.length;
      order.push(category);
    }
    const idx = useCats.indexOf(category);
    if (idx < 0) throw new Error(`category ${category} (U+${i.toString(16)}) not in use.ts`);
    builder.set(c.code, idx);
    if (c.indicSyllabicCategory === 'Vowel_Dependent' && c.decomposition.length > 0) {
      decompositions[c.code] = decompose(c.code);
    }
  }
  return { trie: builder.freeze(), categories: order, decompositions };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  const { trie, categories, decompositions } = buildUseTrie(dir);
  const use = readUseJson();
  console.log('categories match use.ts order:', JSON.stringify(categories) === JSON.stringify(use.categories));
  if (JSON.stringify(categories) !== JSON.stringify(use.categories)) {
    console.log(' generated:', JSON.stringify(categories));
    console.log(' use.ts:   ', JSON.stringify(use.categories));
  }
  console.log(
    'decompositions match use.ts:',
    JSON.stringify(decompositions) === JSON.stringify(use.decompositions),
    Object.keys(decompositions).length,
    Object.keys(use.decompositions).length,
  );
  const show = [0x41, 0x0915, 0x0f40, 0x0f71, 0x0f90, 0x1780, 0x17b6, 0x17c6, 0x17d2, 0x1b05, 0x1b34, 0x1b6b, 0xa984, 0xa9c0, 0x11003, 0x11046];
  console.log(show.map((cp) => `U+${cp.toString(16)}=${use.categories[trie.get(cp)]}`).join(' '));
  console.log({ highStart: trie.highStart.toString(16), dataLength: trie.data.length });
  if (process.argv.includes('--write')) writeUseTrie(trie);
}

// Serializes in the format read by src/vendors/unicode-properties/
// UnicodeTrie.ts: base64( zlib( u32le highStart | u32le errorValue |
// u32le data[] ) ). The blob is decoded again and every code point compared
// with the builder's lookup before anything is written.
function writeUseTrie(trie) {
  const bytes = new Uint8Array(8 + trie.data.length * 4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, trie.highStart >>> 0, true);
  view.setUint32(4, trie.errorValue >>> 0, true);
  for (let i = 0; i < trie.data.length; i++) view.setUint32(8 + i * 4, trie.data[i], true);
  const b64 = Buffer.from(zlibSync(bytes, { level: 9 })).toString('base64');

  const raw = unzlibSync(Buffer.from(b64, 'base64'));
  const rv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const data = new Uint32Array((raw.length - 8) / 4);
  for (let i = 0; i < data.length; i++) data[i] = rv.getUint32(8 + i * 4, true);
  const UnicodeTrie = require('unicode-trie');
  const decoded = new UnicodeTrie({
    data,
    highStart: rv.getUint32(0, true),
    errorValue: rv.getUint32(4, true),
  });
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    if (decoded.get(cp) !== trie.get(cp)) {
      throw new Error(`re-decoded blob differs at U+${cp.toString(16)}`);
    }
  }

  writeFileSync(join(root, 'src/fontkit/opentype/shapers/trieUse.ts'), `export default '${b64}';\n`);
  const fixturePath = join(root, 'tests/fontkit/shaperTries.fixture.json');
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  fixture.values['trieUse.ts'] = fixture.codePoints.map((cp) => trie.get(cp));
  writeFileSync(fixturePath, `${JSON.stringify(fixture)}\n`);
  console.log('wrote trieUse.ts and the fixture trieUse.ts values');
}
