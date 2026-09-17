import { dateKey, finite, hourLabel } from "./model.mjs";

const HOUR = 3600000;

export function validForecastDay(day) {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const time = Date.parse(`${day}T12:00:00Z`);
  return finite(time) && new Date(time).toISOString().slice(0, 10) === day;
}

// Both the comparison cards and detail calendar use the same selected date.
export function selectedForecastDay(day, today) {
  if (!today) return null;
  const last = new Date(Date.parse(`${today}T12:00:00Z`) + 15 * 24 * HOUR)
    .toISOString().slice(0, 10);
  return validForecastDay(day) && day >= today && day <= last ? day : today;
}

// Compare complete daylight sessions, not an isolated high-scoring hour.
// The weakest sampled hour determines the colour; tied sessions prefer two
// hours, then the higher mean score, then the earlier start. No extrapolation.
export function bestDayWindow(hours, day, timezone, sunlight) {
  if (!sunlight || sunlight.alwaysDown) return null;
  const daylight = (time) =>
    sunlight.alwaysUp ||
    (finite(sunlight.sunrise) && finite(sunlight.sunset) &&
      time >= sunlight.sunrise && time <= sunlight.sunset);
  const samples = hours
    .filter((h) => dateKey(h.time, timezone) === day && daylight(h.time))
    .sort((a, b) => a.time - b.time);
  const candidates = [];
  for (let start = 0; start < samples.length; start++) {
    for (const duration of [1, 2]) {
      const session = samples.slice(start, start + duration + 1);
      if (session.length !== duration + 1 || session.some((h, i) =>
        !finite(h.score) || h.provisional ||
        (i > 0 && h.time - session[i - 1].time !== HOUR))) continue;
      const weakest = session.reduce((a, b) => b.score < a.score ? b : a);
      const levels = ["Not assessed", "Too small", "Beginner", "Intermediate", "Advanced", "Instructor review"];
      const demanding = session.reduce((a, b) =>
        levels.indexOf(b.level) > levels.indexOf(a.level) ? b : a);
      candidates.push({
        start: session[0].time,
        end: session.at(-1).time,
        duration,
        mean: session.reduce((sum, h) => sum + h.score, 0) / session.length,
        condition: { ...weakest, level: demanding.level },
      });
    }
  }
  candidates.sort((a, b) => b.condition.score - a.condition.score ||
    b.duration - a.duration || b.mean - a.mean || a.start - b.start);
  const best = candidates[0];
  return best ? {
    start: best.start,
    end: best.end,
    label: `${hourLabel(best.start, timezone)}–${hourLabel(best.end, timezone)}`,
    condition: best.condition,
  } : null;
}
