// One-off: rebuild src/vendors/unicode-properties/trie.json in the format read
// by src/vendors/unicode-properties/UnicodeTrie.ts:
//
//   base64( zlib( u32le highStart | u32le errorValue | u32le data[] ) )
//
// The blob copied in by the fontkit TypeScript migration (34d8b07f) is the
// unicode-trie 0.3 serialization (the same defect scripts/reencode-shaper-
// tries.mjs fixed for the shaper tries): a 12-byte BIG-endian header
// (highStart, errorValue, uncompressedLength) followed by the u32le data
// deflated a second time. The vendored reader takes bytes 0-7 as a
// little-endian header and the rest as raw data, so every lookup returned
// garbage: in the BMP undefined, read as index 0 (Cc, Common,
// Not_Reordered, not a mark); above it one fixed value (Sm, no script,
// CCC31). Script detection, mark tests and combining classes were all wrong.
//
// This script decodes the original blob correctly, checks every assigned
// code point's general category and combining class against UnicodeData.txt,
// its script against Scripts.txt and its East Asian width against
// EastAsianWidth.txt (UCD snapshot below), and only then writes the new blob.
// It also writes the sample fixture used by
// tests/vendors/unicodeProperties.spec.ts.
//
// UCD files: `codepoints` commit d34dd5abd4 (1.2.1, Unicode 8.0.0), fetched
// with gh into scripts/ucd-cache/d34dd5abd4/ if missing (that directory is
// ignored). That is the snapshot the data matches exactly; the Unicode 12
// snapshot (9004b7fa6d) the shaper tries use disagrees on every character
// added since 8.0. East Asian width is compared for assigned code points
// only, as the original builder stored it.
// Must run on the ORIGINAL trie.json (before the commit that added this
// script). Run from the repo root:
//   node scripts/reencode-unicode-properties-trie.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync, unzlibSync, zlibSync } from 'fflate';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendorDir = join(root, 'src/vendors/unicode-properties');
const triePath = join(vendorDir, 'trie.json');
const fixturePath = join(root, 'tests/vendors/unicodeProperties.fixture.json');
const ucdRef = process.argv[2] ?? 'd34dd5abd4';
const ucdDir = join(root, 'scripts/ucd-cache', ucdRef);

function fail(msg) {
  console.error(`reencode-unicode-properties-trie: ${msg}`);
  process.exit(1);
}

function ucd(name) {
  const p = join(ucdDir, name);

  if (!existsSync(p)) {
    mkdirSync(ucdDir, { recursive: true });

    const body = execFileSync(
      'gh',
      [
        'api',
        `repos/devongovett/codepoints/contents/data/${name}?ref=${ucdRef}`,
        '--header',
        'Accept: application/vnd.github.raw',
      ],
      { maxBuffer: 64 << 20 },
    );

    writeFileSync(p, body);
  }

  return readFileSync(p, 'utf8');
}

// --- reference lookup (the unicode-trie algorithm, own copy) ---------------
function makeTrie(highStart, errorValue, data) {
  return {
    highStart,
    errorValue,
    data,
    get(cp) {
      if (cp < 0 || cp > 0x10ffff) return errorValue;
      let i;

      if (cp < 0xd800 || (cp > 0xdbff && cp <= 0xffff)) {
        i = (data[cp >> 5] << 2) + (cp & 31);

        return data[i];
      }

      if (cp <= 0xffff) {
        i = (data[2048 + ((cp - 0xd800) >> 5)] << 2) + (cp & 31);

        return data[i];
      }

      if (cp < highStart) {
        i = data[0x840 - 32 + (cp >> 11)];
        i = data[i + ((cp >> 5) & 63)];
        i = (i << 2) + (cp & 31);

        return data[i];
      }

      return data[data.length - 4];
    },
  };
}

function u32le(bytes) {
  if (bytes.length % 4 !== 0) fail('payload not 4-byte aligned');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Uint32Array(bytes.length / 4);

  for (let i = 0; i < out.length; i++) out[i] = view.getUint32(i * 4, true);

  return out;
}

function loadOld(b64) {
  const outer = unzlibSync(Buffer.from(b64, 'base64'));
  const view = new DataView(outer.buffer, outer.byteOffset, outer.byteLength);
  const highStart = view.getUint32(0, false);
  const errorValue = view.getUint32(4, false);
  const length = view.getUint32(8, false);

  if (highStart > 0x110000 || length % 4 !== 0) {
    fail('trie.json is not a unicode-trie 0.3 blob (already converted?)');
  }

  // The 0.3 builder deflated the data twice.
  const payload = inflateSync(inflateSync(outer.subarray(12)));

  if (payload.length !== length) {
    fail(`inner payload length ${payload.length}, header says ${length}`);
  }

  return makeTrie(highStart, errorValue, u32le(payload));
}

function encodeNew(t) {
  const bytes = new Uint8Array(8 + t.data.length * 4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, t.highStart >>> 0, true);
  view.setUint32(4, t.errorValue >>> 0, true);

  for (let i = 0; i < t.data.length; i++) view.setUint32(8 + i * 4, t.data[i], true);

  return Buffer.from(zlibSync(bytes, { level: 9 })).toString('base64');
}

