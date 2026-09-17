import assert from "node:assert/strict";

// Deployment-only data revision. Runtime coefficients remain in PostgreSQL.
export const trialId = "20260917_small_wave_trial";
export const sizeCeilingCurve = [[0, 0], [0.3, 25], [0.4, 85], [0.5, 100]];
export const caparicaSlugs = ["cornelia-caparica", "sao-joao-caparica"];
export const changeNote = "17 September 2026 owner-approved calibration trial: permit favourable ratings for clean small surf across the catalogue. Size ceiling 25 at 0.3 m central height, 85 at 0.4 m and 100 at 0.5 m. Preserve flat, severe, wind, tide, period and minimum-swell rules. Caparica only: trial a 95-degree directional spread at both comparable beaches, preserving distinct shoreline normals and gains. Cornelia's 08:00-09:00 clean 0.6-0.9 m session is one subjective observation, not measured validation. Owner authorised production after successful staging checks and Surfline comparison.";

export function trialCalibration(configuration, slug) {
  const c = structuredClone(configuration);
  assert.equal(c.flatSurfBelow, 0.3, "Review spots with a different flat threshold individually");
  assert([
    [[0, 0], [0.3, 25], [0.5, 49], [0.65, 100]],
    [[0, 0], [0.3, 25], [0.45, 60], [0.65, 100]],
  ].some((curve) => JSON.stringify(curve) === JSON.stringify(c.sizeCeilingCurve)),
  "Do not overwrite an unreviewed size curve");
  c.sizeCeilingCurve = structuredClone(sizeCeilingCurve);
  if (caparicaSlugs.includes(slug)) {
    assert.equal(c.directionSpread, 85);
    assert.deepEqual(c.exposureByDirection, []);
    c.directionSpread = 95;
  }
  return c;
}
