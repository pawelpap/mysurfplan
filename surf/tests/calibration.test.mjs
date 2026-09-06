import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { scoreConditions, tideFit } from "../lib/conditions/model.mjs";
import { scoreConditions as legacy } from "./fixtures/legacy-model.mjs";
import {
  convertCalibration,
  baseCalibration,
  calibrationSchema,
} from "../scripts/convert-calibration-v3.mjs";
import { validateCalibration } from "../lib/conditions/calibration.mjs";
const spots = JSON.parse(
  fs.readFileSync(new URL("../db/seeds/portugal-spots.json", import.meta.url)),
);
test("generic database configuration preserves every existing spot across 5,712 direction/height/tide cases", () => {
  for (const spot of spots) {
    const c = validateCalibration(
      convertCalibration(spot.calibration),
      calibrationSchema,
    );
    for (const dir of [0, 45, 46, 180, 270, 274, 282, 283, 290, 315, 316, 360])
      for (const height of [0, 0.2, 0.5, 1, 1.5, 2, 4])
        for (const tide of [0, 0.35, 0.6, 1]) {
          const h = {
            swellHeight: height,
            swellPeriod: 12.5,
            swellDirection: dir,
            windWaveHeight: 0.3,
            windWaveDirection: dir,
            windDirection: dir,
            windSpeed: 16,
            windGusts: 20,
            weatherCode: 0,
            tide: { ratio: tide },
          };
          const a = legacy(h, spot.calibration),
            b = scoreConditions(h, c);
          for (const k of [
            "score",
            "quality",
            "level",
            "surfMin",
            "surfMax",
            "windType",
          ])
            assert.equal(
              b[k],
              a[k],
              `${spot.slug} ${k} ${dir} ${height} ${tide}`,
            );
        }
  }
});
test("configuration requires complete finite settings and rejects malformed or inconsistent rules", () => {
  for (const change of [
    (c) => delete c.weights,
    (c) => (c.swellGain = NaN),
    (c) => (c.unknownSetting = 1),
    (c) => (c.weights.height = 0.8),
    (c) => (c.tideRules[0].low = 0.9),
    (c) =>
      (c.windDirectionCurve = [
        [0, 1],
        [360, 0],
      ]),
    (c) => c.qualityBands.reverse(),
    (c) => c.experienceRules.reverse(),
  ]) {
    const c = structuredClone(baseCalibration);
    change(c);
    assert.throws(() => validateCalibration(c, calibrationSchema));
  }
  assert.throws(() => scoreConditions({}, null), /database calibration/);
});
test("new tide ranges and wind shelter work through configuration alone", () => {
  const c = structuredClone(baseCalibration);
  c.tideRules = [
    { minimumSwell: 0, low: 0.8, high: 1 },
    { minimumSwell: 2, low: 0.3, high: 0.6 },
  ];
  c.windSectors = [{ from: 90, to: 180, gain: 0.5 }];
  validateCalibration(c, calibrationSchema);
  assert.equal(tideFit(0.9, 1, c), 1);
  assert.ok(tideFit(0.9, 3, c) < 1);
  assert.equal(tideFit(0.4, 3, c), 1);
  const h = {
    swellHeight: 1,
    swellDirection: 270,
    swellPeriod: 10,
    windSpeed: 30,
    windDirection: 135,
    tide: { ratio: 0.9 },
  };
  assert.ok(
    scoreConditions(h, c).score >
      scoreConditions(h, { ...c, windSectors: [] }).score,
  );
});
