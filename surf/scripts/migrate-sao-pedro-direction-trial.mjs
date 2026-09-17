import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { connect } from "./membership-migration-support.mjs";
import { validateCalibration } from "../lib/conditions/calibration.mjs";
import { directionTrial, trialNotes, trialId, slugs, changeNote, source } from "./sao-pedro-direction-trial.mjs";

// Deliberately no production option. A later release needs its own reviewed
// baseline because production has not received the preceding small-wave trial.
const [action = "--rehearse", ...extra] = process.argv.slice(2);
assert(["--rehearse", "--apply"].includes(action) && !extra.length);
const evidence = new URL("../docs/archive/calibration/2026-09-17-sao-pedro-direction/", import.meta.url);
const baseline = JSON.parse(await fs.readFile(new URL("staging-before.json", evidence)));
const policy = await fs.readFile(new URL("./sao-pedro-direction-trial.mjs", import.meta.url));
const checksum = createHash("sha256").update(policy).digest("hex");
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const db = await connect("staging");
try {
  await db.query("BEGIN");
  await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='45s'");
  await db.query("SELECT pg_advisory_xact_lock(2026091702)");
  const prior = (await db.query("SELECT checksum FROM identity_schema_migrations WHERE id=$1", [trialId])).rows[0];
  assert(!prior, "Trial already recorded; inspect current history rather than reapply");
  const rows = (await db.query("SELECT * FROM surf_spots ORDER BY slug FOR UPDATE")).rows;
  // Compare hashes to avoid storing complete database records in the repository.
  assert.deepEqual(rows.map(s=>({slug:s.slug,version:s.version,sha256:digest(s)})), baseline.catalogue, "Spot data changed since the reviewed baseline");
  assert.equal(digest((await db.query("SELECT * FROM surf_calibration_settings")).rows), baseline.profileHash);
  const schema = (await db.query("SELECT schema FROM calibration_schema_versions WHERE version=3")).rows[0].schema;
  const revisions = [];
  for (const spot of rows.filter(s => slugs.includes(s.slug))) {
    const config = validateCalibration(directionTrial(spot.calibration_config, spot.slug), schema);
    const notes = trialNotes(spot.notes);
    assert(notes.length <= 2000);
    const sources = [...spot.sources, source];
    const changed = await db.query(`WITH changed AS (
      UPDATE surf_spots SET calibration_config=$2,notes=$3,sources=$4,
        version=version+1,updated_at=now()
      WHERE id=$1 AND version=$5 RETURNING *)
      INSERT INTO spot_calibration_history(spot_id,version,calibration,notes,schema_version,change_note,sources)
      SELECT id,version,calibration_config,notes,calibration_schema_version,$6,sources FROM changed`,
    [spot.id, config, notes, JSON.stringify(sources), spot.version, changeNote]);
    assert.equal(changed.rowCount, 1);
    revisions.push({slug:spot.slug,before:spot.version,after:spot.version+1});
  }
  assert.equal(revisions.length, 2);
  await db.query("INSERT INTO identity_schema_migrations(id,checksum) VALUES($1,$2)", [trialId,checksum]);
  const after = (await db.query("SELECT * FROM surf_spots ORDER BY slug")).rows;
  for (const old of rows) {
    const current = after.find(s => s.slug === old.slug);
    if (!slugs.includes(old.slug)) assert.deepEqual(current,old);
    else {
      for (const key of Object.keys(old).filter(k => !["calibration_config","notes","sources","version","updated_at"].includes(k)))
        assert.deepEqual(current[key],old[key],`${old.slug}: ${key}`);
    }
  }
  await db.query(action === "--apply" ? "COMMIT" : "ROLLBACK");
  const receipt = {environment:"staging",trialId,checksum,revisions,checkedAt:new Date().toISOString(),state:action === "--apply" ? "applied" : "transaction_rolled_back"};
  await fs.writeFile(new URL(action === "--apply" ? "staging-receipt.json" : "rehearsal.json",evidence),JSON.stringify(receipt,null,2)+"\n");
  console.log(JSON.stringify(receipt));
} catch(error) {
  await db.query("ROLLBACK").catch(()=>{});
  console.error(error.message);
  process.exitCode=1;
} finally { await db.end(); }
