import { engineVersion } from "./calibration.mjs";
import { completeForecast } from "./refresh-policy.mjs";

export const archiveIntervalMs = 6 * 3600000;
export const archiveRetentionDays = 90;

// A bounded sample of forecasts retrieved before their valid time. We do not
// backfill past hours or invent the provider's model issue timestamp.
export function forecastSnapshot(spot, row, tideStation, now = Date.now()) {
  const retrieved = Date.parse(row?.fetched_at);
  if (!Number.isFinite(retrieved) || retrieved > now ||
      now - retrieved > 60000 || !completeForecast(row.payload)) return null;
  const hours = row.payload.hours.filter((h) => h.time > now);
  if (!hours.length) return null;
  return {
    formatVersion: 1,
    engineVersion,
    retrievedAt: new Date(retrieved).toISOString(),
    recordedAt: new Date(now).toISOString(),
    providerIssuedAt: null,
    sampleSlot: new Date(Math.floor(retrieved / archiveIntervalMs) * archiveIntervalMs).toISOString(),
    expiresAt: new Date(now + archiveRetentionDays * 86400000).toISOString(),
    spot: {
      id: spot.id, slug: spot.slug, latitude: spot.latitude,
      longitude: spot.longitude, timezone: spot.timezone,
      marineLatitude: spot.marineLatitude, marineLongitude: spot.marineLongitude,
      version: spot.version, calibration: spot.calibration,
      calibrationSchemaVersion: spot.calibrationSchemaVersion,
      profileId: spot.profileId, profileVersion: spot.profileVersion,
      tideStationId: spot.tideStationId,
    },
    tideStation,
    payload: { ...row.payload, hours },
  };
}
