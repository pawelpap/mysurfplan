import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { directionTrial, slugs } from "./sao-pedro-direction-trial.mjs";
import { scoreConditions } from "../lib/conditions/model.mjs";
import { bestDayWindow } from "../lib/conditions/day-window.mjs";
const evidence = new URL("../docs/archive/calibration/2026-09-17-sao-pedro-direction/",import.meta.url);
const before = JSON.parse(await fs.readFile(new URL("staging-before.json",evidence)));
const base="https://staging.mywaveplan.com";
const headers={"Content-Type":"application/json","X-MyWavePlan-Request":"1",Origin:base};
const login=await fetch(base+"/api/auth/login",{method:"POST",headers,body:JSON.stringify({email:"",password:""})});
assert.equal(login.status,200);
const auth={...headers,Cookie:login.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ")};
const read=async path=>{
  const response=await fetch(base+path,{headers:auth,signal:AbortSignal.timeout(120000)});
  assert.equal(response.status,200,path);
  return (await response.json()).data;
};
try {
  const forecasts=await Promise.all(slugs.map(slug=>read("/api/conditions?spot="+slug)));
  const result={base,checkedAt:new Date().toISOString(),checks:[]};
  for(const f of forecasts) {
    const old=before.rows.find(s=>s.slug===f.spot.slug);
    assert.equal(f.spot.version,old.version+1);
    assert.deepEqual(f.spot.calibration,directionTrial(old.calibration_config,old.slug));
    assert.equal(f.dates.length,16);
    assert.equal(f.issues.length,0);
    for(const h of f.hours) {
      const expected=scoreConditions(h,f.spot.calibration);
      for(const key of ["score","quality","tone","level","surfMin","surfMax"])
        assert.deepEqual(h[key],expected[key]);
    }
  }
  for(const day of ["2026-09-19","2026-09-20"]) {
    const summaries=await read(`/api/conditions/summaries?spots=${forecasts.map(f=>f.spot.id).join(",")}&day=${day}`);
    for(const f of forecasts) {
      const s=summaries[f.spot.id];
      const expected=bestDayWindow(f.hours,day,f.spot.timezone,f.sunlight.find(sun=>sun.day===day));
      assert.equal(s.day,day);
      assert.deepEqual(s.window,{start:expected.start,end:expected.end,label:expected.label});
      for(const key of ["score","quality","tone","level","surfMin","surfMax"])
        assert.deepEqual(s.condition[key],expected.condition[key]);
      result.checks.push({slug:f.spot.slug,version:f.spot.version,day,window:s.window.label,quality:s.condition.quality,score:s.condition.score,surf:[s.condition.surfMin,s.condition.surfMax],summaryCalendarParity:true,hours:f.hours.length});
    }
  }
  assert.equal((await fetch(base+"/api/conditions?spot=sao-pedro-bico")).status,401);
  assert.equal((await fetch(base+"/api/spots",{method:"POST",headers:auth,body:"{}"})).status,403);
  result.permissionsVerified=true;
  const weatherFixtures=forecasts.map(f=>({spot:{slug:f.spot.slug,version:f.spot.version,timezone:f.spot.timezone,calibration:f.spot.calibration},hours:f.hours,dates:f.dates,sunlight:f.sunlight,model:f.model,marineGrid:f.marineGrid,fetchedAt:f.fetchedAt,issues:f.issues}));
  await fs.writeFile(new URL("forecasts-after.json.gz",evidence),gzipSync(JSON.stringify({checkedAt:result.checkedAt,forecasts:weatherFixtures})));
  await fs.writeFile(new URL("live-checks.json",evidence),JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result));
} finally {
  const logout=await fetch(base+"/api/auth/session",{method:"DELETE",headers:auth});
  assert.equal(logout.status,200);
}
