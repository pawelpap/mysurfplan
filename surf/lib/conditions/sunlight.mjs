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

// Cards compare the next useful daylight instant, independently of the chart.
// Calendar arithmetic is local to the spot, including across DST and midnight.
export function spotSummaryTime(now, spot) {
  const today = dateKey(now, spot.timezone);
  const days = [-1, 0, 1, 2].map((offset) => {
    const day = new Date(Date.parse(today + "T12:00Z") + offset * 86400000)
      .toISOString().slice(0, 10);
    return sunlightForDay(day, spot);
  });
  const events = days.flatMap((day) => [
    { at: day.sunrise, type: "sunrise" },
    { at: day.sunset, type: "sunset" },
  ]).filter((event) => Number.isFinite(event.at)).sort((a, b) => a.at - b.at);
  const before = events.filter((event) => event.at <= now).at(-1);
  const after = events.find((event) => event.at > now);
  const daylight = before ? before.type === "sunrise"
    : after ? after.type === "sunset" : days[1].alwaysUp;
  if (daylight)
    return { at: now, timing: "now", validUntil: after?.at ?? null };
  const sunrise = events.find((event) => event.type === "sunrise" && event.at > now);
  if (sunrise)
    return { at: sunrise.at, timing: "sunrise", validUntil: sunrise.at };
  // Polar night: do not invent a sunrise or extrapolate beyond the forecast.
  return { at: now, timing: "night", validUntil: null };
}
