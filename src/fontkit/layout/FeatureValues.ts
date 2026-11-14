/**
 * A requested feature value: `true`/`false` switch a feature on or off; a
 * number N selects the Nth alternate (1-based) where the feature reaches a
 * GSUB alternate substitution, as HarfBuzz's feature value does (`aalt=2`).
 */
export type FeatureValue = boolean | number;

export type FeatureRequest = Record<string, FeatureValue>;

/**
 * Normalizes a caller's feature request once, at the GlyphRun boundary, into
 * a fresh object (the caller's object is never kept or mutated):
 * - `true`, `1` and any other truthy number that is not an integer >= 2
 *   (negative, fractional, infinite) become `true` (first alternate);
 * - `undefined` entries are dropped (previously they disabled a planned
 *   feature but not legacy kerning, an inconsistency);
 * - `false`, `0`, `NaN` and other falsy values become `false`, and stay in
 *   the request so an explicit `kern: 0` still disables kerning;
 * - an integer >= 2 is kept as the alternate number.
 */
export function normalizeFeatures(features: string[] | Record<string, unknown>): FeatureRequest {
  const res: FeatureRequest = {};

  if (Array.isArray(features)) {
    for (const tag of features) {
      res[tag] = true;
    }

    return res;
  }

  for (const tag in features) {
    const value = features[tag];

    if (value === undefined) {
      // An optional property left unset is no request at all.
      continue;
    }

    if (!value) {
      res[tag] = false;
    } else if (typeof value === "number" && Number.isInteger(value) && value >= 2) {
      res[tag] = value;
    } else {
      res[tag] = true;
    }
  }

  return res;
}
