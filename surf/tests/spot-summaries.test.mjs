import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { spotSummaryTime, sunlightForDay } from "../lib/conditions/sunlight.mjs";
import { dateKey } from "../lib/conditions/model.mjs";
import { createSummaryCache, summaryContextLabel, summaryTimeLabel, summaryTtl } from "../lib/conditions/spot-summaries.mjs";

const bico = { latitude: 38.69, longitude: -9.369, timezone: "Europe/Lisbon" };
test("spot cards use today's sunrise before dawn, now in daylight and tomorrow's sunrise after sunset", () => {
  const sun = sunlightForDay("2026-09-10", bico);
  const tomorrow = sunlightForDay("2026-09-11", bico);
  for (const now of [sun.sunrise - 3600000, sun.sunrise - 1]) {
    assert.deepEqual(spotSummaryTime(now, bico), { at: sun.sunrise, timing: "sunrise", validUntil: sun.sunrise });
    assert.match(summaryTimeLabel(spotSummaryTime(now, bico), bico, now), /^Today · Sunrise · \d\d:\d\d$/);
  }
  for (const now of [sun.sunrise, sun.sunrise + 3600000, sun.sunset - 1])
    assert.deepEqual(spotSummaryTime(now, bico), { at: now, timing: "now", validUntil: sun.sunset });
  for (const now of [sun.sunset, sun.sunset + 3600000]) {
    assert.deepEqual(spotSummaryTime(now, bico), { at: tomorrow.sunrise, timing: "sunrise", validUntil: tomorrow.sunrise });
    assert.match(summaryTimeLabel(spotSummaryTime(now, bico), bico, now), /^Tomorrow · Sunrise/);
  }
  assert.match(summaryTimeLabel({ at: sun.sunrise, timing: "now" }, bico, sun.sunrise + summaryTtl + 1), /^Today ·/);
});
test("sunrise uses each spot's local calendar across DST, year changes and opposite sides of the date line", () => {
  const spots = [bico,
    { latitude: 21.3, longitude: -157.8, timezone: "Pacific/Honolulu" },
    { latitude: -36.9, longitude: 174.7, timezone: "Pacific/Auckland" },
  ];
  for (const spot of spots)
    for (const day of ["2026-03-28", "2026-10-24", "2026-12-31"]) {
      const sun = sunlightForDay(day, spot);
      const result = spotSummaryTime(sun.sunset + 1, spot);
      const nextDay = new Date(Date.parse(day + "T12:00Z") + 86400000).toISOString().slice(0, 10);
      assert.equal(dateKey(result.at, spot.timezone), nextDay);
      assert.equal(result.at, sunlightForDay(nextDay, spot).sunrise);
    }
});
test("polar daylight and night have explicit finite fallbacks without invented sunrises", () => {
  const spot = { latitude: 78.2, longitude: 15.6, timezone: "Arctic/Longyearbyen" };
  const summer = Date.parse("2026-06-21T23:00Z"), winter = Date.parse("2026-12-21T12:00Z");
  assert.deepEqual(spotSummaryTime(summer, spot), { at: summer, timing: "now", validUntil: null });
  assert.deepEqual(spotSummaryTime(winter, spot), { at: winter, timing: "night", validUntil: null });
});

