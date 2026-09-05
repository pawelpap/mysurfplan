import { getTimes } from "suncalc";
import { dateKey } from "./model.mjs";
import { zonedDateTimeToISO } from "./time.mjs";

// Sunrise/sunset use the solar horizon; dawn/dusk use civil twilight (-6°).
// Calculate from the spot's local noon, not the server's calendar date.
export function sunlightForDay(day, spot) {
  const noon = new Date(zonedDateTimeToISO(day, "12:00", spot.timezone));
  const days = [-1, 0, 1].map((offset) =>
    getTimes(
      new Date(noon.getTime() + offset * 86400000),
      spot.latitude,
      spot.longitude,
    ),
  );
  const event = (name) => {
    const value = days
      .map((d) => d[name])
      .find(
        (t) =>
          t instanceof Date &&
          Number.isFinite(t.getTime()) &&
          dateKey(t, spot.timezone) === day,
      );
    return value ? value.getTime() : null;
  };
  return {
    day,
    firstLight: event("dawn"),
    sunrise: event("sunrise"),
    sunset: event("sunset"),
    lastLight: event("dusk"),
    alwaysUp: Boolean(days[1].alwaysUp),
    alwaysDown: Boolean(days[1].alwaysDown),
  };
}
