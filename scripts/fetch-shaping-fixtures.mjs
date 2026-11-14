// Fetches the shaping test fonts committed under assets/fonts/ from
// google/fonts (OFL), pinned to a commit. Run from the repo root:
//   node scripts/fetch-shaping-fixtures.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const ref = '8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5';

const files = [
  ['ofl/notosanssharada/NotoSansSharada-Regular.ttf', 'noto_sans_sharada/NotoSansSharada-Regular.ttf'],
  ['ofl/notosanssharada/OFL.txt', 'noto_sans_sharada/OFL.txt'],
  ['ofl/notoseriftibetan/NotoSerifTibetan[wght].ttf', 'noto_serif_tibetan/NotoSerifTibetan[wght].ttf'],
  ['ofl/notoseriftibetan/OFL.txt', 'noto_serif_tibetan/OFL.txt'],
  ['ofl/notosansthai/NotoSansThai[wdth,wght].ttf', 'noto_sans_thai/NotoSansThai[wdth,wght].ttf'],
  ['ofl/notosansthai/OFL.txt', 'noto_sans_thai/OFL.txt'],
  ['ofl/notosanscoptic/NotoSansCoptic-Regular.ttf', 'noto_sans_coptic/NotoSansCoptic-Regular.ttf'],
  ['ofl/notosanscoptic/OFL.txt', 'noto_sans_coptic/OFL.txt'],
  ['ofl/notoserifhebrew/NotoSerifHebrew[wdth,wght].ttf', 'noto_serif_hebrew/NotoSerifHebrew[wdth,wght].ttf'],
  ['ofl/notoserifhebrew/OFL.txt', 'noto_serif_hebrew/OFL.txt'],
  ['ofl/notonaskharabic/NotoNaskhArabic[wght].ttf', 'noto_naskh_arabic/NotoNaskhArabic[wght].ttf'],
  ['ofl/notonaskharabic/OFL.txt', 'noto_naskh_arabic/OFL.txt'],
];

for (const [src, dst] of files) {
  const body = execFileSync(
    'gh',
    ['api', `repos/google/fonts/contents/${src}?ref=${ref}`, '--header', 'Accept: application/vnd.github.raw'],
    { maxBuffer: 1 << 28 },
  );

  mkdirSync(`assets/fonts/${dst.split('/')[0]}`, { recursive: true });
  writeFileSync(`assets/fonts/${dst}`, body);
  console.log(dst, body.length);
}
