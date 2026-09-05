import { sql } from "../db";
import { getSpot, loadTideStation, distanceKm } from "./spots";
import { fetchForecast, matchesForecastSource } from "./provider.mjs";
import { predictTides } from "./tides.mjs";
import { sunlightForDay } from "./sunlight.mjs";
import { dateKey, scoreConditions, tideAt } from "./model.mjs";
const HOUR = 3600000;
export async function getConditions(id, force = false) {
  const spot = await getSpot(id);
  if (!spot) return null;
  let [row] = await sql`SELECT * FROM spot_forecasts WHERE spot_id=${spot.id}`;
  const now = Date.now();
  if (
    (row?.payload && !matchesForecastSource(row.payload, spot)) ||
    (force &&
      row?.fetched_at &&
      now - new Date(row.fetched_at).getTime() > 2 * 60000)
  ) {
    await sql`UPDATE spot_forecasts SET expires_at=now() WHERE spot_id=${spot.id}`;
    row.expires_at = new Date(now - 1).toISOString();
  }
  if (!row?.payload || new Date(row.expires_at).getTime() < now) {
    await sql`INSERT INTO spot_forecasts(spot_id) VALUES(${spot.id}) ON CONFLICT DO NOTHING`;
    const claim =
      await sql`UPDATE spot_forecasts SET refreshing_until=now()+interval '40 seconds' WHERE spot_id=${spot.id} AND (refreshing_until IS NULL OR refreshing_until<now()) AND (retry_after IS NULL OR retry_after<now()) AND (expires_at IS NULL OR expires_at<now()) RETURNING spot_id`;
    if (claim.length) {
      try {
        const payload = await fetchForecast(spot);
        // Partial responses are kept briefly and visibly labelled, never scored with invented inputs.
        const ttl = payload.issues.length ? 10 * 60000 : 15 * 60000;
        [row] =
          await sql`UPDATE spot_forecasts SET payload=${JSON.stringify(payload)}::jsonb,fetched_at=now(),expires_at=${new Date(now + ttl).toISOString()},refreshing_until=NULL,retry_after=NULL,last_error=NULL WHERE spot_id=${spot.id} RETURNING *`;
      } catch (error) {
        console.error("conditions refresh failed", spot.slug, error.message);
        await sql`UPDATE spot_forecasts SET refreshing_until=NULL,retry_after=now()+interval '5 minutes',last_error='Forecast refresh failed' WHERE spot_id=${spot.id}`;
        row = { ...row, last_error: "Forecast refresh failed" };
      }
    }
  }
  const age = row?.fetched_at
    ? now - new Date(row.fetched_at).getTime()
    : Infinity;
  const stale = age > 15 * 60000;
  const usable = age < 24 * HOUR && matchesForecastSource(row?.payload, spot);
  const payload = usable
    ? row.payload
    : {
        hours: [],
        issues: ["Forecast unavailable. Please try again shortly."],
      };
  const issues = [...(payload.issues || [])];
  if ((stale || row?.last_error) && usable)
    issues.push(
      "Showing an older forecast while the provider is unavailable. Check the update time.",
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
    const withTide = { ...h, tide: tideAt(tide.tides, h.time) };
    return { ...withTide, ...scoreConditions(withTide, spot.calibration) };
  });
  const dates = Array.from({ length: 16 }, (_, i) =>
    new Date(Date.parse(today + "T12:00:00Z") + i * 24 * HOUR)
      .toISOString()
      .slice(0, 10),
  );
  return {
    spot,
    hours,
    ...tide,
    dates,
    sunlight: dates.map((day) => sunlightForDay(day, spot)),
    tideReference: reference,
    issues,
    fetchedAt: row?.fetched_at || null,
    stale,
    refreshMinutes: 15,
    model: payload.model || null,
    marineGrid: payload.marineGrid || null,
  };
}
