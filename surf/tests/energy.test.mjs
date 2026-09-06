import test from "node:test";
import assert from "node:assert/strict";
import { swellEnergy } from "../lib/conditions/energy.mjs";
import {
  scoreConditions,
  interpolateHour,
  lessonWindow,
} from "../lib/conditions/model.mjs";
import {
  normaliseForecast,
  providerUrls,
  providerVersion,
} from "../lib/conditions/provider.mjs";
import { baseCalibration } from "../scripts/convert-calibration-v3.mjs";
const base = {
  swellHeight: 1,
  swellPeriod: 10,
  secondarySwellHeight: 0,
  tertiarySwellHeight: 0,
};
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
test("reference energy and power have correct units, square-height and linear-period scaling", () => {
  const a = swellEnergy(base);
  close(a.energyKjM2, 0.628238515625);
  close(a.powerKwM, (1025 * 9.80665 ** 2 * 10) / (64 * Math.PI) / 1000);
  const b = swellEnergy({ ...base, swellHeight: 2 });
  close(b.energyKjM2, 4 * a.energyKjM2);
  close(b.powerKwM, 4 * a.powerKwM);
  const c = swellEnergy({ ...base, swellPeriod: 20 });
  close(c.energyKjM2, a.energyKjM2);
  close(c.powerKwM, 2 * a.powerKwM);
  assert.ok(a.complete);
});
test("independent partitions add without counting total wave height or wind sea", () => {
  const a = swellEnergy(base),
    b = swellEnergy({
      ...base,
      secondarySwellHeight: 1,
      secondarySwellPeriod: 10,
      tertiarySwellHeight: 2,
      tertiarySwellPeriod: 5,
      waveHeight: 100,
      windWaveHeight: 100,
    });
  close(b.energyKjM2, 6 * a.energyKjM2);
  close(b.powerKwM, 4 * a.powerKwM);
});
test("missing, negative and non-finite inputs stay unavailable or explicitly partial; zero height is valid", () => {
  for (const x of [undefined, null, -1, NaN, Infinity]) {
    const a = swellEnergy({ swellHeight: x });
    assert.equal(a.energyKjM2, null);
    assert.equal(a.powerKwM, null);
    assert.equal(a.complete, false);
  }
  assert.equal(
    swellEnergy({ swellHeight: 1, swellPeriod: 10 }).complete,
    false,
  );
  const noPeriod = swellEnergy({ ...base, swellPeriod: 0 });
  assert.ok(noPeriod.energyKjM2 > 0);
  assert.equal(noPeriod.powerKwM, null);
  const zero = swellEnergy({ ...base, swellHeight: 0, swellPeriod: null });
  assert.equal(zero.energyKjM2, 0);
  assert.equal(zero.powerKwM, 0);
  assert.equal(zero.complete, true);
});
test("SST joins by UTC timestamp, preserves nulls and cannot extend the forecast timeline", () => {
  const marine = {
    hourly: { time: [0, 3600, 7200], swell_wave_height: [1, 2, 3] },
  };
  const water = {
    hourly: {
      time: [3600, 7200, 10800],
      sea_surface_temperature: [18, null, 20],
    },
  };
  const h = normaliseForecast(marine, null, water);
  assert.deepEqual(
    h.map((x) => x.waterTemperature),
    [null, 18, null],
  );
  assert.equal(h.length, 3);
  assert.deepEqual(
    normaliseForecast(marine, null, null).map((x) => x.waterTemperature),
    [null, null, null],
  );
  const u = providerUrls(
    {
      latitude: 38,
      longitude: -9,
      marineLatitude: 37,
      marineLongitude: -10,
      timezone: "Europe/Lisbon",
      calibration: baseCalibration,
    },
    "test-key",
  );
  assert.equal(u.water.searchParams.get("models"), null);
  assert.equal(u.water.searchParams.get("latitude"), "38");
  assert.equal(u.water.searchParams.get("apikey"), "test-key");
  assert.equal(u.water.searchParams.get("hourly"), "sea_surface_temperature");
  assert.equal(providerVersion, 3);
});
test("selected-time and lesson calculations agree, never interpolate missing SST or change quality", () => {
  const start = Date.parse("2026-09-07T10:00Z");
  const raw = {
    ...base,
    swellDirection: 270,
    windSpeed: 10,
    windDirection: 90,
    weatherCode: 0,
    temperature: 24,
  };
  const hours = [
    { ...raw, time: start, waterTemperature: 18 },
    { ...raw, time: start + 3600000, swellHeight: 2, waterTemperature: 20 },
    { ...raw, time: start + 7200000, waterTemperature: null },
  ];
  const h = interpolateHour(hours, start + 1800000);
  assert.equal(h.waterTemperature, 19);
  assert.equal(h.swellHeight, 1.5);
  const s = scoreConditions(h, baseCalibration),
    w = lessonWindow(
      { hours, tides: [] },
      new Date(h.time).toISOString(),
      30,
      baseCalibration,
    );
  assert.deepEqual(s.energy, w.start.energy);
  assert.equal(w.start.waterTemperature, 19);
  assert.equal(interpolateHour(hours, start + 5400000).waterTemperature, null);
  assert.equal(
    s.score,
    scoreConditions({ ...h, waterTemperature: 5 }, baseCalibration).score,
  );
  assert.ok(
    scoreConditions({ ...h, windSpeed: null }, baseCalibration).energy
      .energyKjM2 > 0,
  );
});
