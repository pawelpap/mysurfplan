import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { scoreConditions, directionExposure, clamp } from "../lib/conditions/model.mjs";
import { validateCalibration } from "../lib/conditions/calibration.mjs";
import { trialCalibration, caparicaSlugs } from "../scripts/small-wave-trial.mjs";
const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const spots = read("./fixtures/small-wave-baseline-20260917.json");
const observation = read("./fixtures/caparica-observation-20260917.json");
const schema = read("../db/seeds/calibration-schema-v3.json");

// Controlled conditions isolate small-wave scoring. At sheltered spots select
// a direction that also satisfies the spot's offshore minimum-swell rule.
function localHeightHour(c, height, period = 13) {
  const factor = clamp((period / c.periodReference) ** c.periodExponent, c.periodFactorMin, c.periodFactorMax);
  const directions = Array.from({ length: 360 }, (_, i) => (c.shoreNormal + i) % 360);
  const direction = directions.find((d) => height / (c.swellGain * directionExposure(d, c) * factor) >= c.minimumSwell);
  const swellHeight = height / (c.swellGain * directionExposure(direction, c) * factor);
  const rule = c.tideRules.filter((r) => swellHeight >= r.minimumSwell).at(-1);
  return { swellHeight, swellDirection: direction, swellPeriod: period,
    windWaveHeight: 0, windWaveDirection: direction,
    windSpeed: 2, windGusts: 3, windDirection: (c.shoreNormal + 180) % 360,
    weatherCode: 0, tide: { ratio: (rule.low + rule.high) / 2 } };
}

test("all 17 spots allow clean 0.3–0.6 m and 0.6–0.9 m surf to be Good when local requirements are met", () => {
  assert.equal(spots.length, 17);
  for (const spot of spots) {
    const c = validateCalibration(trialCalibration(spot.calibration_config, spot.slug), schema);
    for (const height of [0.45, 0.75]) {
      const result = scoreConditions(localHeightHour(c, height), c);
      assert.equal(result.quality, "Good", `${spot.slug} at ${height}`);
      assert.ok(result.score >= 75);
    }
  }
});
test("small waves do not override flat, severe, wind, period, missing-data or local minimum-swell constraints", () => {
  for (const spot of spots) {
    const c = trialCalibration(spot.calibration_config, spot.slug);
    const clean = localHeightHour(c, 0.45);
    const result = scoreConditions(clean, c);
    const flat = scoreConditions(localHeightHour(c, 0.2), c);
    assert.equal(flat.quality, "Flat / too small");
    assert.ok(flat.score < 30);
    for (const change of [{ windSpeed: 40, windGusts: 40 }, { windGusts: 50 }, { weatherCode: 95 }]) {
      const severe = scoreConditions({ ...clean, ...change }, c);
      assert.equal(severe.level, "Instructor review");
      assert.ok(severe.score <= c.severe.scoreCap);
    }
    const onshore = scoreConditions({ ...clean, windDirection: c.shoreNormal, windSpeed: 30, windGusts: 32 }, c);
    assert.ok(onshore.score < 75 && onshore.score < result.score, spot.slug);
    assert.ok(scoreConditions(localHeightHour(c, 0.45, 6), c).score < result.score);
    assert.equal(scoreConditions({ ...clean, swellHeight: null }, c).quality, "Unavailable");
    assert.equal(scoreConditions(localHeightHour(c, 3), c).level, "Instructor review");
    if (c.minimumSwell > 0) {
      const smallOffshore = { ...clean, swellHeight: c.minimumSwell / 2 };
      assert.ok(scoreConditions(smallOffshore, c).reasons.some((r) => r.includes("too small for this break")));
    }
  }
});
test("only reviewed fields change and non-Caparica physical estimates and skill advice remain identical", () => {
  for (const spot of spots) {
    const before = spot.calibration_config, after = trialCalibration(before, spot.slug);
    const changed = Object.keys(before).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).sort();
    assert.deepEqual(changed, caparicaSlugs.includes(spot.slug) ? ["directionSpread", "sizeCeilingCurve"] : ["sizeCeilingCurve"]);
    if (caparicaSlugs.includes(spot.slug)) continue;
    for (const height of [0.15, 0.3, 0.45, 0.6, 0.75, 1.5, 3]) {
      for (const period of [6, 10, 13, 17]) {
        const h = localHeightHour(before, height, period);
        const a = scoreConditions(h, before), b = scoreConditions(h, after);
        for (const key of ["surfMin", "surfMax", "level", "windType", "swellComponents", "windSeaSurf"])
          assert.deepEqual(b[key], a[key], `${spot.slug}: ${key}`);
        assert.ok(b.score >= a.score);
        if (height >= 0.65 || height < 0.3) assert.equal(b.score, a.score);
      }
    }
  }
});
test("Caparica trial treats both beaches consistently and replays the observed morning without date overrides", () => {
  for (const run of observation.runs) {
    const spot = spots.find((s) => s.slug === run.slug);
    const c = trialCalibration(spot.calibration_config, spot.slug);
    assert.equal(c.directionSpread, 95);
    for (const h of run.hours) {
      const result = scoreConditions(h, c);
      assert.deepEqual(result, scoreConditions({ ...h, time: h.time + 100 * 86400000 }, c));
      if (new Date(h.time).getUTCHours() < 10) assert.equal(result.quality, "Good");
      else assert.ok(result.score < 75, "The weaker noon forecast must not become Good");
    }
    // Directly exposed swell and the fully sheltered opposite direction do not change.
    for (const direction of [c.shoreNormal, (c.shoreNormal + 180) % 360])
      assert.equal(directionExposure(direction, c), directionExposure(direction, spot.calibration_config));
  }
});
test("unknown local settings are rejected instead of silently overwritten", () => {
  const c = spots[0].calibration_config;
  assert.throws(() => trialCalibration({ ...c, flatSurfBelow: 0.5 }, "custom"));
  assert.throws(() => trialCalibration({ ...c, sizeCeilingCurve: [[0, 0], [1, 100]] }, "custom"));
});
