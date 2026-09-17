import test from "node:test";
import assert from "node:assert/strict";
import { forecastSnapshot, archiveRetentionDays } from "../lib/conditions/archive.mjs";
const now = Date.parse("2026-09-17T10:17:00Z");
const spot = { id: "test", version: 5, calibration: { example: true } };
const row = { fetched_at: new Date(now - 1000).toISOString(), payload: { issues: [], hours: [-1, 1, 2].map((offset) => ({ time: now + offset * 3600000, swellHeight: 1, windSpeed: 4, windDirection: 30 })) } };

test("archives preserve retrieval/configuration provenance and only future valid hours", () => {
  const original = structuredClone(row);
  const result = forecastSnapshot(spot, row, { harmonics: "test" }, now);
  assert.equal(result.sampleSlot, "2026-09-17T06:00:00.000Z");
  assert.equal(result.retrievedAt, row.fetched_at);
  assert.equal(result.providerIssuedAt, null);
  assert.equal(result.payload.hours.length, 2);
  assert(result.payload.hours.every((h) => h.time > Date.parse(result.recordedAt)));
  assert.equal(Date.parse(result.expiresAt) - now, archiveRetentionDays * 86400000);
  assert.deepEqual(result.spot.calibration, spot.calibration);
  assert.deepEqual(row, original);
});
test("stale/retained, future-dated, partial and past-only forecasts cannot become as-issued samples", () => {
  for (const invalid of [
    { ...row, fetched_at: new Date(now - 120000).toISOString() },
    { ...row, fetched_at: new Date(now + 1000).toISOString() },
    { ...row, payload: { ...row.payload, issues: ["weather missing"] } },
    { ...row, payload: { ...row.payload, hours: [row.payload.hours[0]] } },
    { ...row, fetched_at: null },
  ]) assert.equal(forecastSnapshot(spot, invalid, null, now), null);
});
