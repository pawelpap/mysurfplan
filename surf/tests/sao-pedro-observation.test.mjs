import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  scoreConditions,
  directionExposure,
  tideFit,
  lessonWindow,
} from "../lib/conditions/model.mjs";
import { validateCalibration } from "../lib/conditions/calibration.mjs";

// Historical fixtures remain frozen for migration parity. This observation
// records a later database revision; neither fixture is imported by the app.
const historical = JSON.parse(
  fs.readFileSync(new URL("./fixtures/calibration-v3.json", import.meta.url)),
).spots;
const observation = JSON.parse(
  fs.readFileSync(
    new URL("./fixtures/sao-pedro-observation-20260906.json", import.meta.url),
  ),
);
const schema = JSON.parse(
  fs.readFileSync(
    new URL("../db/seeds/calibration-schema-v3.json", import.meta.url),
  ),
);
const configs = Object.fromEntries(
  observation.slugs.map((slug) => [
    slug,
    validateCalibration(
      {
        ...historical.find((s) => s.slug === slug).calibration,
        ...observation.changes,
      },
      schema,
    ),
  ]),
);
// The screenshot's tide is just above the low. Wind bearing and weather are
// controlled test inputs, not additional observations from the screenshot.
const hour = {
  time: Date.parse("2026-09-08T07:00Z"),
  swellHeight: 0.9,
  swellPeriod: 10,
  swellDirection: 283,
  windSpeed: 16,
  windDirection: 0,
  windGusts: 34,
  windWaveHeight: 0,
  windWaveDirection: 320,
  weatherCode: 0,
  tide: { ratio: 0.05 },
};

test("observed 283-degree swell remains rideable without becoming universally Good", () => {
  for (const slug of ["sao-pedro-estoril", "sao-pedro-bico"]) {
    const result = scoreConditions(hour, configs[slug]);
    assert.equal(result.surfMin, 0.3);
    assert.equal(result.surfMax, 0.6);
    assert.equal(result.quality, "Fair");
    assert.ok(result.score >= 50 && result.score < 75);
  }
  const baf = scoreConditions(hour, configs["sao-pedro-bafureira"]);
  assert.equal(baf.quality, "Poor");
  assert.equal(baf.level, "Intermediate");
  assert.ok(baf.surfMax >= 0.5);
});

test("Bico and Bafureira retain their distinct tide, size and experience rules", () => {
  const bico = configs["sao-pedro-bico"],
    baf = configs["sao-pedro-bafureira"];
  for (const [slug, c] of Object.entries(configs)) {
    const old = historical.find((s) => s.slug === slug).calibration;
    for (const key of Object.keys(old).filter(
      (k) => !(k in observation.changes),
    ))
      assert.deepEqual(c[key], old[key], `${slug}: ${key}`);
  }
  assert.equal(tideFit(0.1, 0.9, bico), 1);
  assert.ok(tideFit(0.6, 0.9, bico) < tideFit(0.6, 1.6, bico));
  assert.ok(tideFit(0.1, 0.9, baf) < tideFit(0.6, 0.9, baf));
  assert.ok(
    scoreConditions({ ...hour, tide: { ratio: 0.6 } }, baf).score >
      scoreConditions(hour, baf).score,
  );
  assert.equal(scoreConditions(hour, bico).level, "Intermediate");
});

test("directional shelter and genuinely flat conditions remain intact", () => {
  for (const c of Object.values(configs)) {
    for (const direction of [290, 295, 300, 315]) {
      assert.ok(directionExposure(direction, c) <= 0.02);
      const result = scoreConditions(
        {
          ...hour,
          swellHeight: 2,
          swellPeriod: 16,
          swellDirection: direction,
          windWaveHeight: 1,
          windWaveDirection: direction,
          windSpeed: 0,
          windGusts: 0,
        },
        c,
      );
      assert.equal(result.quality, "Flat / too small");
      assert.ok(result.score < 30);
    }
    const flat = scoreConditions(
      { ...hour, swellHeight: 0.2, swellDirection: 270, windSpeed: 0 },
      c,
    );
    assert.equal(flat.quality, "Flat / too small");
    assert.ok(flat.score < 30);
    const larger = scoreConditions(
      { ...hour, swellHeight: 4, swellDirection: 270, windGusts: 0 },
      c,
    );
    assert.ok(["Advanced", "Instructor review"].includes(larger.level));
  }
});

test("updated curves interpolate smoothly and usable secondary swells still reach the spot", () => {
  for (const c of Object.values(configs)) {
    let previous = directionExposure(270, c);
    for (let d = 270.01; d <= 300; d += 0.01) {
      const exposure = directionExposure(d, c);
      assert.ok(exposure <= previous + 1e-12);
      assert.ok(previous - exposure < 0.002);
      previous = exposure;
    }
    for (const surf of [0.3, 0.45, 0.65]) {
      const at = (height) =>
        scoreConditions(
          {
            ...hour,
            swellHeight: height / (c.swellGain * directionExposure(270, c)),
            swellDirection: 270,
          },
          c,
        );
      assert.ok(
        Math.abs(at(surf + 0.0001).score - at(surf - 0.0001).score) <= 1,
      );
    }
    const mixed = scoreConditions(
      {
        ...hour,
        swellHeight: 2,
        swellDirection: 315,
        secondarySwellHeight: 0.9,
        secondarySwellPeriod: 10,
        secondarySwellDirection: 283,
      },
      c,
    );
    assert.notEqual(mixed.level, "Too small");
    assert.equal(
      mixed.swellComponents.find((s) => s.name === "Secondary").exposure,
      0.68,
    );
  }
});

test("calibration depends on conditions, not the forecast date, and lesson results match", () => {
  for (const c of Object.values(configs)) {
    assert.deepEqual(
      scoreConditions(hour, c),
      scoreConditions({ ...hour, time: Date.parse("2027-02-12T07:00Z") }, c),
    );
    const tides = [
      { time: hour.time - 3600000, height: 0 },
      { time: hour.time, height: 0.05 },
      { time: hour.time + 3600000, height: 0.05 },
      { time: hour.time + 7200000, height: 1 },
    ];
    const forecast = {
      hours: [hour, { ...hour, time: hour.time + 3600000 }],
      tides,
    };
    const lesson = lessonWindow(
      forecast,
      new Date(hour.time).toISOString(),
      60,
      c,
    );
    assert.equal(lesson.complete, true);
    assert.equal(lesson.start.score, scoreConditions(hour, c).score);
    assert.equal(lesson.start.surfMax, scoreConditions(hour, c).surfMax);
  }
});
