import test from "node:test";
import assert from "node:assert/strict";
import { sunlightForDay } from "../lib/conditions/sunlight.mjs";
import {
  forecastViewingHours,
  hourLabel,
  dateKey,
} from "../lib/conditions/model.mjs";
import { zonedDateTimeToISO } from "../lib/conditions/time.mjs";
const lisbon = { latitude: 38.69, longitude: -9.37, timezone: "Europe/Lisbon" };
test("sunlight phases use the selected spot date and civil twilight order", () => {
  for (const spot of [
    lisbon,
    { latitude: -33.89, longitude: 151.28, timezone: "Australia/Sydney" },
    { latitude: 1.87, longitude: -157.42, timezone: "Pacific/Kiritimati" },
  ]) {
    for (const day of ["2026-09-05", "2026-09-20"]) {
      const s = sunlightForDay(day, spot),
        times = [s.firstLight, s.sunrise, s.sunset, s.lastLight];
      assert.ok(
        times.every(
          (t) => Number.isFinite(t) && dateKey(t, spot.timezone) === day,
        ),
      );
      assert.ok(times.every((t, i) => i === 0 || t > times[i - 1]));
    }
  }
  const s = sunlightForDay("2026-09-05", lisbon);
  // Independent Open-Meteo daily reference at 38.69, -9.37: 07:10 / 20:02 local on 5 September 2026.
  assert.equal(hourLabel(s.sunrise, lisbon.timezone), "07:10");
  assert.match(hourLabel(s.sunset, lisbon.timezone), /^20:0[0-4]$/);
});
test("hourly view includes 06:00 before dawn and the evening after last light", () => {
  const day = "2026-09-05",
    s = sunlightForDay(day, lisbon);
  const hours = Array.from({ length: 24 }, (_, i) => ({
    time: Date.parse(
      zonedDateTimeToISO(
        day,
        String(i).padStart(2, "0") + ":00",
        lisbon.timezone,
      ),
    ),
    isDay: i > 7 && i < 20 ? 1 : 0,
  }));
  const visible = forecastViewingHours(hours, lisbon.timezone, s);
  assert.equal(hourLabel(visible[0].time, lisbon.timezone), "06:00");
  assert.equal(hourLabel(visible.at(-1).time, lisbon.timezone), "21:00");
  assert.ok(
    visible[0].time < s.firstLight && visible.at(-1).time > s.lastLight,
  );
  assert.equal(
    forecastViewingHours(hours, lisbon.timezone, s, true).length,
    24,
  );
});
test("polar days and nights retain missing solar events without invalid dates", () => {
  const spot = { latitude: 69.65, longitude: 18.96, timezone: "Europe/Oslo" };
  const summer = sunlightForDay("2026-06-21", spot),
    winter = sunlightForDay("2026-12-21", spot);
  assert.equal(summer.sunrise, null);
  assert.equal(summer.sunset, null);
  assert.equal(summer.alwaysUp, true);
  assert.equal(winter.sunrise, null);
  assert.equal(winter.sunset, null);
  assert.equal(winter.alwaysDown, true);
  assert.ok(winter.firstLight < winter.lastLight);
});