function loadNew(b64) {
  const raw = unzlibSync(Buffer.from(b64, 'base64'));
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);

  return makeTrie(view.getUint32(0, true), view.getUint32(4, true), u32le(raw.subarray(8)));
}

// --- field layout, as in src/vendors/unicode-properties/index.ts -----------
const data = JSON.parse(
  Buffer.from(
    unzlibSync(Buffer.from(JSON.parse(readFileSync(join(vendorDir, 'data.json'), 'utf8')), 'base64')),
  ).toString('latin1'),
);

const bits = (n) => (Math.log2(n) + 1) | 0;
const CB = bits(data.categories.length - 1);
const KB = bits(data.combiningClasses.length - 1);
const SB = bits(data.scripts.length - 1);
const EB = bits(data.eaw.length - 1);
const NB = 10;
const field = (v, shift, nbits) => (v >>> shift) & ((1 << nbits) - 1);

const decode = (v) => ({
  category: data.categories[field(v, KB + SB + EB + NB, CB)],
  ccc: data.combiningClasses[field(v, SB + EB + NB, KB)],
  script: data.scripts[field(v, EB + NB, SB)],
  eaw: data.eaw[field(v, NB, EB)],
});

// --- UCD reference ---------------------------------------------------------
const cccName = new Map();

for (const line of ucd('PropertyValueAliases.txt').split('\n')) {
  const m = /^ccc;\s*(\d+);\s*[^;]+;\s*([A-Za-z_0-9]+)/.exec(line);

  if (m) cccName.set(Number(m[1]), m[2]);
}

const refCategory = new Map();
const refCcc = new Map();

{
  let first = -1;

  for (const line of ucd('UnicodeData.txt').split('\n')) {
    if (!line) continue;
    const f = line.split(';');
    const cp = parseInt(f[0], 16);

    const set = (c) => {
      refCategory.set(c, f[2]);
      const n = Number(f[3]);
      refCcc.set(c, cccName.get(n) ?? `CCC${n}`);
    };

    if (first >= 0) {
      for (let c = first; c <= cp; c++) set(c);
      first = -1;
    } else if (f[1].endsWith(', First>')) first = cp;
    else set(cp);
  }
}

function rangeFile(name) {
  const map = new Map();

  for (const raw of ucd(name).split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();

    if (!line) continue;
    const [range, value] = line.split(/\s*;\s*/);
    const [lo, hi] = range.split('..').map((h) => parseInt(h, 16));

    for (let c = lo; c <= (hi ?? lo); c++) map.set(c, value);
  }

  return map;
}

const refScript = rangeFile('Scripts.txt');
const refEaw = rangeFile('EastAsianWidth.txt');

// --- decode, verify, write -------------------------------------------------
const oldTrie = loadOld(JSON.parse(readFileSync(triePath, 'utf8')));

console.log(
  `old trie: highStart 0x${oldTrie.highStart.toString(16)}, ${oldTrie.data.length} words`,
);

const mismatches = { category: 0, ccc: 0, script: 0, eaw: 0 };
const samples = { category: [], ccc: [], script: [], eaw: [] };

const note = (k, cp, got, want) => {
  if (mismatches[k]++ < 10) samples[k].push(`U+${cp.toString(16)} ${got} != ${want}`);
};

for (let cp = 0; cp <= 0x10ffff; cp++) {
  const d = decode(oldTrie.get(cp));

  if (refCategory.has(cp)) {
    if (d.category !== refCategory.get(cp)) note('category', cp, d.category, refCategory.get(cp));

    if (d.ccc !== refCcc.get(cp)) note('ccc', cp, d.ccc, refCcc.get(cp));
  }

  if (refScript.has(cp) && d.script !== refScript.get(cp)) {
    note('script', cp, d.script, refScript.get(cp));
  }

  // The original builder only stored EAW for assigned code points.
  if (refCategory.has(cp) && refEaw.has(cp) && d.eaw !== refEaw.get(cp)) note('eaw', cp, d.eaw, refEaw.get(cp));
}

console.log('mismatches vs UCD', ucdRef, JSON.stringify(mismatches));

for (const [k, s] of Object.entries(samples)) for (const line of s) console.log(`  ${k}: ${line}`);

if (Object.values(mismatches).some((n) => n > 0)) fail('decoded trie disagrees with the UCD');

const newB64 = encodeNew(oldTrie);
const newTrie = loadNew(newB64);

for (let cp = -1; cp <= 0x110000; cp++) {
  if (oldTrie.get(cp) !== newTrie.get(cp)) fail(`re-encoded trie differs at ${cp}`);
}

const fixture = { codePoints: [], values: [] };

// Latin through Arabic densely, then a sparse stride over everything.
for (let cp = 0; cp <= 0x10ffff; cp += cp < 0x700 ? 1 : 997) {
  fixture.codePoints.push(cp);
  fixture.values.push(oldTrie.get(cp));
}

writeFileSync(triePath, `${JSON.stringify(newB64)}\n`);

writeFileSync(fixturePath, `${JSON.stringify(fixture)}\n`);

console.log(`wrote ${triePath} and ${fixturePath} (${fixture.codePoints.length} code points)`);
