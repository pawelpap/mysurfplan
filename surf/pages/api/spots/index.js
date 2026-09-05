import crypto from "crypto";
import { sql } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";
import {
  getSpot,
  spotData,
  validateSpot,
  nearestTideStation,
  loadTideStation,
} from "../../../lib/conditions/spots";
export const config = { maxDuration: 60 };
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!["GET", "POST", "PUT"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PUT");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const session = requireAuth(
    req,
    res,
    req.method === "GET" ? {} : { roles: ["platform_admin"] },
  );
  if (!session) return;
  if (req.method !== "GET" && session.role !== "platform_admin")
    return res.status(403).json({
      ok: false,
      error: "Only platform admins can manage surf spots.",
    });
  try {
    if (req.method === "GET") {
      const rows =
        await sql`SELECT * FROM surf_spots WHERE active=true ORDER BY country_code,region,name`;
      return res.json({ ok: true, data: rows.map(spotData) });
    }
    const old = req.method === "PUT" ? await getSpot(req.body?.id) : null;
    if (req.method === "PUT" && !old)
      return res.status(404).json({ ok: false, error: "Spot not found." });
    let input;
    try {
      input = validateSpot(req.body || {}, old);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
    const relocated =
      !old ||
      old.latitude !== input.latitude ||
      old.longitude !== input.longitude;
    const station = relocated
      ? nearestTideStation(input.latitude, input.longitude)
      : null;
    let tideStationId = relocated ? station?.id || null : old.tideStationId;
    if (tideStationId) {
      try {
        await loadTideStation(tideStationId);
      } catch {
        tideStationId = null;
      }
    }
    const c = JSON.stringify(input.calibration);
    let rows;
    if (old) {
      if (req.body.version !== old.version)
        return res.status(409).json({
          ok: false,
          error: "This spot has changed. Reload it before saving.",
        });
      rows =
        await sql`WITH changed AS (UPDATE surf_spots SET name=${input.name},region=${input.region},country_code=${input.countryCode},latitude=${input.latitude},longitude=${input.longitude},timezone=${input.timezone},marine_latitude=${input.marineLatitude},marine_longitude=${input.marineLongitude},break_type=${input.breakType},tide_station_id=${tideStationId},calibration=${c}::jsonb,notes=${input.notes},version=version+1,updated_at=now() WHERE id=${old.id} AND version=${old.version} RETURNING *), history AS (INSERT INTO spot_calibration_history(spot_id,version,calibration,notes,changed_by) SELECT id,version,calibration,notes,${session.userId}::uuid FROM changed RETURNING id) SELECT * FROM changed`;
      if (!rows.length)
        return res.status(409).json({
          ok: false,
          error: "This spot has changed. Reload it before saving.",
        });
      if (relocated || old.timezone !== input.timezone)
        await sql`UPDATE spot_forecasts SET expires_at=now(),retry_after=NULL WHERE spot_id=${old.id}`;
    } else {
      const slug =
        [input.name, input.countryCode]
          .join("-")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") +
        "-" +
        crypto.randomBytes(3).toString("hex");
      rows =
        await sql`WITH added AS (INSERT INTO surf_spots(slug,name,region,country_code,latitude,longitude,timezone,marine_latitude,marine_longitude,break_type,tide_station_id,calibration,notes,sources) VALUES(${slug},${input.name},${input.region},${input.countryCode},${input.latitude},${input.longitude},${input.timezone},${input.marineLatitude},${input.marineLongitude},${input.breakType},${tideStationId},${c}::jsonb,${input.notes},'[ {"title":"Admin-entered spot profile; initial calibration"} ]'::jsonb) RETURNING *), history AS (INSERT INTO spot_calibration_history(spot_id,version,calibration,notes,changed_by) SELECT id,version,calibration,notes,${session.userId}::uuid FROM added RETURNING id) SELECT * FROM added`;
    }
    return res
      .status(old ? 200 : 201)
      .json({ ok: true, data: spotData(rows[0]) });
  } catch (e) {
    console.error("spots API", e.message);
    return res.status(500).json({
      ok: false,
      error: "Could not save or load spots. Please try again.",
    });
  }
}
