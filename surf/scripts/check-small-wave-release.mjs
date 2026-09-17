import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { scoreConditions } from "../lib/conditions/model.mjs";
import { bestDayWindow } from "../lib/conditions/day-window.mjs";
const [base, output] = process.argv.slice(2);
assert(["https://staging.mywaveplan.com", "https://mywaveplan.com", "http://localhost:3000"].includes(base));
const headers = { "Content-Type": "application/json", "X-MyWavePlan-Request": "1", Origin: base };
const login = await fetch(base + "/api/auth/login", { method: "POST", headers, body: JSON.stringify({ email: "", password: "" }) });
assert.equal(login.status, 200);
const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const auth = { ...headers, Cookie: cookie };
const read = async (path) => {
  const response = await fetch(base + path, { headers: auth, signal: AbortSignal.timeout(120000) });
  assert.equal(response.status, 200, path);
  return (await response.json()).data;
};
const result = { base, checkedAt: new Date().toISOString(), spots: [] };
const forecasts = [];
try {
  const spots = await read("/api/spots");
  assert.equal(spots.length, 17);
  for (const slug of ["cornelia-caparica", "sao-joao-caparica", "sao-pedro-bico", "sao-pedro-bafureira", "praia-grande-sintra", "carcavelos"]) {
    const forecast = await read("/api/conditions?spot=" + slug);
    forecasts.push(forecast);
    assert.equal(forecast.dates.length, 16);
    assert.deepEqual(forecast.spot.calibration.sizeCeilingCurve, [[0, 0], [0.3, 25], [0.4, 85], [0.5, 100]]);
    for (const h of forecast.hours) {
      const expected = scoreConditions(h, forecast.spot.calibration);
      for (const key of ["score", "quality", "tone", "level", "surfMin", "surfMax"]) assert.deepEqual(h[key], expected[key], `${slug}: ${key}`);
    }
    const windows = forecast.dates.map((day) => {
      const w = bestDayWindow(forecast.hours, day, forecast.spot.timezone, forecast.sunlight.find((s) => s.day === day));
      return { day, time: w?.label || null, score: w?.condition.score ?? null, quality: w?.condition.quality || null, surf: w ? [w.condition.surfMin, w.condition.surfMax] : null };
    });
    result.spots.push({ slug, version: forecast.spot.version, fetchedAt: forecast.fetchedAt, issues: forecast.issues, hours: forecast.hours.length, windows });
  }
  result.comparisonDays = [];
  for (const day of [forecasts[0].dates[0], forecasts[0].dates[2], forecasts[0].dates[3]]) {
    const summaries = await read(`/api/conditions/summaries?spots=${forecasts.map((f) => f.spot.id).join(",")}&day=${day}`);
    for (const forecast of forecasts) {
      const summary = summaries[forecast.spot.id];
      const expected = bestDayWindow(forecast.hours, day, forecast.spot.timezone, forecast.sunlight.find((s) => s.day === day));
      assert.equal(summary.day, day);
      assert.equal(summary.timing, "window");
      assert.deepEqual(summary.window, expected ? { start: expected.start, end: expected.end, label: expected.label } : null);
      for (const field of ["score", "quality", "tone", "level", "surfMin", "surfMax", "windSpeed", "energy"])
        assert.deepEqual(summary.condition?.[field], expected?.condition[field], `${forecast.spot.slug}: summary ${field}`);
      assert.equal(summary.calibration, undefined);
      assert.equal(summary.hours, undefined);
    }
    result.comparisonDays.push({ day, spots: forecasts.length, exactWindowParity: true });
  }
  assert.equal((await fetch(base + "/api/conditions/summaries?spots=cornelia-caparica&day=2026-02-30", { headers: auth })).status, 400);
  assert.equal((await fetch(base + "/api/conditions?spot=cornelia-caparica")).status, 401);
  assert.equal((await fetch(base + "/api/spots", { method: "POST", headers: auth, body: "{}" })).status, 403);
  result.permissionsVerified = true;
  if (output) await fs.writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ base, spots: result.spots.map((s) => ({ slug: s.slug, hours: s.hours, issues: s.issues, firstWindows: s.windows.slice(0, 3) })), comparisonDays: result.comparisonDays, permissionsVerified: true }));
} finally {
  const logout = await fetch(base + "/api/auth/session", { method: "DELETE", headers: auth });
  assert.equal(logout.status, 200);
}
