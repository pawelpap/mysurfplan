import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {connect,fingerprint} from './membership-migration-support.mjs';

assert(process.argv.length===2,'Rehearsal only; no environment override');
const clients=[],users=[],schools=[],spots=[],checks=[];
const prefix='b5-spots-race-'+randomUUID();
let before;
const scalar=async(c,q,p=[])=>Object.values((await c.query(q,p)).rows[0])[0];
const observe=promise=>promise.then(value=>({ok:true,value}),error=>({ok:false,code:error.code}));
async function blockedBy(observer,waiter,holder){
 const start=Date.now();
 while(Date.now()-start<4000){
  if(await scalar(observer,'SELECT $1::int=ANY(pg_blocking_pids($2::int))',[holder.databasePid,waiter.databasePid]))return;
  await new Promise(resolve=>setTimeout(resolve,20));
 }
 assert.fail('Expected a real school/catalogue/lesson lock wait');
}
async function person(c,label){const id=randomUUID();users.push(id);await c.query("INSERT INTO users(id,name,email,role,email_verified_at) VALUES($1,$2,$3,'student',now())",[id,prefix+label,prefix+label+'@example.invalid']);return id;}
const lesson=(spot,extra={})=>({startAt:new Date(Date.now()+86400000).toISOString(),durationMin:90,difficulty:'Beginner',place:'Synthetic entrance',capacity:2,spotId:spot,coachIds:[],...extra});
const mutate=(c,actor,school,operation,id,details)=>scalar(c,'SELECT mutate_school_lesson($1,$2,$3,$4,$5::jsonb)',[actor,school,operation,id,details]);
try{
 for(let n=0;n<3;n++){
  const c=await connect('rehearsal');clients.push(c);await c.query("SET lock_timeout='10s';SET statement_timeout='20s';SET idle_in_transaction_session_timeout='30s'");c.databasePid=await scalar(c,'SELECT pg_backend_pid()');
 }
 const [main,a,b]=clients;
 assert.equal(await scalar(main,"SELECT to_regprocedure('mutate_school_lesson(uuid,uuid,text,uuid,jsonb)') IS NOT NULL"),true,'Apply reviewed location/spot migration to isolated rehearsal before races');
 before=await fingerprint(main);
 const platform=await person(main,'platform'),admin=await person(main,'admin'),studentA=await person(main,'student-a'),studentB=await person(main,'student-b');
 await main.query('INSERT INTO platform_role_assignments(user_id) VALUES($1)',[platform]);
 const school=await scalar(main,'INSERT INTO schools(name) VALUES($1) RETURNING id',[prefix+'-school']);schools.push(school);
 await main.query("SELECT set_school_access($1,$2,$3,ARRAY['school_admin'],'active')",[platform,admin,school]);
 // Synthetic catalogue fixtures allow committed deactivation races without
 // changing any real spot, forecast, calibration or source-history record.
 for(let n=0;n<2;n++){
  const id=randomUUID();spots.push(id);
  await main.query(`INSERT INTO surf_spots SELECT (jsonb_populate_record(NULL::surf_spots,
   (SELECT to_jsonb(sp) FROM surf_spots sp WHERE active ORDER BY id LIMIT 1)||
   jsonb_build_object('id',$1::uuid,'slug',$2::text,'name',$2::text,'created_at',now(),'updated_at',now()))).*`,[id,prefix+'-spot-'+n]);
 }
 const details={name:prefix+'-school',description:'',timezone:'Europe/Lisbon',contactEmail:'',contactPhone:'',website:'',socialLinks:[],operatingSpotIds:spots};
 const save=async(c,chosen)=>{
  const revision=await scalar(c,'SELECT settings_revision FROM schools WHERE id=$1',[school]);
  return scalar(c,'SELECT update_school_settings($1,$2,$3,$4::jsonb)',[admin,school,revision,{...details,operatingSpotIds:chosen}]);
 };
 await save(main,spots);
 await a.query('BEGIN');const future=await mutate(a,admin,school,'create',null,lesson(spots[0]));
 const removeAfter=observe(save(b,[spots[1]]));await blockedBy(main,b,a);await a.query('COMMIT');
 assert.deepEqual(await removeAfter,{ok:false,code:'P0004'});
 checks.push('create first: waiting removal sees committed upcoming lesson and preserves the association');
 await mutate(main,admin,school,'delete',future.id,null);

 await a.query('BEGIN');await save(a,[spots[1]]);
 const createAfter=observe(mutate(b,admin,school,'create',null,lesson(spots[0])));await blockedBy(main,b,a);await a.query('COMMIT');
 assert.deepEqual(await createAfter,{ok:false,code:'22023'});
 checks.push('removal first: waiting create rechecks the operating set and leaves no lesson');
 await save(main,spots);

 const past=await mutate(main,admin,school,'create',null,lesson(spots[0],{startAt:new Date(Date.now()-7200000).toISOString(),durationMin:30}));
 await a.query('BEGIN');await mutate(a,admin,school,'update',past.id,lesson(spots[0]));
 const rescheduleRemoval=observe(save(b,[spots[1]]));await blockedBy(main,b,a);await a.query('COMMIT');
 assert.deepEqual(await rescheduleRemoval,{ok:false,code:'P0004'});
 await mutate(main,admin,school,'delete',past.id,null);
 checks.push('past-to-future reschedule first: waiting removal sees the new future use');

 await a.query('BEGIN');await a.query('UPDATE surf_spots SET active=false WHERE id=$1',[spots[0]]);
 const inactive=observe(mutate(b,admin,school,'create',null,lesson(spots[0])));await blockedBy(main,b,a);await a.query('COMMIT');
 assert.deepEqual(await inactive,{ok:false,code:'22023'});
 await main.query('UPDATE surf_spots SET active=true WHERE id=$1',[spots[0]]);
 checks.push('catalogue deactivation first: waiting create rechecks the locked active row');

 await a.query('BEGIN');await a.query("SELECT set_school_access($1,$2,$3,ARRAY[]::text[],'suspended')",[platform,admin,school]);
 const revoked=observe(mutate(b,admin,school,'create',null,lesson(spots[0])));await blockedBy(main,b,a);await a.query('COMMIT');
 assert.deepEqual(await revoked,{ok:false,code:'42501'});
 await main.query("SELECT set_school_access($1,$2,$3,ARRAY['school_admin'],'active')",[platform,admin,school]);
 checks.push('administrator revocation first: waiting create rechecks authority after the school lock');

 await a.query('BEGIN');await a.query("UPDATE schools SET workspace_status='closed' WHERE id=$1",[school]);
 const closed=observe(mutate(b,admin,school,'create',null,lesson(spots[0])));await blockedBy(main,b,a);await a.query('COMMIT');
 assert.deepEqual(await closed,{ok:false,code:'42501'});await main.query("UPDATE schools SET workspace_status='draft' WHERE id=$1",[school]);
 checks.push('school closure first: waiting create cannot enter a closed workspace');

 for(const [id,label]of[[studentA,'a'],[studentB,'b']])await main.query('INSERT INTO students(school_id,user_id,name,email) SELECT $1,id,$2,email FROM users WHERE id=$3',[school,prefix+label,id]);
 const booked=await mutate(main,admin,school,'create',null,lesson(spots[1]));
 await main.query('SELECT * FROM reserve_lesson($1,$2,false,NULL,NULL)',[studentA,booked.id]);
 await a.query('BEGIN');await mutate(a,admin,school,'update',booked.id,lesson(spots[1],{capacity:1}));
 const bookAfter=observe(b.query('SELECT * FROM reserve_lesson($1,$2,false,NULL,NULL)',[studentB,booked.id]));await blockedBy(main,b,a);await a.query('COMMIT');
 assert.deepEqual(await bookAfter,{ok:false,code:'P0003'});
 await mutate(main,admin,school,'update',booked.id,lesson(spots[1],{capacity:2}));
 await a.query('BEGIN');await a.query('SELECT * FROM reserve_lesson($1,$2,false,NULL,NULL)',[studentB,booked.id]);
 const capacityAfter=observe(mutate(b,admin,school,'update',booked.id,lesson(spots[1],{capacity:1})));await blockedBy(main,b,a);await a.query('COMMIT');
 assert.deepEqual(await capacityAfter,{ok:false,code:'23514'});
 checks.push('capacity reduction versus booking in both orders preserves the capacity/booked-count invariant');
 console.log(JSON.stringify({environment:'rehearsal',checks,providerRequests:0}));
}finally{
 for(const c of clients)await c.query('ROLLBACK').catch(()=>{});
 const main=clients[0];
 if(main&&users.length){
  await main.query('BEGIN');
  try{
   await main.query('DELETE FROM school_access_events WHERE school_id=ANY($1::uuid[])',[schools]);
   await main.query('DELETE FROM schools WHERE id=ANY($1::uuid[])',[schools]);
   await main.query('DELETE FROM platform_role_assignments WHERE user_id=ANY($1::uuid[])',[users]);
   await main.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   await main.query('DELETE FROM surf_spots WHERE id=ANY($1::uuid[])',[spots]);
   if(before)assert.deepEqual(await fingerprint(main),before,'Existing application fingerprints changed');
   await main.query('COMMIT');console.log(JSON.stringify({cleanup:'complete',users:users.length,schools:schools.length,syntheticSpots:spots.length}));
  }catch(error){await main.query('ROLLBACK');throw error;}
 }
 for(const c of clients)await c.end();
}
