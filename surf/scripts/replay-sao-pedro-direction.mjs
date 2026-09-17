import fs from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import assert from "node:assert/strict";
import { scoreConditions, dateKey, hourLabel } from "../lib/conditions/model.mjs";
import { bestDayWindow } from "../lib/conditions/day-window.mjs";
import { directionTrial } from "./sao-pedro-direction-trial.mjs";

const evidence = new URL("../docs/archive/calibration/2026-09-17-sao-pedro-direction/",import.meta.url);
const baseline = JSON.parse(gunzipSync(await fs.readFile(new URL("forecasts-before.json.gz",evidence))));
const compact = h => h ? {score:h.score,quality:h.quality,level:h.level,surf:[h.surfMin,h.surfMax]} : null;
const report = {type:"Identical-input replay, not measured accuracy",retrievedAt:baseline.checkedAt,spots:[]};
for(const f of baseline.forecasts) {
  const next = directionTrial(f.spot.calibration,f.spot.slug);
  const after = f.hours.map(h => ({...h,...scoreConditions(h,next)}));
  assert.equal(after.length,f.hours.length);
  const days = f.dates.map(day => {
    const sun=f.sunlight.find(s=>s.day===day);
    const before=bestDayWindow(f.hours,day,f.spot.timezone,sun);
    const changed=bestDayWindow(after,day,f.spot.timezone,sun);
    return {day,before:before?{window:before.label,...compact(before.condition)}:null,after:changed?{window:changed.label,...compact(changed.condition)}:null};
  });
  const sunday=after.filter(h=>dateKey(h.time,f.spot.timezone)==="2026-09-20");
  assert(sunday.length===24 && sunday.every(h=>h.quality==="Flat / too small"),"Small northerly Sunday should remain flat");
  report.spots.push({slug:f.spot.slug,hours:after.length,days,
    saturday:after.filter(h=>dateKey(h.time,f.spot.timezone)==="2026-09-19" && ["06:00","08:00","09:00","12:00","15:00","18:00"].includes(hourLabel(h.time,f.spot.timezone))).map(h=>({time:hourLabel(h.time,f.spot.timezone),before:compact(f.hours.find(old=>old.time===h.time)),after:compact(h),reasons:h.reasons})),
  });
}
await fs.writeFile(new URL("replay.json",evidence),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report));
