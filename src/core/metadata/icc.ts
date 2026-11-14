/**
 * ICC profiles for PDF/A output intents: a generated sRGB profile, and the
 * structural check every output-intent profile gets before a declaration
 * relies on it.
 */

const sig = (s: string) =>
  (s.charCodeAt(0) << 24) |
  (s.charCodeAt(1) << 16) |
  (s.charCodeAt(2) << 8) |
  s.charCodeAt(3);

const sigAt = (bytes: Uint8Array, offset: number) =>
  String.fromCharCode(
    bytes[offset]!,
    bytes[offset + 1]!,
    bytes[offset + 2]!,
    bytes[offset + 3]!,
  );

const u32 = (bytes: Uint8Array, offset: number) =>
  ((bytes[offset]! << 24) >>> 0) +
  (bytes[offset + 1]! << 16) +
  (bytes[offset + 2]! << 8) +
  bytes[offset + 3]!;

const s15Fixed16 = (v: number) => Math.round(v * 65536);

const xyzTag = (x: number, y: number, z: number): number[][] => [
  [sig('XYZ '), 0, s15Fixed16(x), s15Fixed16(y), s15Fixed16(z)],
];

const toBytes = (words: number[]): Uint8Array => {
  const out = new Uint8Array(words.length * 4);
  const view = new DataView(out.buffer);

  for (let i = 0; i < words.length; i++) view.setUint32(i * 4, words[i]! >>> 0);

  return out;
};

const ascii = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));

const concat = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;

  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }

  return out;
};

export const SRGB_OUTPUT_CONDITION = 'sRGB IEC61966-2.1';

let srgbProfile: Uint8Array | undefined;

/**
 * An ICC version 2.1 display (`mntr`) RGB profile for sRGB, generated here
 * rather than copied from a third-party profile: IEC 61966-2.1 primaries
 * chromatically adapted to the D50 profile connection space (Bradford), and
 * the sRGB transfer function sampled at 1024 points.
 */
export const getSRGBProfile = (): Uint8Array => {
  if (srgbProfile) return srgbProfile.slice();

  const description = 'sRGB IEC61966-2.1 (pdf-lib)';

  const desc = concat([
    toBytes([sig('desc'), 0, description.length + 1]),
    ascii(`${description}\0`),
    // No Unicode or ScriptCode description.
    new Uint8Array(4 + 4 + 2 + 1 + 67),
  ]);

  const cprt = concat([
    toBytes([sig('text'), 0]),
    ascii('No copyright, use freely\0'),
  ]);

  const wtpt = toBytes(xyzTag(0.9642, 1.0, 0.8249).flat());
  const rXYZ = toBytes(xyzTag(0.4360747, 0.2225045, 0.0139322).flat());
  const gXYZ = toBytes(xyzTag(0.3850649, 0.7168786, 0.0971045).flat());
  const bXYZ = toBytes(xyzTag(0.1430804, 0.0606169, 0.7141733).flat());
  const points = 1024;
  const curve = new Uint8Array(12 + points * 2);
  const curveView = new DataView(curve.buffer);
  curveView.setUint32(0, sig('curv') >>> 0);
  curveView.setUint32(8, points);

  for (let i = 0; i < points; i++) {
    const v = i / (points - 1);
    const linear = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    curveView.setUint16(12 + i * 2, Math.round(linear * 65535));
  }

  const tags: [string, Uint8Array][] = [
    ['desc', desc],
    ['cprt', cprt],
    ['wtpt', wtpt],
    ['rXYZ', rXYZ],
    ['gXYZ', gXYZ],
    ['bXYZ', bXYZ],
    ['rTRC', curve],
    ['gTRC', curve],
    ['bTRC', curve],
  ];

  const align = (n: number) => (n + 3) & ~3;
  let offset = 128 + 4 + tags.length * 12;
  const placed = new Map<Uint8Array, number>();
  const table: number[] = [tags.length];
  const data: Uint8Array[] = [];

  for (const [name, bytes] of tags) {
    let at = placed.get(bytes);

    if (at === undefined) {
      at = offset;
      placed.set(bytes, at);
      const padded = new Uint8Array(align(bytes.length));
      padded.set(bytes);
      data.push(padded);
      offset += padded.length;
    }

    table.push(sig(name), at, bytes.length);
  }

  const header = new Uint8Array(128);
  const hv = new DataView(header.buffer);
  hv.setUint32(0, offset);
  hv.setUint32(8, 0x02100000);
  hv.setUint32(12, sig('mntr') >>> 0);
  hv.setUint32(16, sig('RGB ') >>> 0);
  hv.setUint32(20, sig('XYZ ') >>> 0);
  // Creation date: a fixed date keeps the profile's bytes reproducible.
  const created = [2026, 1, 1, 0, 0, 0];

  for (let i = 0; i < created.length; i++)
    hv.setUint16(24 + i * 2, created[i]!);
  hv.setUint32(36, sig('acsp') >>> 0);
  hv.setUint32(68, s15Fixed16(0.9642));
  hv.setUint32(72, s15Fixed16(1.0));
  hv.setUint32(76, s15Fixed16(0.8249));

  srgbProfile = concat([header, toBytes(table), ...data]);

  return srgbProfile.slice();
};

