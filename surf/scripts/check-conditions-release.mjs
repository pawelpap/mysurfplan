import assert from "node:assert/strict";
import {
  interpolateHour,
  scoreConditions,
  tideAt,
  dateKey,
} from "../lib/conditions/model.mjs";
import { checkConditionsBrowser } from "./check-conditions-browser.mjs";
const base = process.argv[2];
assert.ok(
  base && process.env.MWP_TEST_EMAIL && process.env.MWP_TEST_PASSWORD,
  "Provide the base URL, MWP_TEST_EMAIL and MWP_TEST_PASSWORD; this creates and cleans one verification session.",
);
const headers = {
  "Content-Type": "application/json",
  "X-MyWavePlan-Request": "1",
};
const login = await fetch(base + "/api/auth/login", {
  method: "POST",
  headers,
  body: JSON.stringify({
    email: process.env.MWP_TEST_EMAIL,
    password: process.env.MWP_TEST_PASSWORD,
  }),
});
assert.equal(login.status, 200, "student login");
const cookie = login.headers
  .getSetCookie()
  .map((v) => v.split(";")[0])
  .join("; ");
const auth = { ...headers, Cookie: cookie };
const json = async (url) => {
  const r = await fetch(base + url, { headers: auth });
  assert.equal(r.status, 200, url);
  return (await r.json()).data;
};
try {
  const session = await json("/api/auth/session");
  assert.equal(session.role, "student");
  const spots = await json("/api/spots");
  assert.equal(spots.length, 17);
  const spot = spots.find((s) => s.name.includes("Bico"));
  assert.ok(spot);
  const forecast = await json("/api/conditions?spot=" + spot.id);
  assert.equal(forecast.dates.length, 16);
  const t =
    forecast.hours.find(
      (h) => dateKey(h.time, spot.timezone) === forecast.dates[1],
    ).time +
    9.37 * 3600000;
  const summary = await json(`/api/conditions/summary?spot=${spot.id}&at=${t}`);
  const raw = interpolateHour(forecast.hours, t);
  const h = {
    ...raw,
    tide: tideAt(forecast.tides, t, forecast.spot.calibration),
  };
  const expected = scoreConditions(h, forecast.spot.calibration);
  for (const field of [
    "quality",
    "tone",
    "level",
    "surfMin",
    "surfMax",
    "score",
  ])
    assert.deepEqual(summary.condition[field], expected[field], field);
  assert.equal(summary.at, t);
  assert.ok(!summary.spot && !summary.hours && !summary.calibration);
  assert.ok(JSON.stringify(summary).length < 1800);
  assert.equal(
    (await fetch(base + `/api/conditions/summary?spot=${spot.id}`)).status,
    401,
  );
  assert.equal(
    (
      await fetch(base + `/api/conditions/summary?spot=${spot.id}&at=0`, {
        headers: auth,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await fetch(base + "/api/spots", {
        method: "POST",
        headers: auth,
        body: "{}",
      })
    ).status,
    403,
  );
  console.log(
    JSON.stringify({
      environment: base,
      checks: 8,
      spots: spots.length,
      days: forecast.dates.length,
      summaryBytes: JSON.stringify(summary).length,
      summaryMatchesDetailedAssessment: true,
      studentSpotWriteDenied: true,
    }),
  );
  await checkConditionsBrowser({ base, cookie });
} finally {
  await fetch(base + "/api/auth/session", { method: "DELETE", headers: auth });
}
