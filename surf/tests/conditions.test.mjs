import {
  baseCalibration as c,
  calibrationSchema,
} from "../scripts/convert-calibration-v3.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  scoreConditions,
  tideFit,
  directionExposure,
  compass,
  dateKey,
  interpolateHour,
  lessonWindow,
  tideAt,
} from "../lib/conditions/model.mjs";
import {
  normaliseForecast,
  providerUrls,
} from "../lib/conditions/provider.mjs";
import { predictTides } from "../lib/conditions/tides.mjs";
import { zonedDateTimeToISO } from "../lib/conditions/time.mjs";
const hour = {
  time: Date.parse("2026-09-05T10:00Z"),
  swellHeight: 0.6,
  swellPeriod: 10,
  swellDirection: 270,
  windWaveHeight: 0.1,
  windSpeed: 8,
  windDirection: 90,
  windGusts: 12,
  weatherCode: 1,
  tide: { ratio: 0.5 },
};
test("quality and ability are independent: good bigger waves require advanced skills", () => {
  const small = scoreConditions(hour, c),
    big = scoreConditions({ ...hour, swellHeight: 2 }, c);
  assert.equal(small.quality, "Good");
  assert.equal(small.level, "Beginner");
  assert.equal(big.quality, "Good");
  assert.equal(big.level, "Advanced");
  assert.equal(
    scoreConditions(hour, { ...c, minimumLevel: "Intermediate" }).level,
    "Intermediate",
  );
});
test("missing swell or wind is never treated as calm, good or beginner", () => {
  for (const key of [
    "swellHeight",
    "swellPeriod",
    "swellDirection",
    "windSpeed",
    "windDirection",
  ]) {
    const s = scoreConditions({ ...hour, [key]: null }, c);
    assert.equal(s.score, null);
    assert.equal(s.level, "Not assessed");
  }
  const partial = scoreConditions({ ...hour, tide: null }, c);
  assert.equal(partial.provisional, true);
});
test("Bico changes its preferred tide with swell; Bafureira favours mid-high and more swell", () => {
  const bico = {
    ...c,
    tideRules: [
      { minimumSwell: 0, low: 0, high: 0.35 },
      { minimumSwell: 1.5, low: 0, high: 0.7 },
    ],
  };
  assert.equal(tideFit(0.2, 0.8, bico), 1);
  assert.ok(tideFit(0.6, 0.8, bico) < tideFit(0.6, 2, bico));
  const baf = {
    ...c,
    tideRules: [{ minimumSwell: 0, low: 0.4, high: 1 }],
    minimumSwell: 1.2,
  };
  assert.ok(tideFit(0.1, 2, baf) < tideFit(0.8, 2, baf));
  assert.ok(
    scoreConditions({ ...hour, tide: { ratio: 0.8 } }, baf).score <
      scoreConditions({ ...hour, swellHeight: 1.4, tide: { ratio: 0.8 } }, baf)
        .score,
  );
});
test("strong winds and storms require review even with favourable wave shape", () => {
  for (const patch of [
    { windSpeed: 40 },
    { windGusts: 50 },
    { weatherCode: 95 },
    { swellHeight: 4 },
  ]) {
    const s = scoreConditions({ ...hour, ...patch }, c);
    assert.equal(s.level, "Instructor review");
    assert.ok(s.score <= 25);
  }
});
test("directions wrap correctly and interpolate through north", () => {
  assert.equal(compass(360), "N");
  assert.equal(compass(315), "NW");
  assert.equal(directionExposure(270, c), 1);
  const mid = interpolateHour(
    [
      { ...hour, swellDirection: 359 },
      { ...hour, time: hour.time + 3600000, swellDirection: 1 },
    ],
    hour.time + 1800000,
  );
  assert.equal(mid.swellDirection, 0);
  const absent = interpolateHour(
    [
      { ...hour, swellHeight: null },
      { ...hour, time: hour.time + 3600000 },
    ],
    hour.time + 1800000,
  );
  assert.equal(absent.swellHeight, null);
});
test("lesson assessment includes demanding conditions in the middle, without extrapolating", () => {
  const hours = [
    { ...hour },
    { ...hour, time: hour.time + 3600000, swellHeight: 2 },
    { ...hour, time: hour.time + 7200000 },
  ];
  const forecast = { hours, tides: [] };
  const w = lessonWindow(forecast, new Date(hour.time).toISOString(), 120, c);
  assert.equal(w.requiredLevel, "Advanced");
  assert.equal(w.complete, true);
  assert.equal(w.samples.length, 3);
  const beyond = lessonWindow(
    forecast,
    new Date(hour.time + 86400000).toISOString(),
    90,
    c,
  );
  assert.equal(beyond.worst, null);
  assert.equal(beyond.complete, false);
});
test("normalisation retains missing values and joins by absolute timestamp", () => {
  const marine = {
      hourly: { time: [100, 200], swell_wave_height: [null, 1.2] },
    },
    weather = { hourly: { time: [200, 300], wind_speed_10m: [0, 5] } };
  const rows = normaliseForecast(marine, weather);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].swellHeight, null);
  assert.equal(rows[1].windSpeed, 0);
  assert.equal(rows[1].swellHeight, 1.2);
  const urls = providerUrls({
    calibration: c,
    latitude: -33,
    longitude: 151,
    marineLatitude: -33,
    marineLongitude: 151,
    timezone: "Australia/Sydney",
  });
  assert.equal(urls.marine.searchParams.get("models"), "ncep_gfswave025");
  assert.equal(urls.marine.searchParams.get("forecast_days"), "16");
  assert.equal(urls.weather.searchParams.get("timeformat"), "unixtime");
});
test("worldwide lesson times preserve spot local time and reject DST gaps/ambiguity", () => {
  assert.equal(
    zonedDateTimeToISO("2026-09-05", "10:00", "Europe/Lisbon"),
    "2026-09-05T09:00:00.000Z",
  );
  assert.equal(
    zonedDateTimeToISO("2026-09-05", "10:00", "Australia/Sydney"),
    "2026-09-05T00:00:00.000Z",
  );
  assert.equal(
    dateKey(Date.parse("2026-09-05T12:00Z"), "Pacific/Kiritimati"),
    "2026-09-06",
  );
  assert.throws(
    () => zonedDateTimeToISO("2026-03-29", "01:30", "Europe/Lisbon"),
    /does not exist/,
  );
  assert.throws(
    () => zonedDateTimeToISO("2026-10-25", "01:30", "Europe/Lisbon"),
    /occurs twice/,
  );
});
test("Cascais harmonic prediction covers every day of the full 16-day period", () => {
  const station = JSON.parse(
    fs.readFileSync(new URL("../db/seeds/cascais-tides.json", import.meta.url)),
  );
  const start = Date.parse("2026-09-05T00:00Z"),
    end = start + 16 * 86400000;
  const data = predictTides(station, start, end, c);
  assert.ok(data.tides.length >= 16 * 48);
  assert.ok(data.extremes.length >= 60);
  for (let i = 0; i < 16; i++) {
    const samples = data.tides.filter(
      (p) =>
        p.time >= start + i * 86400000 && p.time < start + (i + 1) * 86400000,
    );
    assert.equal(samples.length, 48);
    assert.ok(samples.every((p) => Number.isFinite(p.height)));
    assert.ok(
      data.extremes.some(
        (p) =>
          p.time >= start + i * 86400000 && p.time < start + (i + 1) * 86400000,
      ),
    );
  }
  for (const e of data.extremes) {
    const at = tideAt(data.tides, e.time, c);
    if (at) assert.ok(Math.abs(at.height - e.height) < 0.04);
  }
  assert.equal(tideAt(data.tides, end + 3600000, c), null);
});

