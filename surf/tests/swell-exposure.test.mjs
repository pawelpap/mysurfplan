import {
  baseCalibration as defaultCalibration,
  calibrationSchema,
} from "../scripts/convert-calibration-v3.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  scoreConditions,
  directionExposure,
  lessonWindow,
} from "../lib/conditions/model.mjs";
import {
  normaliseForecast,
  providerUrls,
  matchesForecastSource,
  providerVersion,
  hasWaveSignal,
} from "../lib/conditions/provider.mjs";
import { validateSpot } from "../lib/conditions/spot-profile.mjs";
const spots = JSON.parse(
  fs.readFileSync(new URL("./fixtures/calibration-v3.json", import.meta.url)),
).spots;
const bico = spots.find((s) => s.slug === "sao-pedro-bico");
const c = bico.calibration;
const hour = {
  time: Date.parse("2026-09-07T11:00Z"),
  swellHeight: 1.24,
  swellPeriod: 12.5,
  swellDirection: 274,
  windWaveHeight: 0.64,
  windWaveDirection: 327,
  windSpeed: 8,
  windDirection: 0,
  windGusts: 12,
  weatherCode: 0,
  tide: { ratio: 0.25 },
};

test("historical São Pedro migration fixture retains its original exposure behaviour", () => {
  for (const spot of spots.filter((s) => s.slug.startsWith("sao-pedro"))) {
    assert.ok(directionExposure(274, spot.calibration) > 0.6);
    assert.ok(directionExposure(283, spot.calibration) < 0.15);
    assert.ok(directionExposure(290, spot.calibration) <= 0.02);
    const blocked = scoreConditions(
      { ...hour, swellDirection: 300, windWaveHeight: 2 },
      spot.calibration,
    );
    assert.equal(blocked.level, "Too small");
    assert.ok(blocked.surfMax < 0.1);
    assert.ok(blocked.score < 30);
  }
  const monday = scoreConditions(hour, c);
  assert.equal(monday.quality, "Good");
  assert.equal(monday.level, "Intermediate");
  assert.ok(monday.surfMin >= 0.5 && monday.surfMax <= 1);
  const tuesday = scoreConditions(
    { ...hour, swellHeight: 0.84, swellPeriod: 9.85, swellDirection: 282 },
    c,
  );
  assert.equal(tuesday.level, "Too small");
});

test("a usable secondary swell survives a blocked primary, with each component treated independently", () => {
  const blocked = { ...hour, swellHeight: 2, swellDirection: 315 };
  assert.equal(scoreConditions(blocked, c).level, "Too small");
  const mixed = scoreConditions(
    {
      ...blocked,
      secondarySwellHeight: 1.2,
      secondarySwellDirection: 270,
      secondarySwellPeriod: 12,
    },
    c,
  );
  assert.equal(mixed.quality, "Good");
  assert.equal(mixed.level, "Intermediate");
  assert.equal(mixed.swellComponents.length, 2);
  assert.ok(
    mixed.swellComponents[1].localHeight > mixed.swellComponents[0].localHeight,
  );
});

test("flat and very small seas cannot get good scores from favourable wind, tide or period", () => {
  for (const swellHeight of [0, 0.1, 0.29, 0.4]) {
    const result = scoreConditions(
      {
        ...hour,
        swellHeight,
        swellDirection: 270,
        windWaveHeight: 0,
        windSpeed: 0,
      },
      defaultCalibration,
    );
    assert.ok(result.score < 50);
  }
  const result = scoreConditions(
    {
      ...hour,
      swellDirection: 315,
      windWaveDirection: null,
      windWaveHeight: 2,
    },
    c,
  );
  assert.ok(result.score < 30);
});

test("small changes in local surf cannot jump from poor to good at the size thresholds", () => {
  const atHeight = (swellHeight) =>
    scoreConditions(
      {
        ...hour,
        swellHeight,
        swellPeriod: 10,
        swellDirection: 270,
        windWaveHeight: 0,
        windSpeed: 0,
        tide: { ratio: 0.5 },
      },
      defaultCalibration,
    );
  for (const threshold of [0.3, 0.5, 0.65]) {
    const below = atHeight(threshold - 0.001);
    const above = atHeight(threshold + 0.001);
    assert.ok(above.score >= below.score);
    assert.ok(above.score - below.score <= 1);
  }
  assert.equal(atHeight(0.299).quality, "Flat / too small");
  assert.equal(atHeight(0.499).quality, "Poor");
  assert.notEqual(atHeight(0.501).quality, "Good");
  assert.equal(atHeight(0.65).quality, "Good");
});

