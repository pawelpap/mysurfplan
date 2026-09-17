import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { connect } from "./membership-migration-support.mjs";
import { trialCalibration } from "./small-wave-trial.mjs";
import { scoreConditions, tideAt, hourLabel } from "../lib/conditions/model.mjs";
import { predictTides } from "../lib/conditions/tides.mjs";
import { bestDayWindow } from "../lib/conditions/day-window.mjs";
import { sunlightForDay } from "../lib/conditions/sunlight.mjs";

const [environment, output] = process.argv.slice(2);
const baseline = JSON.parse(await fs.readFile(new URL("../tests/fixtures/small-wave-baseline-20260917.json", import.meta.url)));
const db = await connect(environment);
const result = { environment, checkedAt: new Date().toISOString(), spots: [], archiveChecks: [] };
try {
  const spots = (await db.query(`SELECT s.*,f.payload,f.fetched_at,t.data AS tide_data
    FROM surf_spots s LEFT JOIN spot_forecasts f ON f.spot_id=s.id
    LEFT JOIN tide_stations t ON t.id=s.tide_station_id ORDER BY s.slug`)).rows;
  for (const spot of spots) {
    const before = baseline.find((s) => s.slug === spot.slug);
    assert(before);
    assert.equal(spot.version, before.version + 1);
    assert.deepEqual(spot.calibration_config, trialCalibration(before.calibration_config, spot.slug));
    const history = (await db.query("SELECT calibration FROM spot_calibration_history WHERE spot_id=$1 AND version=$2", [spot.id, spot.version])).rows[0];
    assert.deepEqual(history.calibration, spot.calibration_config);
    const raw = spot.payload?.hours || [];
    const counts = { before: {}, after: {}, changed: 0, hours: raw.length };
    let afterHours = [];
    if (raw.length && spot.tide_data) {
      const tide = predictTides(spot.tide_data, raw[0].time - 86400000, raw.at(-1).time + 86400000, spot.calibration_config).tides;
      afterHours = raw.map((h) => {
        const withTide = { ...h, tide: tideAt(tide, h.time, spot.calibration_config) };
        const a = scoreConditions(withTide, before.calibration_config), b = scoreConditions(withTide, spot.calibration_config);
        for (const [label, assessment] of [["before", a], ["after", b]]) counts[label][assessment.quality] = (counts[label][assessment.quality] || 0) + 1;
        if (a.quality !== b.quality) counts.changed++;
        return { ...withTide, ...b };
      });
    }
    const day = "2026-09-17";
    const window = bestDayWindow(afterHours, day, spot.timezone, sunlightForDay(day, spot));
    result.spots.push({ slug: spot.slug, version: spot.version, forecastRetrievedAt: spot.fetched_at,
      counts, window: window ? { time: window.label, score: window.condition.score, quality: window.condition.quality } : null,
      morning: afterHours.filter((h) => new Date(h.time).toISOString().startsWith(day) && ["08:00", "09:00", "12:00"].includes(hourLabel(h.time, spot.timezone))).map((h) => ({ time: hourLabel(h.time, spot.timezone), score: h.score, quality: h.quality, surf: [h.surfMin, h.surfMax] })) });
  }
  // The archive's write protections and deduplication are tested in a rollback.
  await db.query("BEGIN");
  const spotId = spots[0].id;
  const insert = `INSERT INTO spot_forecast_snapshots(spot_id,retrieved_at,recorded_at,sample_slot,expires_at,engine_version,calibration_version,snapshot)
    VALUES($1,now(),now(),now(),now()+interval '90 days','verification',1,'{}') RETURNING id`;
  const id = (await db.query(insert, [spotId])).rows[0].id;
  for (const statement of ["UPDATE spot_forecast_snapshots SET snapshot='{}' WHERE id=$1", "DELETE FROM spot_forecast_snapshots WHERE id=$1"]) {
    await db.query("SAVEPOINT denied_write");
    await assert.rejects(db.query(statement, [id]), /immutable/);
    await db.query("ROLLBACK TO SAVEPOINT denied_write");
  }
  const duplicate = await db.query(`INSERT INTO spot_forecast_snapshots(spot_id,retrieved_at,recorded_at,sample_slot,expires_at,engine_version,calibration_version,snapshot)
    SELECT spot_id,retrieved_at,recorded_at,sample_slot,expires_at,engine_version,calibration_version,snapshot FROM spot_forecast_snapshots WHERE id=$1
    ON CONFLICT (spot_id,sample_slot,engine_version,calibration_version) DO NOTHING RETURNING id`, [id]);
  assert.equal(duplicate.rowCount, 0);
  const expired = (await db.query(`INSERT INTO spot_forecast_snapshots(spot_id,retrieved_at,recorded_at,sample_slot,expires_at,engine_version,calibration_version,snapshot)
    VALUES($1,now()-interval '100 days',now()-interval '100 days',now()-interval '100 days',now()-interval '10 days','verification',1,'{}') RETURNING id`, [spotId])).rows[0].id;
  assert.equal((await db.query("DELETE FROM spot_forecast_snapshots WHERE id=$1", [expired])).rowCount, 1);
  await db.query("ROLLBACK");
  result.archiveChecks = ["update denied", "unexpired delete denied", "deduplicated", "expired retention allowed", "fixtures rolled back"];
  result.archiveCount = Number((await db.query("SELECT count(*) FROM spot_forecast_snapshots")).rows[0].count);
  if (output) await fs.writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ environment, spots: result.spots.length, archiveChecks: result.archiveChecks, archiveCount: result.archiveCount, caparica: result.spots.filter((s) => s.slug.includes("caparica")) }));
} finally {
  await db.query("ROLLBACK").catch(() => {});
  await db.end();
}
