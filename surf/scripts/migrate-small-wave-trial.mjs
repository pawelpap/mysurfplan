import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { connect } from "./membership-migration-support.mjs";
import { trialCalibration, trialId, changeNote } from "./small-wave-trial.mjs";
import { validateCalibration } from "../lib/conditions/calibration.mjs";

const [environment, action = "--audit"] = process.argv.slice(2);
assert(["staging", "rehearsal", "production"].includes(environment));
assert(["--audit", "--rehearse", "--apply"].includes(action));
assert(action !== "--apply" || environment !== "rehearsal");
assert(environment !== "production" || action !== "--apply" || process.argv.includes("--staging-reviewed"),
  "Production requires the owner-authorised staging and comparison review first");
const ddl = await fs.readFile(new URL("../db/migrations/20260917_forecast_snapshots.sql", import.meta.url), "utf8");
const policy = await fs.readFile(new URL("./small-wave-trial.mjs", import.meta.url), "utf8");
const checksum = createHash("sha256").update(ddl).update(policy).digest("hex");
const expected = JSON.parse(await fs.readFile(new URL("../tests/fixtures/small-wave-baseline-20260917.json", import.meta.url)));
const db = await connect(environment);
try {
  await db.query("BEGIN");
  await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='45s'");
  await db.query("SELECT pg_advisory_xact_lock(2026091701)");
  const prior = (await db.query("SELECT checksum FROM identity_schema_migrations WHERE id=$1", [trialId])).rows[0];
  if (prior) {
    assert.equal(prior.checksum, checksum, "Applied migration checksum mismatch");
  } else if (action !== "--audit") {
    const spots = (await db.query("SELECT * FROM surf_spots ORDER BY slug FOR UPDATE")).rows;
    assert.equal(spots.length, 17, "Review catalogue additions before migrating");
    const schema = (await db.query("SELECT schema FROM calibration_schema_versions WHERE version=3")).rows[0].schema;
    const settings = (await db.query("SELECT * FROM surf_calibration_settings FOR UPDATE")).rows[0];
    const profile = (await db.query("SELECT * FROM surf_calibration_profiles WHERE id=$1 AND version=$2", [settings.default_profile_id, settings.default_profile_version])).rows[0];
    const profileVersion = Number((await db.query("SELECT max(version) AS version FROM surf_calibration_profiles WHERE id=$1", [profile.id])).rows[0].version) + 1;
    const profileConfiguration = validateCalibration(trialCalibration(profile.configuration), schema);
    await db.query(ddl);
    await db.query("INSERT INTO surf_calibration_profiles(id,version,name,schema_version,configuration,change_note,sources) VALUES($1,$2,$3,3,$4,$5,$6)", [profile.id, profileVersion, profile.name, profileConfiguration, changeNote, JSON.stringify(profile.sources)]);
    await db.query("UPDATE surf_calibration_settings SET default_profile_version=$1", [profileVersion]);
    const revisions = [];
    for (const spot of spots) {
      if (environment !== "rehearsal") {
        const baseline = expected.find((s) => s.slug === spot.slug);
        assert(baseline, "Unknown spot");
        assert.equal(spot.version, baseline.version, `Concurrent revision: ${spot.slug}`);
        assert.deepEqual(spot.calibration_config, baseline.calibration_config, `Concurrent calibration: ${spot.slug}`);
      }
      const calibration = validateCalibration(trialCalibration(spot.calibration_config, spot.slug), schema);
      await db.query(`WITH changed AS (
        UPDATE surf_spots SET calibration_config=$2,version=version+1,updated_at=now()
        WHERE id=$1 RETURNING *)
        INSERT INTO spot_calibration_history(spot_id,version,calibration,notes,schema_version,change_note,sources)
        SELECT id,version,calibration_config,notes,calibration_schema_version,$3,sources FROM changed`,
      [spot.id, calibration, changeNote]);
      revisions.push({ slug: spot.slug, before: spot.version, after: spot.version + 1 });
    }
    await db.query("INSERT INTO identity_schema_migrations(id,checksum) VALUES($1,$2)", [trialId, checksum]);
    console.log(JSON.stringify({ revisions, defaultProfile: { id: profile.id, version: profileVersion } }));
  }
  await db.query(action === "--apply" ? "COMMIT" : "ROLLBACK");
  console.log(JSON.stringify({ environment, trialId, checksum, state: prior ? "already_applied" : action === "--apply" ? "applied" : action === "--rehearse" ? "transaction_rolled_back" : "not_applied" }));
} catch (error) {
  await db.query("ROLLBACK").catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally { await db.end(); }