test("swell components and wind-wave direction survive normalisation and a lesson between forecast hours", () => {
  const marine = {
    hourly: {
      time: [100],
      secondary_swell_wave_height: [1.2],
      secondary_swell_wave_direction: [270],
      tertiary_swell_wave_period: [15],
      wind_wave_direction: [320],
    },
  };
  const [normal] = normaliseForecast(marine, null);
  assert.equal(normal.secondarySwellHeight, 1.2);
  assert.equal(normal.windWaveDirection, 320);
  const h = {
    ...hour,
    swellDirection: 315,
    secondarySwellHeight: 1.2,
    secondarySwellDirection: 270,
    secondarySwellPeriod: 12,
  };
  const result = lessonWindow(
    { hours: [h, { ...h, time: h.time + 3600000 }], tides: [] },
    new Date(h.time + 900000).toISOString(),
    30,
    c,
  );
  assert.equal(result.complete, true);
  assert.equal(result.requiredLevel, "Intermediate");
  assert.equal(result.start.swellComponents.length, 2);
});

test("the configured wave model and sample point invalidate incompatible cached forecasts", () => {
  const urls = providerUrls(bico);
  assert.equal(urls.marine.searchParams.get("models"), "ncep_gfswave016");
  assert.equal(urls.marine.searchParams.get("forecast_days"), "16");
  assert.ok(
    urls.marine.searchParams.get("hourly").includes("wind_wave_direction"),
  );
  const payload = {
    providerVersion,
    marineModel: "ncep_gfswave016",
    sampleLatitude: bico.marineLatitude,
    sampleLongitude: bico.marineLongitude,
  };
  assert.equal(matchesForecastSource(payload, bico), true);
  for (const patch of [
    { providerVersion: 1 },
    { marineModel: "ncep_gfswave025" },
    { sampleLatitude: 38.5 },
  ])
    assert.equal(matchesForecastSource({ ...payload, ...patch }, bico), false);
});

test("admin calibration validates directional curves and wave model coverage", () => {
  const input = {
    ...bico,
    shoreNormal: c.shoreNormal,
    marineModel: c.marineModel,
    exposureByDirection: JSON.stringify(c.exposureByDirection),
  };
  assert.deepEqual(
    validateSpot({ ...input, calibration: c }, bico, calibrationSchema)
      .calibration.exposureByDirection,
    c.exposureByDirection,
  );
  assert.throws(
    () =>
      validateSpot(
        { ...input, calibration: c, latitude: 60 },
        undefined,
        calibrationSchema,
      ),
    /covers/,
  );
  for (const curve of [
    "no",
    [
      [0, 0],
      [360, 1],
    ],
    [
      [0, 0],
      [300, 1],
      [200, 1],
      [360, 0],
    ],
    [
      [0, 0],
      [200, 2],
      [360, 0],
    ],
    [
      [0, null],
      [360, null],
    ],
  ]) {
    assert.throws(
      () =>
        validateSpot(
          { ...input, calibration: { ...c, exposureByDirection: curve } },
          undefined,
          calibrationSchema,
        ),
      /exposure|must|north|entries|setting/,
    );
  }
});

test("neighbouring Caparica beaches share São João's established input, retaining separate local profiles", () => {
  const joao = spots.find((s) => s.slug === "sao-joao-caparica"),
    cornelia = spots.find((s) => s.slug === "cornelia-caparica");
  assert.equal(joao.marineLatitude, 38.66);
  assert.equal(joao.marineLongitude, -9.37);
  assert.equal(
    providerUrls(joao).marine.toString(),
    providerUrls(cornelia).marine.toString(),
  );
  assert.notEqual(
    joao.calibration.shoreNormal,
    cornelia.calibration.shoreNormal,
  );
});

test("zero-filled wave grids are unavailable, while a real forecast can contain flat hours", () => {
  assert.equal(
    hasWaveSignal({
      hourly: {
        wave_height: [0, 0],
        swell_wave_height: [0, 0],
        wind_wave_height: [0, 0],
      },
    }),
    false,
  );
  assert.equal(hasWaveSignal({ hourly: { wave_height: [null, null] } }), false);
  assert.equal(hasWaveSignal({ hourly: { wave_height: [0, 0.2, 0] } }), true);
  assert.equal(hasWaveSignal({ hourly: { wind_wave_height: [0, 0.3] } }), true);
});
