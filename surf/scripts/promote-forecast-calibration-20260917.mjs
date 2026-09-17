import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { connect } from "./membership-migration-support.mjs";
import { validateCalibration } from "../lib/conditions/calibration.mjs";
import { trialCalibration, trialId as smallId, changeNote as smallNote } from "./small-wave-trial.mjs";
import { directionTrial, trialNotes, trialId as directionId, slugs, changeNote as directionNote, source } from "./sao-pedro-direction-trial.mjs";

// Owner approved promotion after staging review on 17 September 2026.
// The applied policy files remain immutable. This wrapper promotes both
// revisions atomically, with production's own row IDs and history.
const [action = "--rehearse", ...extra] = process.argv.slice(2);
assert(["--rehearse", "--apply"].includes(action) && !extra.length);
const hash = value => createHash("sha256").update(value).digest("hex");
const ddl = await fs.readFile(new URL("../db/migrations/20260917_forecast_snapshots.sql", import.meta.url), "utf8");
const smallPolicy = await fs.readFile(new URL("./small-wave-trial.mjs", import.meta.url), "utf8");
const directionPolicy = await fs.readFile(new URL("./sao-pedro-direction-trial.mjs", import.meta.url), "utf8");
const checksums = { [smallId]: hash(ddl + smallPolicy), [directionId]: hash(directionPolicy) };
const baseline = JSON.parse(await fs.readFile(new URL("../tests/fixtures/small-wave-baseline-20260917.json", import.meta.url)));
const evidence = new URL("../docs/archive/releases/2026-09-17-forecast-production/", import.meta.url);
await fs.mkdir(evidence, { recursive: true });

const stage = await connect("staging");
let approved;
try {
  const rows = (await stage.query("SELECT * FROM surf_spots ORDER BY slug")).rows;
  const settings = (await stage.query("SELECT * FROM surf_calibration_settings")).rows[0];
  const profile = (await stage.query("SELECT * FROM surf_calibration_profiles WHERE id=$1 AND version=$2", [settings.default_profile_id, settings.default_profile_version])).rows[0];
  for (const [id, checksum] of Object.entries(checksums))
    assert.equal((await stage.query("SELECT checksum FROM identity_schema_migrations WHERE id=$1", [id])).rows[0]?.checksum, checksum);
  assert.equal(rows.length, baseline.length);
  for (const row of rows) {
    const old = baseline.find(s => s.slug === row.slug);
    assert(old, "Unreviewed staging spot");
    assert.equal(row.version, old.version + 1 + Number(slugs.includes(row.slug)));
    assert.deepEqual(row.calibration_config, directionTrial(trialCalibration(old.calibration_config, row.slug), row.slug));
  }
  approved = { rows, profile };
} finally { await stage.end(); }