test("summaries batch visible spots, survive minute ticks and scroll back, then revalidate after five minutes", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let now = 1000000, data;
  const calls = [];
  const store = createSummaryCache({ clock: () => now, onChange: (value) => { data = value; },
    fetchBatch: async (ids, refresh) => {
      calls.push({ ids, refresh });
      return Object.fromEntries(ids.map((id) => [id, { at: now, condition: { quality: "Good" } }]));
    },
  });
  t.after(() => store.dispose());
  const update = async (ids, version = 0) => { store.update(ids, version); t.mock.timers.tick(500); await setImmediate(); };
  await update(["a", "b", "c"]);
  assert.equal(calls.length, 1);
  assert.equal(Object.keys(data).length, 3);
  now += 60000;
  await update(["a", "b", "c"]);
  assert.equal(calls.length, 1);
  await update(["c", "d"]);
  assert.deepEqual(calls[1].ids, ["d"]);
  await update(["a", "b", "c"]);
  assert.equal(calls.length, 2);
  now += 4 * 60000;
  await update(["a", "b", "c"]);
  assert.equal(calls.length, 3);
  await update(["a", "b"], 1);
  assert.deepEqual(calls[3].refresh, ["a", "b"]);
  await update(["d"], 1);
  assert.deepEqual(calls[4].refresh, []); // explicit refresh cannot force later browsing
});
test("scrolling during a request reuses in-flight results; refresh failures retain labelled previous data and back off", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let now = 1000000, finish, data;
  const calls = [];
  const store = createSummaryCache({ clock: () => now, onChange: (value) => { data = value; },
    fetchBatch: (ids) => { calls.push(ids); return new Promise((resolve) => { finish = resolve; }); },
  });
  t.after(() => store.dispose());
  store.update(["a", "b"], 0); t.mock.timers.tick(500);
  store.update(["b", "c"], 0); t.mock.timers.tick(500);
  assert.equal(calls.length, 1);
  finish({ a: { at: now, condition: { quality: "Good" } }, b: { at: now, condition: { quality: "Fair" } } });
  await setImmediate(); t.mock.timers.tick(500);
  assert.deepEqual(calls[1], ["c"]);
  finish({ c: { error: "Unavailable" } }); await setImmediate();
  store.update(["a"], 1); t.mock.timers.tick(500);
  assert.equal(data.a.condition.quality, "Good"); // visible while refreshing
  finish({ a: { error: "Unavailable" } }); await setImmediate();
  assert.equal(data.a.condition.quality, "Good");
  assert.equal(data.a.stale, true);
  store.update(["a"], 1); t.mock.timers.tick(500);
  assert.equal(calls.length, 3);
  now += 60000;
  store.update(["a"], 1); t.mock.timers.tick(500);
  assert.equal(calls.length, 4);
});
test("sunrise/sunset expiry overrides five-minute caching", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let now = 1000000, calls = 0;
  const store = createSummaryCache({ clock: () => now, onChange: () => {}, fetchBatch: async () => {
    calls++;
    return { a: { at: now, condition: { quality: "Fair" }, validUntil: now + 30000 } };
  } });
  t.after(() => store.dispose());
  store.update(["a"], 0); t.mock.timers.tick(500); await setImmediate();
  now += 30000;
  store.update(["a"], 0); t.mock.timers.tick(500); await setImmediate();
  assert.equal(calls, 2);
});

test("an ahead-of-server device clock cannot create an immediate sunlight-boundary retry loop", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let now = 1000000, calls = 0;
  const store = createSummaryCache({ clock: () => now, onChange: () => {}, fetchBatch: async () => {
    calls++;
    return { a: { at: now - 3600000, condition: { quality: "Fair" }, validUntil: now - 1 } };
  } });
  t.after(() => store.dispose());
  store.update(["a"], 0); t.mock.timers.tick(500); await setImmediate();
  t.mock.timers.tick(10000); await setImmediate();
  assert.equal(calls, 1);
  now += 60000;
  store.update(["a"], 0); t.mock.timers.tick(500); await setImmediate();
  assert.equal(calls, 2);
});

test("the heading states the actual card context and preserves mixed-region timing", () => {
  const sun = sunlightForDay("2026-09-10", bico);
  const entries = [{ spot: { ...bico, id: "a" } }, { spot: { ...bico, id: "b" } }];
  assert.equal(summaryContextLabel(entries, {}, sun.sunrise - 1), "Loading…");
  for (const [now, expected] of [
    [sun.sunrise - 3600000, "Today at sunrise"],
    [sun.sunrise + 3600000, "Now"],
    [sun.sunset + 3600000, "Tomorrow at sunrise"],
  ]) {
    const summary = spotSummaryTime(now, bico);
    assert.equal(summaryContextLabel(entries, { a: summary, b: summary }, now), expected);
  }
  const now = sun.sunset + 3600000;
  assert.equal(summaryContextLabel(entries, { a: spotSummaryTime(now, bico), b: { at: now, timing: "now" } }, now), "Tomorrow at sunrise · Now");
});
