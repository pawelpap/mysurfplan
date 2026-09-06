import { validateCalibration, engineVersion } from "./calibration.mjs";
import { sql } from "../db";
import { getSpot, loadTideStation, distanceKm } from "./spots";
import { fetchForecast } from "./provider.mjs";
import {
  completeForecast,
  forecastUpdate,
  refreshDue,
  retryMinimumMs,
  usableForecast,
} from "./refresh-policy.mjs";
import { predictTides } from "./tides.mjs";
import { sunlightForDay } from "./sunlight.mjs";
import { dateKey, scoreConditions, tideAt } from "./model.mjs";
const HOUR = 3600000;
export async function getConditions(id, force = false) {
  const spot = await getSpot(id);
  if (!spot) return null;
  const [schemaRow] =
    await sql`SELECT schema FROM calibration_schema_versions WHERE version=${spot.calibrationSchemaVersion}`;
  validateCalibration(spot.calibration, schemaRow?.schema);
  let [row] = await sql`SELECT * FROM spot_forecasts WHERE spot_id=${spot.id}`;
  const now = Date.now();
  if (refreshDue(row, spot, force, now)) {
    // A concurrent refresh may already have completed since our initial read.
    await sql`UPDATE spot_forecasts SET expires_at=now() WHERE spot_id=${spot.id} AND date_trunc('milliseconds',fetched_at) IS NOT DISTINCT FROM ${row?.fetched_at || null}::timestamptz AND (refreshing_until IS NULL OR refreshing_until<now())`;
    await sql`INSERT INTO spot_forecasts(spot_id) VALUES(${spot.id}) ON CONFLICT DO NOTHING`;
    const claim =
      await sql`UPDATE spot_forecasts SET refreshing_until=now()+interval '40 seconds' WHERE spot_id=${spot.id} AND (refreshing_until IS NULL OR refreshing_until<now()) AND (retry_after IS NULL OR retry_after<now()) AND (expires_at IS NULL OR expires_at<now()) RETURNING spot_id`;
    if (claim.length) {
      try {
        const payload = await fetchForecast(spot);
        const update = forecastUpdate(row, payload, spot);
        [row] =
          await sql`UPDATE spot_forecasts SET payload=${JSON.stringify(update.payload)}::jsonb,fetched_at=${update.fetchedAt},expires_at=${update.expiresAt},refreshing_until=NULL,retry_after=${update.retryAt},last_error=${update.error} WHERE spot_id=${spot.id} RETURNING *`;
      } catch (error) {
        console.error("conditions refresh failed", spot.slug, error.message);
        const retryAt = new Date(
          Date.now() + Math.max(retryMinimumMs, error.retryAfterMs || 0),
        ).toISOString();
        [row] =
          await sql`UPDATE spot_forecasts SET refreshing_until=NULL,retry_after=${retryAt},last_error='Forecast refresh failed' WHERE spot_id=${spot.id} RETURNING *`;
      }
    } else {
      // A simultaneous request may own the refresh. Read its latest row and
      // await that refresh, including when an older forecast is already cached.
      const deadline = Date.now() + 30000;
      do {
        [row] =
          await sql`SELECT * FROM spot_forecasts WHERE spot_id=${spot.id}`;
        if (
          !(new Date(row?.refreshing_until).getTime() > Date.now()) ||
          Date.now() >= deadline
        )
          break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      } while (true);
    }
  }
  const age = row?.fetched_at
    ? Date.now() - new Date(row.fetched_at).getTime()
    : Infinity;
  const stale = age > 15 * 60000 || Boolean(row?.last_error);
  const usable = usableForecast(row, spot);
  const payload = usable
    ? row.payload
    : {
        hours: [],
        issues: ["Forecast unavailable. Please try again shortly."],
      };
  const issues = [...(payload.issues || [])];
  if (stale && usable && completeForecast(payload))
    issues.push(
      "Could not update conditions. Showing the last complete forecast; check the update time.",
    );
  const today = dateKey(now, spot.timezone);
  // Extra padding supplies neighbouring tide extrema around both ends of the 16-day view.
  const start = Date.parse(today + "T00:00:00Z") - 2 * 24 * HOUR,
    end = start + 20 * 24 * HOUR;
  let tide = { tides: [], extremes: [] },
    reference = null;
  try {
    const station = await loadTideStation(spot.tideStationId);
    if (station) {
      tide = predictTides(station, start, end, spot.calibration);
      reference = {
        id: spot.tideStationId,
        name: station.name,
        distanceKm: Math.round(
          distanceKm(
            spot.latitude,
            spot.longitude,
            station.latitude,
            station.longitude,
          ),
        ),
        datum: "Mean sea level (MSL)",
        source: station.source.url,
        epoch: station.epoch,
      };
    } else
      issues.push(
        "No nearby tide reference is configured for this spot. Tide and a complete score are unavailable.",
      );
  } catch (error) {
    issues.push("Tide predictions are temporarily unavailable.");
    console.error("tide prediction failed", spot.slug, error.message);
  }
  const hours = payload.hours.map((h) => {
    const withTide = {
      ...h,
      tide: tideAt(tide.tides, h.time, spot.calibration),
    };
    return { ...withTide, ...scoreConditions(withTide, spot.calibration) };
  });
  const dates = Array.from({ length: 16 }, (_, i) =>
    new Date(Date.parse(today + "T12:00:00Z") + i * 24 * HOUR)
      .toISOString()
      .slice(0, 10),
  );
  return {
    spot,
    assessment: {
      engineVersion,
      schemaVersion: spot.calibrationSchemaVersion,
      spotVersion: spot.version,
      profileId: spot.profileId,
      profileVersion: spot.profileVersion,
    },
    hours,
    ...tide,
    dates,
    sunlight: dates.map((day) => sunlightForDay(day, spot)),
    tideReference: reference,
    issues,
    fetchedAt: row?.fetched_at || null,
    retryAt: row?.retry_after || null,
    stale,
    refreshMinutes: 15,
    model: payload.model || null,
    marineGrid: payload.marineGrid || null,
    waterTemperatureSource: payload.waterTemperatureSource || null,
  };
}
