import index from "./tide-station-index.json" with { type: "json" };
import { validateCalibration } from "./calibration.mjs";
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
export function validateSpot(input, previous, schema) {
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
    longitude = number("longitude", -180, 180);
  const breakType = text("breakType", 40);
  if (!["Beach", "Mixed", "Reef", "Point / reef"].includes(breakType))
    throw new Error("Choose a break type.");
  const calibration = validateCalibration(input.calibration, schema);
  if (
    calibration.marineModel === "ncep_gfswave016" &&
    (latitude < -15 || latitude > 52.5)
  )
    throw new Error(
      "GFS 0.16° covers 15°S to 52.5°N. Choose the global model here.",
    );
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
    active:
      input.active === undefined
        ? (previous?.active ?? true)
        : input.active === true,
    displayOrder:
      input.displayOrder === undefined
        ? (previous?.displayOrder ?? 0)
        : number("displayOrder", -10000, 10000),
    sources:
      input.sources === undefined
        ? previous?.sources || []
        : validateSources(input.sources),
    marineLatitude:
      input.marineLatitude !== undefined
        ? number("marineLatitude", -85, 85)
        : moved
          ? latitude
          : previous.marineLatitude,
    marineLongitude:
      input.marineLongitude !== undefined
        ? number("marineLongitude", -180, 180)
        : moved
          ? longitude
          : previous.marineLongitude,
  };
}

function validateSources(sources) {
  if (
    !Array.isArray(sources) ||
    sources.length > 50 ||
    sources.some(
      (s) =>
        !s ||
        typeof s.title !== "string" ||
        !s.title.trim() ||
        s.title.length > 300 ||
        (s.url && (typeof s.url !== "string" || !/^https?:\/\//.test(s.url))) ||
        (s.note && (typeof s.note !== "string" || s.note.length > 2000)),
    )
  )
    throw new Error("Enter valid source titles and web links.");
  return sources.map(({ title, url, note, accessed }) => ({
    title,
    ...(url ? { url } : {}),
    ...(note ? { note } : {}),
    ...(typeof accessed === "string" ? { accessed } : {}),
  }));
}
