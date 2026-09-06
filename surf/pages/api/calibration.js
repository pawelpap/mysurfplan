import { sql } from "../../lib/db";
import { requireAuth } from "../../lib/auth";
import { validateCalibration } from "../../lib/conditions/calibration.mjs";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  const session = requireAuth(req, res, { roles: ["platform_admin"] });
  if (!session) return;
  if (session.role !== "platform_admin")
    return res
      .status(403)
      .json({
        ok: false,
        error: "Only platform admins can manage calibration.",
      });
  try {
    const [settings] =
      await sql`SELECT p.*,s.schema FROM surf_calibration_settings d JOIN surf_calibration_profiles p ON p.id=d.default_profile_id AND p.version=d.default_profile_version JOIN calibration_schema_versions s ON s.version=p.schema_version WHERE d.singleton=true`;
    if (!settings)
      throw new Error("No default calibration profile configured.");
    if (req.method === "GET") {
      const history = req.query.spotId
        ? await sql`SELECT version,calibration,notes,change_note,sources,schema_version,created_at FROM spot_calibration_history WHERE spot_id::text=${req.query.spotId} ORDER BY version DESC LIMIT 50`
        : [];
      const profiles =
        await sql`SELECT DISTINCT ON(id) id,version,name,schema_version,configuration FROM surf_calibration_profiles ORDER BY id,version DESC`;
      const stations =
        await sql`SELECT id,name FROM tide_stations ORDER BY name`;
      return res.json({
        ok: true,
        data: {
          schema: settings.schema,
          defaultProfile: settings,
          profiles,
          history,
          stations,
        },
      });
    }
    if (req.method === "PUT") {
      const note =
        typeof req.body?.changeNote === "string"
          ? req.body.changeNote.trim()
          : "";
      if (!note || note.length > 2000)
        return res
          .status(400)
          .json({
            ok: false,
            error: "Add a change note (up to 2,000 characters).",
          });
      let c;
      try {
        c = validateCalibration(req.body.calibration, settings.schema);
      } catch (e) {
        return res.status(400).json({ ok: false, error: e.message });
      }
      if (req.body.version !== settings.version)
        return res
          .status(409)
          .json({
            ok: false,
            error: "The default profile changed. Reload before saving.",
          });
      const changed =
        await sql`WITH claimed AS (UPDATE surf_calibration_settings SET default_profile_version=default_profile_version+1 WHERE singleton=true AND default_profile_id=${settings.id} AND default_profile_version=${settings.version} RETURNING default_profile_id,default_profile_version), added AS (INSERT INTO surf_calibration_profiles(id,version,name,schema_version,configuration,change_note,changed_by) SELECT default_profile_id,default_profile_version,${settings.name},${c.schemaVersion},${JSON.stringify(c)}::jsonb,${note},${session.userId}::uuid FROM claimed RETURNING *) SELECT * FROM added`;
      if (!changed.length)
        return res
          .status(409)
          .json({
            ok: false,
            error: "The default profile changed. Reload before saving.",
          });
      return res.json({ ok: true, data: changed[0] });
    }
    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    console.error("Calibration API", e.message);
    return res
      .status(503)
      .json({
        ok: false,
        error: "Calibration settings are unavailable. Please try again.",
      });
  }
}
