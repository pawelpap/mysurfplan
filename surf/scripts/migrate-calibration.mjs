import fs from "node:fs";
import pg from "pg";
import {
  convertCalibration,
  baseCalibration,
  calibrationSchema,
} from "./convert-calibration-v3.mjs";
import { validateCalibration } from "../lib/conditions/calibration.mjs";
const args = process.argv.slice(2),
  option = (k) => args[args.indexOf(k) + 1];
if (!args.includes("--env") || !args.includes("--host"))
  throw new Error("Supply --env and --host explicitly");
const env = fs.readFileSync(option("--env"), "utf8");
const value = env
  .match(/^DATABASE_URL(?:_UNPOOLED)?=(.*)$/m)?.[1]
  ?.trim()
  .replace(/^['"]|['"]$/g, "");
const url = new URL(value);
url.hostname = url.hostname.replace("-pooler", "");
if (url.hostname !== option("--host"))
  throw new Error("Database host does not match the explicit target");
url.searchParams.set("sslmode", "verify-full");
const db = new pg.Client({ connectionString: url.toString() });
try {
  await db.connect();
  await db.query("BEGIN");
  await db.query(
    fs.readFileSync(
      new URL(
        "../db/migrations/20260906_calibration_profiles.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query(
    "INSERT INTO calibration_schema_versions(version,schema) VALUES(3,$1) ON CONFLICT DO NOTHING",
    [JSON.stringify(calibrationSchema)],
  );
  await db.query(
    "INSERT INTO surf_calibration_profiles(id,version,name,schema_version,configuration,change_note) VALUES('general',1,'General surf profile',3,$1,'Initial profile preserving the previous shared calculation') ON CONFLICT DO NOTHING",
    [JSON.stringify(baseCalibration)],
  );
  await db.query(
    "INSERT INTO surf_calibration_settings(singleton,default_profile_id,default_profile_version) VALUES(true,'general',1) ON CONFLICT DO NOTHING",
  );
  const rows = (
    await db.query(
      "SELECT id,calibration FROM surf_spots WHERE calibration_config IS NULL FOR UPDATE",
    )
  ).rows;
  for (const row of rows) {
    const c = validateCalibration(
      convertCalibration(row.calibration),
      calibrationSchema,
    );
    await db.query(
      "WITH changed AS (UPDATE surf_spots SET calibration_config=$2,calibration_schema_version=3,calibration_profile_id='general',calibration_profile_version=1,version=version+1,updated_at=now() WHERE id=$1 RETURNING *) INSERT INTO spot_calibration_history(spot_id,version,calibration,notes,schema_version,change_note,sources) SELECT id,version,calibration_config,notes,3,'Migrated to generic database configuration; same forecast assumptions',sources FROM changed",
      [row.id, JSON.stringify(c)],
    );
  }
  const result = (
    await db.query(
      "SELECT count(*)::int AS spots,count(*) FILTER(WHERE validate_surf_configuration(calibration_config,calibration_schema_version))::int AS valid FROM surf_spots",
    )
  ).rows[0];
  if (result.spots !== result.valid)
    throw new Error("Some spots lack valid configuration");
  await db.query(args.includes("--apply") ? "COMMIT" : "ROLLBACK");
  console.log(
    JSON.stringify({
      mode: args.includes("--apply") ? "applied" : "dry-run",
      migrated: rows.length,
      ...result,
    }),
  );
} catch (e) {
  await db.query("ROLLBACK").catch(() => {});
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
