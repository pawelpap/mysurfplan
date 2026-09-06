import { sql } from "../db";
import index from "./tide-station-index.json";
import { round } from "./model.mjs";
export {
  distanceKm,
  nearestTideStation,
  validateSpot,
} from "./spot-profile.mjs";
export function spotData(r) {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    region: r.region,
    countryCode: r.country_code,
    latitude: round(r.latitude, 6),
    longitude: round(r.longitude, 6),
    timezone: r.timezone,
    marineLatitude: round(r.marine_latitude, 6),
    marineLongitude: round(r.marine_longitude, 6),
    breakType: r.break_type,
    tideStationId: r.tide_station_id,
    calibration: r.calibration_config,
    calibrationSchemaVersion: r.calibration_schema_version,
    profileId: r.calibration_profile_id,
    profileVersion: r.calibration_profile_version,
    displayOrder: r.display_order,
    notes: r.notes,
    sources: r.sources,
    active: r.active,
    version: r.version,
  };
}
export async function getSpot(id) {
  const [r] =
    await sql`SELECT * FROM surf_spots WHERE id::text=${id} OR slug=${id} LIMIT 1`;
  return r ? spotData(r) : null;
}
export async function loadTideStation(id) {
  if (!id) return null;
  const [cached] = await sql`SELECT data FROM tide_stations WHERE id=${id}`;
  if (cached) return cached.data;
  if (!index.stations.some((s) => s.id === id)) return null;
  const url = `https://raw.githubusercontent.com/openwatersio/tide-database/${index.commit}/data/${id}.json`;
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Tide reference unavailable");
  const data = await response.json();
  if (
    data.license?.commercial_use !== true ||
    !Array.isArray(data.harmonic_constituents) ||
    !data.harmonic_constituents.length
  )
    throw new Error("No reusable tide harmonics");
  await sql`INSERT INTO tide_stations(id,name,latitude,longitude,timezone,data,source_url) VALUES(${id},${data.name},${data.latitude},${data.longitude},${data.timezone},${JSON.stringify(data)}::jsonb,${url}) ON CONFLICT(id) DO NOTHING`;
  return data;
}