const db = await connect("production");
try {
  await db.query("BEGIN");
  await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='45s'");
  await db.query("SELECT pg_advisory_xact_lock(2026091701)");
  await db.query("SELECT pg_advisory_xact_lock(2026091702)");
  const prior = (await db.query("SELECT id,checksum FROM identity_schema_migrations WHERE id=ANY($1::text[])", [Object.keys(checksums)])).rows;
  assert.equal(prior.length, 0, "A release migration is already present; inspect before retrying");
  const rows = (await db.query("SELECT * FROM surf_spots ORDER BY slug FOR UPDATE")).rows;
  const schema = (await db.query("SELECT schema FROM calibration_schema_versions WHERE version=3")).rows[0].schema;
  assert.equal(rows.length, baseline.length);
  for (const row of rows) {
    const old = baseline.find(s => s.slug === row.slug);
    assert(old);
    assert.equal(row.version, old.version, `Concurrent revision: ${row.slug}`);
    assert.deepEqual(row.calibration_config, old.calibration_config, `Concurrent calibration: ${row.slug}`);
  }
  const settings = (await db.query("SELECT * FROM surf_calibration_settings FOR UPDATE")).rows[0];
  const profile = (await db.query("SELECT * FROM surf_calibration_profiles WHERE id=$1 AND version=$2", [settings.default_profile_id, settings.default_profile_version])).rows[0];
  const version = Number((await db.query("SELECT max(version) AS version FROM surf_calibration_profiles WHERE id=$1", [profile.id])).rows[0].version) + 1;
  const configuration = validateCalibration(trialCalibration(profile.configuration), schema);
  assert.equal(profile.id, approved.profile.id);
  assert.equal(version, approved.profile.version);
  assert.deepEqual(configuration, approved.profile.configuration);
  await db.query(ddl);
  await db.query("INSERT INTO surf_calibration_profiles(id,version,name,schema_version,configuration,change_note,sources) VALUES($1,$2,$3,3,$4,$5,$6)",
    [profile.id, version, profile.name, configuration, smallNote, JSON.stringify(profile.sources)]);
  await db.query("UPDATE surf_calibration_settings SET default_profile_version=$1", [version]);
  for (const row of rows) {
    const config = validateCalibration(trialCalibration(row.calibration_config, row.slug), schema);
    await db.query(`WITH changed AS (
      UPDATE surf_spots SET calibration_config=$2,version=version+1,updated_at=now() WHERE id=$1 RETURNING *)
      INSERT INTO spot_calibration_history(spot_id,version,calibration,notes,schema_version,change_note,sources)
      SELECT id,version,calibration_config,notes,calibration_schema_version,$3,sources FROM changed`, [row.id, config, smallNote]);
  }
  await db.query("INSERT INTO identity_schema_migrations(id,checksum) VALUES($1,$2)", [smallId, checksums[smallId]]);
  const productionNote = directionNote.replace("Staging only; production approval remains withheld.", "Owner approved production on 17 September 2026 after reviewing staging.");
  for (const old of rows.filter(s => slugs.includes(s.slug))) {
    const config = validateCalibration(directionTrial(trialCalibration(old.calibration_config, old.slug), old.slug), schema);
    const notes = trialNotes(old.notes);
    const sources = [...old.sources, source];
    const reviewed = approved.rows.find(s => s.slug === old.slug);
    assert.equal(notes, reviewed.notes);
    assert.deepEqual(sources, reviewed.sources);
    const result = await db.query(`WITH changed AS (
      UPDATE surf_spots SET calibration_config=$2,notes=$3,sources=$4,version=version+1,updated_at=now()
      WHERE id=$1 AND version=$5 RETURNING *)
      INSERT INTO spot_calibration_history(spot_id,version,calibration,notes,schema_version,change_note,sources)
      SELECT id,version,calibration_config,notes,calibration_schema_version,$6,sources FROM changed`,
    [old.id, config, notes, JSON.stringify(sources), old.version + 1, productionNote]);
    assert.equal(result.rowCount, 1);
  }
  await db.query("INSERT INTO identity_schema_migrations(id,checksum) VALUES($1,$2)", [directionId, checksums[directionId]]);
  const after = (await db.query("SELECT * FROM surf_spots ORDER BY slug")).rows;
  for (const old of rows) {
    const current = after.find(s => s.id === old.id);
    const reviewed = approved.rows.find(s => s.slug === old.slug);
    assert.equal(current.version, reviewed.version);
    assert.deepEqual(current.calibration_config, reviewed.calibration_config);
    const allowed = ["calibration_config", "version", "updated_at", ...(slugs.includes(old.slug) ? ["notes", "sources"] : [])];
    for (const key of Object.keys(old).filter(k => !allowed.includes(k))) assert.deepEqual(current[key], old[key]);
    const history = (await db.query("SELECT calibration,notes,sources FROM spot_calibration_history WHERE spot_id=$1 AND version=$2", [current.id, current.version])).rows;
    assert.equal(history.length, 1);
    assert.deepEqual(history[0].calibration, current.calibration_config);
    assert.equal(history[0].notes, current.notes);
    assert.deepEqual(history[0].sources, current.sources);
  }
  const receipt = { environment: "production", checkedAt: new Date().toISOString(), state: action === "--apply" ? "applied" : "transaction_rolled_back", checksums,
    profile: { id: profile.id, version }, spotParityWithStaging: true, preservedOtherSpotFields: true,
    revisions: after.map(s => ({ slug: s.slug, before: rows.find(old => old.id === s.id).version, after: s.version, calibrationHash: hash(JSON.stringify(s.calibration_config)) })) };
  await db.query(action === "--apply" ? "COMMIT" : "ROLLBACK");
  await fs.writeFile(new URL(action === "--apply" ? "migration.json" : "rehearsal.json", evidence), JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt));
} catch (error) {
  await db.query("ROLLBACK").catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally { await db.end(); }
