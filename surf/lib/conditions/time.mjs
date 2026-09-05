export function zonedFields(value, timezone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone || undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (k) => parts.find((p) => p.type === k).value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}
export function zonedDateTimeToISO(date, time, timezone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    throw new Error("Choose a valid date and time.");
  const wall = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(wall)) throw new Error("Choose a valid date and time.");
  const offsets = new Set();
  for (const days of [-2, 0, 2]) {
    const instant = wall + days * 86400000,
      p = zonedFields(instant, timezone);
    offsets.add(Date.parse(`${p.date}T${p.time}:00Z`) - instant);
  }
  const matches = [...offsets]
    .map((offset) => wall - offset)
    .filter((t) => {
      const p = zonedFields(t, timezone);
      return p.date === date && p.time === time;
    });
  if (!matches.length)
    throw new Error(
      "This local time does not exist because the clocks change. Choose another time.",
    );
  if (matches.length > 1)
    throw new Error(
      "This local time occurs twice when the clocks change. Choose a time outside the clock change.",
    );
  return new Date(matches[0]).toISOString();
}
