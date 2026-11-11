import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { connect,fingerprint } from './membership-migration-support.mjs';
import { verifySchoolBranding } from './verify-school-branding.mjs';
const reproduce=process.argv[2]==='--reproduce-before-fix';
assert(process.argv.length===2||(process.argv.length===3&&reproduce),'Rehearsal only');
const clients=[];let fixture,before;
const value=async(c,q,p=[])=>(Object.values((await c.query(q,p)).rows[0])[0]);
async function blocked(observer,waiter,holder){const start=Date.now();while(Date.now()-start<4000){if(await value(observer,'SELECT $1::int=ANY(pg_blocking_pids($2::int))',[holder.databasePid,waiter.databasePid]))return;await new Promise(r=>setTimeout(r,20));}assert.fail('Expected lock wait');}
try{
 for(let i=0;i<3;i++){const c=await connect('rehearsal');clients.push(c);await c.query("SET lock_timeout='10s';SET statement_timeout='20s';SET idle_in_transaction_session_timeout='30s'");c.databasePid=await value(c,'SELECT pg_backend_pid()');}
 const [main,a,b]=clients;before=await fingerprint(main);
 await main.query('BEGIN');const result=await verifySchoolBranding(main,{returnFixture:true});fixture=result.fixture;await main.query('COMMIT');
 await value(main,'SELECT save_school_branding($1,$2,$3,$4,$5)',[fixture.owner,fixture.school,fixture.revision,fixture.settingsRevision,fixture.withLogo]);
 const intent=await value(main,'SELECT begin_school_publication($1,$2,$3,$4,$5)',[fixture.owner,fixture.school,fixture.revision+1,fixture.settingsRevision,randomUUID()]);
 const source=(await main.query("SELECT role,byte_count AS \"byteCount\",checksum,width,height FROM media_objects WHERE asset_id=$1 AND access='private' AND role<>'master'",[fixture.assetId])).rows;
 await a.query('BEGIN');const objects=await value(a,"SELECT journal_media_objects($1,$2,$3,'public',$4)",[fixture.owner,fixture.assetId,JSON.stringify(source),intent.id]);
 const abort=b.query('SELECT abort_school_publication($1,$2)',[fixture.owner,intent.id]);
 if(reproduce)await abort;else await blocked(main,b,a);
 await a.query('COMMIT');await abort;
 assert.equal(await value(main,'SELECT state FROM school_publication_intents WHERE id=$1',[intent.id]),'failed');
 const queued=await value(main,'SELECT count(*)::int FROM media_cleanup_queue WHERE object_id=ANY($1::uuid[])',[objects.map(o=>o.id)]);
 assert.equal(queued,reproduce?0:objects.length);
 await main.query('SELECT abort_school_publication($1,$2)',[fixture.owner,intent.id]);
 assert.equal(await value(main,'SELECT count(*)::int FROM media_cleanup_queue WHERE object_id=ANY($1::uuid[])',[objects.map(o=>o.id)]),reproduce?0:objects.length);
 console.log(JSON.stringify({environment:'rehearsal',mode:reproduce?'confirmed_before_fix':'safety_regression',publicJournalObjects:objects.length,queued,blobRequests:0}));
}finally{
 for(const c of clients)await c.query('ROLLBACK').catch(()=>{});
 const main=clients[0];if(main&&fixture){await main.query('BEGIN');try{
  const assets=(await main.query('SELECT id FROM media_assets WHERE owner_school_id=$1',[fixture.school])).rows.map(r=>r.id);
  await main.query('DELETE FROM media_cleanup_queue WHERE object_id IN(SELECT id FROM media_objects WHERE asset_id=ANY($1::uuid[]))',[assets]);
  await main.query('DELETE FROM media_asset_references WHERE asset_id=ANY($1::uuid[])',[assets]);
  await main.query('DELETE FROM media_asset_cleanup WHERE asset_id=ANY($1::uuid[])',[assets]);
  await main.query('DELETE FROM media_objects WHERE asset_id=ANY($1::uuid[])',[assets]);
  await main.query('DELETE FROM media_assets WHERE id=ANY($1::uuid[])',[assets]);
  await main.query('DELETE FROM school_branding_version_pins WHERE version_id IN(SELECT id FROM school_branding_versions WHERE school_id=$1)',[fixture.school]);
  await main.query('DELETE FROM school_access_events WHERE school_id=$1',[fixture.school]);
  await main.query('DELETE FROM schools WHERE id=$1',[fixture.school]);
  await main.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[fixture.users]);
  assert.deepEqual(await fingerprint(main),before);await main.query('COMMIT');console.log(JSON.stringify({cleanup:'complete',existingDataUnchanged:true}));
 }catch(e){await main.query('ROLLBACK');throw e;}}
 for(const c of clients)await c.end();
}
