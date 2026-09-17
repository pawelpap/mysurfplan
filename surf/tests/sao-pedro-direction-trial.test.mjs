import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { directionTrial } from "../scripts/sao-pedro-direction-trial.mjs";
import { scoreConditions, directionExposure, dateKey, hourLabel, tideFit } from "../lib/conditions/model.mjs";
import { validateCalibration } from "../lib/conditions/calibration.mjs";

const root = new URL("../docs/archive/calibration/2026-09-17-sao-pedro-direction/",import.meta.url);
const baseline = JSON.parse(fs.readFileSync(new URL("staging-before.json",root)));
const schema = JSON.parse(fs.readFileSync(new URL("schema.json",root)));
const forecasts = JSON.parse(gunzipSync(fs.readFileSync(new URL("forecasts-before.json.gz",root)))).forecasts;
const catalogue = JSON.parse(fs.readFileSync(new URL("./fixtures/small-wave-baseline-20260917.json",import.meta.url)));

test("São Pedro direction trial preserves other spots and break-specific controls",()=>{
  for(const spot of [...baseline.rows,...catalogue.filter(s=>!baseline.rows.some(b=>b.slug===s.slug))]) {
    const next=validateCalibration(directionTrial(spot.calibration_config,spot.slug),schema);
    if(!forecasts.some(f=>f.spot.slug===spot.slug)) assert.deepEqual(next,spot.calibration_config);
    else {
      for(const key of Object.keys(next).filter(k=>k!=="exposureByDirection"))
        assert.deepEqual(next[key],spot.calibration_config[key],`${spot.slug}: ${key}`);
      assert.throws(()=>directionTrial({...next,marineModel:"ncep_gfswave025"},spot.slug));
    }
  }
});

test("Saturday mixed swell becomes rideable while all of Sunday remains small",()=>{
  for(const f of forecasts) {
    const c=directionTrial(f.spot.calibration,f.spot.slug);
    const saturday=f.hours.filter(h=>dateKey(h.time,f.spot.timezone)==="2026-09-19" && ["08:00","09:00","12:00"].includes(hourLabel(h.time,f.spot.timezone)));
    assert.equal(saturday.length,3);
    for(const h of saturday) {
      const after=scoreConditions(h,c);
      assert.equal(h.quality,"Flat / too small");
      assert.equal(after.quality,"Fair");
      assert(after.surfMin>=0.3 && after.surfMax<=0.6);
      assert.equal(after.level,"Intermediate");
      assert(after.swellComponents.find(s=>s.name==="Secondary").localHeight>0.2);
      assert.deepEqual(scoreConditions({...h,time:h.time+86400000*50},c),after);
    }
    const sunday=f.hours.filter(h=>dateKey(h.time,f.spot.timezone)==="2026-09-20");
    assert.equal(sunday.length,24);
    assert(sunday.every(h=>scoreConditions(h,c).quality==="Flat / too small"));
  }
});

test("established western response, northerly shelter and extreme-condition limits remain",()=>{
  const hour={swellHeight:0.9,swellPeriod:10,swellDirection:283,windSpeed:8,windDirection:0,windGusts:12,weatherCode:0,tide:{ratio:0.1},windWaveHeight:0};
  for(const f of forecasts) {
    const old=f.spot.calibration,c=directionTrial(old,f.spot.slug);
    assert.deepEqual(scoreConditions(hour,c),scoreConditions(hour,old));
    for(const direction of [0,90,180,225,270,280,283,315,330,359,360])
      assert.equal(directionExposure(direction,c),directionExposure(direction,old));
    for(const direction of [310,315,330,350]) {
      const h={...hour,swellHeight:3,swellPeriod:16,swellDirection:direction,windWaveHeight:1,windWaveDirection:direction};
      assert.equal(scoreConditions(h,c).quality,"Flat / too small");
    }
    assert.equal(scoreConditions({...hour,swellHeight:0.2,swellDirection:270},c).quality,"Flat / too small");
    const storm=scoreConditions({...hour,swellHeight:2,swellDirection:299,windGusts:80},c);
    assert.equal(storm.level,"Instructor review");
    assert(storm.score<=c.severe.scoreCap);
    let previous=directionExposure(270,c);
    for(let direction=270.01;direction<360;direction+=0.01) {
      const value=directionExposure(direction,c);
      assert(value<=previous+1e-12 && previous-value<0.002);
      previous=value;
    }
  }
});

test("Bico and Bafureira retain different tide preferences",()=>{
  const bico=forecasts.find(f=>f.spot.slug==="sao-pedro-bico").spot.calibration;
  const baf=forecasts.find(f=>f.spot.slug==="sao-pedro-bafureira").spot.calibration;
  assert(tideFit(0.1,1,bico)>tideFit(0.95,1,bico));
  assert(tideFit(0.95,1,baf)>tideFit(0.1,1,baf));
});
