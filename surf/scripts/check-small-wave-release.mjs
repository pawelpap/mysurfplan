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
try {
  const spots = await read("/api/spots");
  assert.equal(spots.length, 17);
  for (const slug of ["cornelia-caparica", "sao-joao-caparica", "sao-pedro-bico", "praia-grande-sintra", "carcavelos"]) {
    const forecast = await read("/api/conditions?spot=" + slug);
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
  assert.equal((await fetch(base + "/api/conditions?spot=cornelia-caparica")).status, 401);
  assert.equal((await fetch(base + "/api/spots", { method: "POST", headers: auth, body: "{}" })).status, 403);
  result.permissionsVerified = true;
  if (output) await fs.writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ base, spots: result.spots.map((s) => ({ slug: s.slug, hours: s.hours, issues: s.issues, firstWindows: s.windows.slice(0, 3) })), permissionsVerified: true }));
} finally {
  const logout = await fetch(base + "/api/auth/session", { method: "DELETE", headers: auth });
  assert.equal(logout.status, 200);
}
