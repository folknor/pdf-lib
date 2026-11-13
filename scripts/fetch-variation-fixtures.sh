#!/usr/bin/env bash
# Fetches the variable-font fixtures used by tests/fontkit/variations.spec.ts
# from cantoo-scribe/fontkit (test/data/fonttest, fontkit's test corpus).
set -euo pipefail
dest="$(dirname "$0")/../assets/fonts/fonttest"
mkdir -p "$dest"
for n in TestGVAROne TestGVARTwo TestGVARThree TestGVARFour TestHVARTwo; do
  for e in ttf woff woff2; do
    gh api "repos/cantoo-scribe/fontkit/contents/test/data/fonttest/$n.$e?ref=836ca892" \
      --header "Accept: application/vnd.github.raw" >"$dest/$n.$e"
  done
done
ls -la "$dest"
