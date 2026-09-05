import index from "./tide-station-index.json" with { type: "json" };
import { defaultCalibration } from "./model.mjs";
export function distanceKm(lat, lon, a, b) {
  const rad = Math.PI / 180,
    dlat = (a - lat) * rad,
    dlon = (b - lon) * rad;
  return (
    6371 *
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(dlat / 2) ** 2 +
          Math.cos(lat * rad) * Math.cos(a * rad) * Math.sin(dlon / 2) ** 2,
      ),
    )
  );
}
export function nearestTideStation(lat, lon) {
  const candidates = index.stations
    .map((s) => ({ ...s, distance: distanceKm(lat, lon, s.lat, s.lon) }))
    .filter((s) => s.distance <= 50)
    .sort((a, b) =>
      Math.abs(a.distance - b.distance) < 0.5
        ? b.end.localeCompare(a.end)
        : a.distance - b.distance,
    );
  return candidates[0] || null;
}
export function validateSpot(input, previous) {
  const text = (k, max = 150) => {
    const v = typeof input[k] === "string" ? input[k].trim() : "";
    if (!v || v.length > max) throw new Error(`Enter a valid ${k}.`);
    return v;
  };
  const number = (k, min, max) => {
    const raw = input[k];
    const v =
      typeof raw === "number" || (typeof raw === "string" && raw.trim() !== "")
        ? Number(raw)
        : NaN;
    if (!Number.isFinite(v) || v < min || v > max)
      throw new Error(`Enter a valid ${k} (${min} to ${max}).`);
    return v;
  };
  const name = text("name"),
    region = text("region"),
    countryCode = text("countryCode", 2).toUpperCase(),
    timezone = text("timezone", 80);
  if (!/^[A-Z]{2}$/.test(countryCode))
    throw new Error("Use a two-letter country code, such as PT.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  } catch {
    throw new Error("Enter an IANA time zone, such as Europe/Lisbon.");
  }
  const latitude = number("latitude", -85, 85),
    longitude = number("longitude", -180, 180),
    shoreNormal = number("shoreNormal", 0, 359);
  const breakType = text("breakType", 40);
  if (!["Beach", "Mixed", "Reef", "Point / reef"].includes(breakType))
    throw new Error("Choose a break type.");
  const calibration = {
    ...defaultCalibration,
    ...previous?.calibration,
    shoreNormal,
  };
  // Changing the orientation resets an old hand-entered directional curve.
  if (previous && previous.calibration.shoreNormal !== shoreNormal)
    delete calibration.exposureByDirection;
  for (const [key, min, max] of [
    ["swellGain", 0.1, 3],
    ["windExposure", 0.2, 2],
    ["largerSwellThreshold", 0.1, 6],
    ["minimumSwell", 0, 6],
    ["tideTimeOffsetMin", -120, 120],
    ["tideHeightScale", 0.5, 1.5],
  ])
    if (input[key] !== undefined) calibration[key] = number(key, min, max);
  if (input.tidePreference !== undefined) {
    if (
      !["any", "low-mid", "mid", "mid-high", "bico", "bafureira"].includes(
        input.tidePreference,
      )
    )
      throw new Error("Choose a tide preference.");
    calibration.tidePreference = input.tidePreference;
  }
  if (input.minimumLevel !== undefined) {
    if (!["Beginner", "Intermediate", "Advanced"].includes(input.minimumLevel))
      throw new Error("Choose a minimum experience level.");
    calibration.minimumLevel = input.minimumLevel;
  }
  const notes =
    typeof input.notes === "string"
      ? input.notes.trim().slice(0, 2000)
      : previous?.notes || "";
  // Global grid lookup defaults to the spot. Local offshore sample points are preserved unless relocated.
  const moved =
    !previous ||
    previous.latitude !== latitude ||
    previous.longitude !== longitude;
  return {
    name,
    region,
    countryCode,
    timezone,
    latitude,
    longitude,
    breakType,
    calibration,
    notes,
    marineLatitude: moved ? latitude : previous.marineLatitude,
    marineLongitude: moved ? longitude : previous.marineLongitude,
  };
}