test("global spot profiles select regional tides and reject invalid coordinates", async () => {
  const { validateSpot, nearestTideStation } = await import(
    "../lib/conditions/spot-profile.mjs"
  );
  const input = {
    name: "Global validation",
    region: "New South Wales",
    countryCode: "au",
    timezone: "Australia/Sydney",
    latitude: -33.89,
    longitude: 151.28,
    calibration: { ...c, shoreNormal: 100 },
    breakType: "Beach",
  };
  const profile = validateSpot(input, undefined, calibrationSchema);
  assert.equal(profile.countryCode, "AU");
  assert.equal(profile.timezone, "Australia/Sydney");
  assert.equal(profile.marineLongitude, 151.28);
  assert.ok(nearestTideStation(-33.89, 151.28)?.distance < 50);
  assert.equal(nearestTideStation(0, -140), null);
  for (const latitude of [null, "", " ", false, 86])
    assert.throws(
      () => validateSpot({ ...input, latitude }, undefined, calibrationSchema),
      /latitude/,
    );
  assert.throws(
    () =>
      validateSpot(
        { ...input, timezone: "Invented/TimeZone" },
        undefined,
        calibrationSchema,
      ),
    /time zone/,
  );
  const previous = {
    ...profile,
    calibration: {
      ...profile.calibration,
      exposureByDirection: [
        [0, 0.2],
        [360, 0.2],
      ],
    },
  };
  assert.ok(
    validateSpot(
      { ...input, calibration: previous.calibration },
      previous,
      calibrationSchema,
    ).calibration.exposureByDirection,
  );
});
