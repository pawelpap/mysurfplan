import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { connect,fingerprint } from './membership-migration-support.mjs';

assert(process.argv.length===2,'Rehearsal only; no environment override');
const clients=[],users=[],schools=[],checks=[];const prefix=`b7-race-${randomUUID()}`;
const hash=value=>createHash('sha256').update(value).digest('hex');
const row=async(c,q,p=[]) => (await c.query(q,p)).rows[0];
const scalar=async(c,q,p=[])=>Object.values(await row(c,q,p))[0];
const observe=promise=>promise.then(value=>({ok:true,value}),error=>({ok:false,code:error.code}));
let before;
async function blockedBy(observer,waiter,holder){const started=Date.now();while(Date.now()-started<4000){
 if(await scalar(observer,'SELECT $1::int=ANY(pg_blocking_pids($2::int))',[holder.databasePid,waiter.databasePid]))return;
 await new Promise(resolve=>setTimeout(resolve,20));}assert.fail('Expected a real row-lock wait');}
async function person(c,label){const id=randomUUID();users.push(id);await c.query("INSERT INTO users(id,name,email,role,email_verified_at) VALUES($1,$2,$3,'student',now())",[id,prefix+label,prefix+label+'@example.invalid']);return id;}
const reserve=(c,actor,school)=>scalar(c,'SELECT reserve_media_upload($1,$2,$3,$4,$5,$6,NULL,NULL)',[actor,school,'gallery',randomUUID(),hash(randomUUID()),hash('source')]);
try{
 for(let n=0;n<3;n++){const c=await connect('rehearsal');clients.push(c);await c.query("SET lock_timeout='10s';SET statement_timeout='20s';SET idle_in_transaction_session_timeout='30s'");c.databasePid=await scalar(c,'SELECT pg_backend_pid()');}
 const[main,a,b]=clients;before=await fingerprint(main);
 assert.equal(await scalar(main,"SELECT count(*)::int FROM identity_schema_migrations WHERE id='20261111_school_media'"),1);
 const adminA=await person(main,'admin-a'),adminB=await person(main,'admin-b'),platform=await person(main,'platform');
 await main.query('INSERT INTO platform_role_assignments(user_id) VALUES($1)',[platform]);
 const school=await scalar(main,'INSERT INTO schools(name) VALUES($1) RETURNING id',[prefix]);schools.push(school);
 for(const actor of[adminA,adminB])await main.query("SELECT set_school_access($1,$2,$3,ARRAY['school_admin'],'active')",[platform,actor,school]);
 // Synthetic metering objects only. They are never sent to Blob, and are
 // removed by exact recorded actor IDs at closeout. Nine16MiB assets leave one
 // reservation slot; the pending-count guard is not the reason for denial.
 for(let n=0;n<9;n++){
  const asset=await scalar(main,`INSERT INTO media_assets(owner_school_id,uploaded_by,environment,purpose,state,request_id,fingerprint,source_hash,reserved_bytes,byte_count)
   VALUES($1,$2,'staging','gallery','ready',$3,$4,$4,0,16777216) RETURNING id`,[school,adminA,randomUUID(),hash(randomUUID())]);
  const object=randomUUID();await main.query(`INSERT INTO media_objects(id,asset_id,access,role,store_id,pathname,byte_count,checksum,width,height,state)
   VALUES($1,$2,'private','master','store_u6aKFjGejriy7AVL',$3,16777216,$4,128,128,'written')`,[object,asset,`staging/private/${asset}/${object}.webp`,hash('metering')]);
 }
 assert.equal(Number(await scalar(main,"SELECT media_owner_usage('school',$1)",[school])),9*16777216);
 await a.query('BEGIN');const asset=await reserve(a,adminA,school);
 const competitor=observe(reserve(b,adminB,school));await blockedBy(main,b,a);await a.query('COMMIT');
 assert.deepEqual(await competitor,{ok:false,code:'P0003'});
 assert.equal(await scalar(main,"SELECT count(*)::int FROM media_assets WHERE owner_school_id=$1 AND state='pending'",[school]),1);
 assert.equal(Number(await scalar(main,"SELECT media_owner_usage('school',$1)",[school])),167772160);
 checks.push('last school byte-quota slot serialises two administrators; one reservation commits and one rolls back');

 const variants=['master','w600','w1200'].map(role=>({role,byteCount:100,checksum:hash(role),width:128,height:128}));
 await main.query('SELECT journal_media_objects($1,$2,$3::jsonb,$4,NULL)',[adminA,asset.id,JSON.stringify(variants),'private']);
 await main.query("UPDATE media_objects SET state='written' WHERE asset_id=$1",[asset.id]);
 await a.query('BEGIN');await a.query("SELECT set_school_access($1,$2,$3,ARRAY[]::text[],'suspended')",[platform,adminA,school]);
 const finalise=observe(scalar(b,'SELECT finish_media_asset($1,$2,320,200)',[adminA,asset.id]));
 await blockedBy(main,b,a);await a.query('COMMIT');assert.deepEqual(await finalise,{ok:false,code:'42501'});
 assert.equal(await scalar(main,'SELECT state FROM media_assets WHERE id=$1',[asset.id]),'pending');
 checks.push('administrator revocation commits before waiting finalisation; uploaded objects do not become an attached ready asset');

 await main.query("SELECT set_school_access($1,$2,$3,ARRAY['school_admin'],'active')",[platform,adminA,school]);
 await scalar(main,'SELECT finish_media_asset($1,$2,320,200)',[adminA,asset.id]);
 await main.query('UPDATE media_asset_cleanup SET not_before=now() WHERE asset_id=$1',[asset.id]);
 const pin=randomUUID();await a.query('BEGIN');
 await a.query("INSERT INTO media_asset_references VALUES($1,'school',$2,'school_draft',$3,now())",[asset.id,school,pin]);
 assert.deepEqual(await scalar(b,'SELECT claim_media_cleanup(20)'),[]);await a.query('COMMIT');
 assert.deepEqual(await scalar(main,'SELECT claim_media_cleanup(20)'),[]);
 assert.equal(await scalar(main,'SELECT state FROM media_assets WHERE id=$1',[asset.id]),'ready');
 checks.push('reference first: cleanup skips the locked asset then respects the committed draft pin');

 await main.query('DELETE FROM media_asset_references WHERE asset_id=$1',[asset.id]);
 await a.query('BEGIN');const deleting=await scalar(a,'SELECT claim_media_cleanup(20)');assert.equal(deleting.length,3);
 const latePin=observe(b.query("INSERT INTO media_asset_references VALUES($1,'school',$2,'school_draft',$3,now())",[asset.id,school,randomUUID()]));
 await blockedBy(main,b,a);await a.query('COMMIT');assert.deepEqual(await latePin,{ok:false,code:'23514'});
 for(const object of deleting)await main.query('SELECT finish_media_cleanup($1,$2,true)',[object.id,object.leaseId]);
 assert.equal(await scalar(main,'SELECT state FROM media_assets WHERE id=$1',[asset.id]),'deleted');
 checks.push('cleanup first: waiting new reference is rejected after deleting state commits');
 console.log(JSON.stringify({environment:'rehearsal',checks,storageRequests:0}));
}finally{
 for(const c of clients)await c.query('ROLLBACK').catch(()=>{});
 const main=clients[0];if(main&&users.length){await main.query('BEGIN');try{
  const assets=(await main.query('SELECT id FROM media_assets WHERE uploaded_by=ANY($1::uuid[])',[users])).rows.map(r=>r.id);
  await main.query('DELETE FROM media_asset_references WHERE asset_id=ANY($1::uuid[])',[assets]);
  await main.query("UPDATE users SET photo_mode='none',photo_asset_id=NULL WHERE id=ANY($1::uuid[])",[users]);
  await main.query('DELETE FROM media_cleanup_queue WHERE object_id IN(SELECT id FROM media_objects WHERE asset_id=ANY($1::uuid[]))',[assets]);
  await main.query('DELETE FROM media_asset_cleanup WHERE asset_id=ANY($1::uuid[])',[assets]);
  await main.query('DELETE FROM media_objects WHERE asset_id=ANY($1::uuid[])',[assets]);await main.query('DELETE FROM media_assets WHERE id=ANY($1::uuid[])',[assets]);
  await main.query('DELETE FROM school_access_events WHERE school_id=ANY($1::uuid[])',[schools]);await main.query('DELETE FROM schools WHERE id=ANY($1::uuid[])',[schools]);
  await main.query('DELETE FROM platform_role_assignments WHERE user_id=ANY($1::uuid[])',[users]);await main.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
  if(before)assert.deepEqual(await fingerprint(main),before,'Existing application records changed');await main.query('COMMIT');
  console.log(JSON.stringify({cleanup:'complete',users:users.length,schools:schools.length,assets:assets.length}));
 }catch(error){await main.query('ROLLBACK');throw error;}}
 for(const c of clients)await c.end();
}
