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
    res.setHeader("Allow", ["GET", "POST", "PUT"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const session = requireAuth(req, res);
  if (!session) return;
  if (req.method !== "GET" && session.role !== "platform_admin")
    return res
      .status(403)
      .json({
        ok: false,
        error: "Only platform admins can manage surf spots.",
      });
  try {
    if (req.method === "GET") {
      const includeInactive =
        session.role === "platform_admin" && req.query.includeInactive === "1";
      const rows =
        await sql`SELECT * FROM surf_spots WHERE active=true OR ${includeInactive} ORDER BY display_order DESC,country_code,region,name`;
      return res.json({ ok: true, data: rows.map(spotData) });
    }
    const old = req.method === "PUT" ? await getSpot(req.body?.id) : null;
    if (req.method === "PUT" && !old)
      return res.status(404).json({ ok: false, error: "Spot not found." });
    const [schema] =
      await sql`SELECT schema FROM calibration_schema_versions WHERE version=${req.body?.calibration?.schemaVersion || 0}`;
    let input;
    try {
      input = validateSpot(req.body || {}, old, schema?.schema);
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
    const changeNote =
      typeof req.body.changeNote === "string" ? req.body.changeNote.trim() : "";
    if (!changeNote || changeNote.length > 2000)
      return res
        .status(400)
        .json({
          ok: false,
          error: "Add a change note (up to 2,000 characters).",
        });
    const profileId = req.body.profileId || old?.profileId,
      profileVersion = req.body.profileVersion || old?.profileVersion;
    const [profile] =
      await sql`SELECT id FROM surf_calibration_profiles WHERE id=${profileId || ""} AND version=${profileVersion || 0}`;
    if (!profile)
      return res
        .status(400)
        .json({ ok: false, error: "Choose a database calibration profile." });
    const relocated =
      !old ||
      old.latitude !== input.latitude ||
      old.longitude !== input.longitude;
    let tideStationId =
      req.body.tideStationId === undefined
        ? relocated
          ? nearestTideStation(input.latitude, input.longitude)?.id || null
          : old.tideStationId
        : req.body.tideStationId || null;
    if (tideStationId) {
      try {
        if (!(await loadTideStation(tideStationId))) throw new Error("Missing");
      } catch {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "The selected tide reference is unavailable. Choose a different reference or leave it empty.",
          });
      }
    }
    const c = JSON.stringify(input.calibration),
      sources = JSON.stringify(input.sources);
    let rows;
    if (old) {
      if (req.body.version !== old.version)
        return res
          .status(409)
          .json({
            ok: false,
            error: "This spot has changed. Reload it before saving.",
          });
      rows =
        await sql`WITH changed AS (UPDATE surf_spots SET name=${input.name},region=${input.region},country_code=${input.countryCode},latitude=${input.latitude},longitude=${input.longitude},timezone=${input.timezone},marine_latitude=${input.marineLatitude},marine_longitude=${input.marineLongitude},break_type=${input.breakType},tide_station_id=${tideStationId},calibration_config=${c}::jsonb,calibration_schema_version=${input.calibration.schemaVersion},calibration_profile_id=${profileId},calibration_profile_version=${profileVersion},notes=${input.notes},sources=${sources}::jsonb,active=${input.active},display_order=${input.displayOrder},version=version+1,updated_at=now() WHERE id=${old.id} AND version=${old.version} RETURNING *), history AS (INSERT INTO spot_calibration_history(spot_id,version,calibration,notes,schema_version,change_note,sources,changed_by) SELECT id,version,calibration_config,notes,calibration_schema_version,${changeNote},sources,${session.userId}::uuid FROM changed RETURNING id) SELECT * FROM changed`;
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
        await sql`WITH added AS (INSERT INTO surf_spots(slug,name,region,country_code,latitude,longitude,timezone,marine_latitude,marine_longitude,break_type,tide_station_id,calibration,calibration_config,calibration_schema_version,calibration_profile_id,calibration_profile_version,notes,sources,active,display_order) VALUES(${slug},${input.name},${input.region},${input.countryCode},${input.latitude},${input.longitude},${input.timezone},${input.marineLatitude},${input.marineLongitude},${input.breakType},${tideStationId},'{}'::jsonb,${c}::jsonb,${input.calibration.schemaVersion},${profileId},${profileVersion},${input.notes},${sources}::jsonb,${input.active},${input.displayOrder}) RETURNING *), history AS (INSERT INTO spot_calibration_history(spot_id,version,calibration,notes,schema_version,change_note,sources,changed_by) SELECT id,version,calibration_config,notes,calibration_schema_version,${changeNote},sources,${session.userId}::uuid FROM added RETURNING id) SELECT * FROM added`;
    }
    if (!rows.length)
      return res
        .status(409)
        .json({
          ok: false,
          error: "This spot has changed. Reload it before saving.",
        });
    return res
      .status(old ? 200 : 201)
      .json({ ok: true, data: spotData(rows[0]) });
  } catch (e) {
    console.error("Spots API", e.message);
    return res
      .status(500)
      .json({
        ok: false,
        error: "Could not save or load spots. Please try again.",
      });
  }
}