/** The tag types each required tag may have (ICC.1:2001-04 and ICC.1:2010). */
const tagTypes: Record<string, string[]> = {
  desc: ['desc', 'mluc'],
  cprt: ['text', 'mluc'],
  wtpt: ['XYZ '],
  rXYZ: ['XYZ '],
  gXYZ: ['XYZ '],
  bXYZ: ['XYZ '],
  TRC: ['curv', 'para'],
  A2B0: ['mft1', 'mft2', 'mAB '],
};

/** The smallest valid size of each tag type, header included. */
const minimumLength: Record<string, number> = {
  'XYZ ': 20,
  curv: 12,
  para: 16,
  desc: 13,
  text: 9,
  mluc: 16,
  mft1: 48,
  mft2: 52,
  'mAB ': 32,
};

const componentsBySpace: Record<string, number> = {
  'RGB ': 3,
  CMYK: 4,
  GRAY: 1,
};

/**
 * Check that `bytes` is structurally an ICC profile PDF/A accepts as an
 * output-intent profile (ISO 19005-1 6.2.2, -2/-3 6.2.3): an output (`prtr`)
 * or display (`mntr`) profile of an RGB, CMYK or gray device, of an ICC
 * version below 3 for PDF/A-1 and below 5 otherwise, with a well-formed tag
 * table holding the tags its colour transform needs. Returns the number of
 * colour components, or a reason the profile is refused. This is a
 * structural check, not a colorimetric one.
 */
export const checkOutputProfile = (
  bytes: Uint8Array,
  part: number,
): { components: number } | { error: string } => {
  if (bytes.length < 132) return { error: 'the ICC profile is truncated' };
  const size = u32(bytes, 0);

  if (size < 132 || size > bytes.length) {
    return { error: 'the ICC profile size field does not match its data' };
  }

  if (sigAt(bytes, 36) !== 'acsp')
    return { error: "the data is not an ICC profile (no 'acsp')" };
  const major = bytes[8]!;

  if (major < 2 || (part === 1 ? major >= 3 : major >= 5)) {
    return {
      error: `an ICC version ${major} profile is not allowed in a PDF/A-${part} output intent`,
    };
  }

  const deviceClass = sigAt(bytes, 12);

  if (deviceClass !== 'mntr' && deviceClass !== 'prtr') {
    return {
      error: `an ICC '${deviceClass}' profile cannot be an output intent profile`,
    };
  }

  const space = sigAt(bytes, 16);
  const components = componentsBySpace[space];

  if (components === undefined) {
    return { error: `ICC colour space '${space}' is not RGB, CMYK or gray` };
  }

  const pcs = sigAt(bytes, 20);

  if (pcs !== 'XYZ ' && pcs !== 'Lab ')
    return { error: 'the ICC profile connection space is invalid' };

  const count = u32(bytes, 128);

  if (128 + 4 + count * 12 > size)
    return { error: 'the ICC tag table is truncated' };
  const tableEnd = 132 + count * 12;
  const tags = new Map<string, { offset: number; length: number }>();

  for (let i = 0; i < count; i++) {
    const at = 132 + i * 12;
    const offset = u32(bytes, at + 4);
    const length = u32(bytes, at + 8);

    if (offset < tableEnd || offset + length > size) {
      return { error: 'an ICC tag lies outside the profile data' };
    }

    tags.set(sigAt(bytes, at), { offset, length });
  }

  const missing = (names: string[]) => names.filter((n) => !tags.has(n));
  const required = ['desc', 'wtpt', 'cprt'];

  const transform = tags.has('A2B0')
    ? []
    : space === 'RGB '
      ? ['rXYZ', 'gXYZ', 'bXYZ', 'rTRC', 'gTRC', 'bTRC']
      : space === 'GRAY'
        ? ['kTRC']
        : ['A2B0'];

  const absent = missing([...required, ...transform]);

  if (absent.length > 0) {
    return {
      error: `the ICC profile lacks required tags: ${absent.join(', ')}`,
    };
  }

  for (const name of [...required, ...transform]) {
    const { offset, length } = tags.get(name)!;
    const accepted = tagTypes[name.endsWith('TRC') ? 'TRC' : name]!;
    const type = length >= 4 ? sigAt(bytes, offset) : '';
    const minimum = minimumLength[type] ?? 12;

    if (!accepted.includes(type) || length < minimum) {
      return { error: `the ICC '${name}' tag is not valid tag data` };
    }
  }

  return { components };
};
