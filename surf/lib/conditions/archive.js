import { sql } from "../db";
import { forecastSnapshot } from "./archive.mjs";

// Failure to archive must not replace a successfully refreshed public forecast.
export async function archiveForecast(spot, row, tideStation) {
  const snapshot = forecastSnapshot(spot, row, tideStation);
  if (!snapshot) return;
  await sql`INSERT INTO spot_forecast_snapshots
    (spot_id, retrieved_at, recorded_at, sample_slot, expires_at,
     engine_version, calibration_version, snapshot)
    VALUES (${spot.id}, ${snapshot.retrievedAt}, ${snapshot.recordedAt},
      ${snapshot.sampleSlot}, ${snapshot.expiresAt}, ${snapshot.engineVersion},
      ${spot.version}, ${JSON.stringify(snapshot)}::jsonb)
    ON CONFLICT (spot_id, sample_slot, engine_version, calibration_version) DO NOTHING`;
  // Opportunistic bounded retention needs no new cron or continuously awake DB.
  await sql`DELETE FROM spot_forecast_snapshots WHERE id IN (
    SELECT id FROM spot_forecast_snapshots WHERE expires_at < now()
    ORDER BY expires_at LIMIT 100)`;
}
