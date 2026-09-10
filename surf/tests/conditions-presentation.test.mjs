import test from "node:test";
import assert from "node:assert/strict";
import {
  calendarDays,
  filterSpots,
  hoursAround,
  lessonMatchesConditions,
  meaningfulExperience,
  previewHours,
  timeOnDay,
  weatherIcon,
} from "../lib/conditions/presentation.mjs";
import {
  dateKey,
  hourLabel,
  interpolateHour,
} from "../lib/conditions/model.mjs";

test("calendar keeps all sixteen dates in Monday–Sunday columns for every starting weekday", () => {
  for (const first of ["2026-09-07", "2026-12-21", "2028-02-21"])
    for (let offset = 0; offset < 7; offset++) {
      const dates = Array.from({ length: 16 }, (_, i) =>
        new Date(Date.parse(first + "T12:00Z") + (offset + i) * 86400000)
          .toISOString()
          .slice(0, 10),
      );
      const cells = calendarDays(dates);
      assert.equal(new Date(cells[0].day + "T12:00Z").getUTCDay(), 1);
      assert.equal(cells.length % 7, 0);
      assert.deepEqual(
        cells.filter((c) => c.available).map((c) => c.day),
        dates,
      );
      cells.forEach((c, i) => assert.equal(c.weekend, i % 7 >= 5));
      assert.equal(cells.length, Math.ceil((offset + 16) / 7) * 7);
    }
});
test("shared wall-clock selection uses each date's timezone offset, rejects DST gaps and ambiguity", () => {
  assert.equal(
    hourLabel(
      timeOnDay("2026-09-10", "15:15", "Europe/Lisbon"),
      "Europe/Lisbon",
    ),
    "15:15",
  );
  assert.equal(
    new Date(timeOnDay("2026-09-10", "15:15", "Europe/Lisbon")).toISOString(),
    "2026-09-10T14:15:00.000Z",
  );
  assert.equal(timeOnDay("2026-03-29", "01:30", "Europe/Lisbon"), null);
  assert.equal(timeOnDay("2026-10-25", "01:30", "Europe/Lisbon"), null);
  assert.equal(timeOnDay("not-a-date", "12:00", "UTC"), null);
  const west = timeOnDay("2026-09-10", "23:30", "Pacific/Honolulu");
  assert.equal(dateKey(west, "Pacific/Honolulu"), "2026-09-10");
  assert.equal(hourLabel(west, "Pacific/Honolulu"), "23:30");
});
test("compact forecast inputs cover the chosen instant without substituting another day or missing data", () => {
  const base = Date.parse("2026-09-10T00:00Z");
  const hours = Array.from({ length: 384 }, (_, i) => ({
    time: base + i * 3600000,
    swellHeight: i,
    windDirection: 350,
  }));
  const at = base + 18.25 * 3600000;
  const subset = hoursAround(hours, at);
  assert.equal(subset.length, 2);
  assert.equal(interpolateHour(subset, at).swellHeight, 18.25);
  assert.equal(
    interpolateHour(hoursAround(hours, base - 3600000), base - 3600000),
    null,
  );
  assert.equal(
    interpolateHour(
      hoursAround(hours, base + 400 * 3600000),
      base + 400 * 3600000,
    ),
    null,
  );
});
test("catalogue searches ignore accents and quality filters cannot include stale, unavailable or different skill data", () => {
  const entries = [
    {
      spot: {
        id: "a",
        name: "São João",
        region: "Caparica",
        countryCode: "PT",
      },
      distance: 4,
    },
    {
      spot: { id: "b", name: "Bico", region: "Cascais", countryCode: "PT" },
      distance: null,
    },
  ];
  const summary = {
    a: { condition: { tone: "good", level: "Advanced" } },
    b: { condition: { tone: "good", level: "Beginner" }, stale: true },
  };
  assert.equal(filterSpots(entries, summary, { search: "sao joao" }).length, 1);
  assert.equal(
    filterSpots(entries, summary, { quality: "good", level: "Beginner" })
      .length,
    0,
  );
  assert.equal(
    filterSpots(entries, summary, { quality: "good", level: "Advanced" })[0]
      .spot.id,
    "a",
  );
  assert.equal(filterSpots(entries, summary, { distance: "10" }).length, 1);
  assert.equal(filterSpots(entries, {}, { quality: "good" }).length, 0);
});
test("hour previews follow the cursor without truncating the available list or losing end hours", () => {
  const hours = Array.from({ length: 16 }, (_, i) => ({
    time: (6 + i) * 3600000,
  }));
  assert.deepEqual(previewHours(hours, 6 * 3600000), hours.slice(0, 3));
  assert.deepEqual(previewHours(hours, 14 * 3600000), hours.slice(7, 10));
  assert.deepEqual(previewHours(hours, 23 * 3600000), hours.slice(-3));
  assert.equal(hours.length, 16);
});
test("tile experience omits non-applicable values and weather icons distinguish real provider codes", () => {
  assert.equal(meaningfulExperience("Too small"), "");
  assert.equal(meaningfulExperience(null), "");
  assert.equal(meaningfulExperience("Instructor review"), "Advanced");
  assert.deepEqual([0, 2, 3, 61, 71, 95, null].map(weatherIcon), [
    "sun",
    "cloud-sun",
    "cloud",
    "cloud-rain",
    "snowflake",
    "cloud-lightning",
    null,
  ]);
});
test("conditions-to-lessons filters use spot IDs and local dates rather than the browser's UTC date", () => {
  const lesson = {
    spotId: "a",
    spotTimezone: "Pacific/Honolulu",
    startAt: "2026-09-11T03:00Z",
  };
  assert.equal(
    lessonMatchesConditions(lesson, { spot: "a", date: "2026-09-10" }),
    true,
  );
  assert.equal(
    lessonMatchesConditions(lesson, { spot: "b", date: "2026-09-10" }),
    false,
  );
  assert.equal(
    lessonMatchesConditions(lesson, { spot: "a", date: "2026-09-11" }),
    false,
  );
});
