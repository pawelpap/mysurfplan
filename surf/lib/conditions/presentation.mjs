import { dateKey, finite, hourLabel } from "./model.mjs";
import { zonedDateTimeToISO } from "./time.mjs";

const DAY = 86400000;
export function timeOnDay(day, clock, timezone) {
  try {
    return Date.parse(zonedDateTimeToISO(day, clock, timezone));
  } catch (_) {
    return null;
  }
}
// Date keys describe the spot's calendar, not the browser's timezone.
export function calendarDays(dates) {
  if (!dates?.length) return [];
  const first = Date.parse(`${dates[0]}T12:00:00Z`);
  if (!finite(first)) return [];
  const offset = (new Date(first).getUTCDay() + 6) % 7;
  const count = Math.ceil((offset + dates.length) / 7) * 7;
  const available = new Set(dates);
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(first + (i - offset) * DAY).toISOString().slice(0, 10);
    return { day, available: available.has(day), weekend: i % 7 >= 5 };
  });
}

export function meaningfulExperience(level) {
  if (level === "Instructor review") return "Advanced";
  return ["Beginner", "Intermediate", "Advanced"].includes(level) ? level : "";
}

export function weatherIcon(code) {
  if (!finite(code)) return null;
  if (code === 0) return "sun";
  if (code <= 2) return "cloud-sun";
  if (code <= 48) return "cloud";
  if (code >= 95) return "cloud-lightning";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return "snowflake";
  return "cloud-rain";
}

export function previewHours(hours, selectedTime, count = 3) {
  if (hours.length <= count) return hours;
  let closest = 0;
  hours.forEach((h, i) => {
    if (
      Math.abs(h.time - selectedTime) <
      Math.abs(hours[closest].time - selectedTime)
    )
      closest = i;
  });
  const start = Math.min(
    hours.length - count,
    Math.max(0, closest - Math.floor(count / 2)),
  );
  return hours.slice(start, start + count);
}

export function filterSpots(entries, summaries, filters = {}) {
  const normalise = (text) =>
    String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  return entries.filter(({ spot, distance }) => {
    const summary = summaries[spot.id];
    const h = summary?.condition;
    return (
      (!filters.search ||
        normalise(`${spot.name} ${spot.region} ${spot.countryCode}`).includes(
          normalise(filters.search),
        )) &&
      (!filters.region || spot.region === filters.region) &&
      (!filters.distance ||
        (finite(distance) && distance <= Number(filters.distance))) &&
      (!filters.quality || (!summary?.stale && h?.tone === filters.quality)) &&
      (!filters.level ||
        (!summary?.stale && meaningfulExperience(h?.level) === filters.level))
    );
  });
}

// Retain only adjacent raw hours; do not copy a future or yesterday's hour into "now".
export function hoursAround(hours, time) {
  return hours.filter((h) => Math.abs(h.time - time) <= 3600000);
}

export function lessonMatchesConditions(lesson, { spot, date } = {}) {
  return (
    (!spot || lesson.spotId === spot) &&
    (!date ||
      dateKey(lesson.startAt, lesson.spotTimezone || "Europe/Lisbon") === date)
  );
}

export function timeContext(time, zone) {
  return `${dateKey(time, zone)} ${hourLabel(time, zone)}`;
}
