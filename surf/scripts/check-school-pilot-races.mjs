import assert from'node:assert/strict';import{randomUUID}from'node:crypto';
import{connect,fingerprint}from'./membership-migration-support.mjs';import{verifySchoolPilot}from'./verify-school-pilot.mjs';
assert(process.argv.length===2,'Isolated rehearsal only');const clients=[],checks=[];let fixture,before,originalPolicy;
const value=async(c,q,p=[])=>Object.values((await c.query(q,p)).rows[0])[0];
const observed=p=>p.then(result=>({ok:true,result}),e=>({ok:false,code:e.code}));
async function blocked(main,waiter,holder){const start=Date.now();while(Date.now()-start<4000){if(await value(main,'SELECT $1::int=ANY(pg_blocking_pids($2::int))',[holder.databasePid,waiter.databasePid]))return;await new Promise(r=>setTimeout(r,20));}assert.fail('Expected real approval lock wait');}
try{
 for(let i=0;i<3;i++){const c=await connect('rehearsal');clients.push(c);await c.query("SET lock_timeout='10s';SET statement_timeout='20s';SET idle_in_transaction_session_timeout='30s'");c.databasePid=await value(c,'SELECT pg_backend_pid()');}
 const[main,a,b]=clients;before=await fingerprint(main);originalPolicy=(await main.query('SELECT *FROM school_onboarding_policy WHERE singleton')).rows[0];
 await main.query('BEGIN');fixture=(await verifySchoolPilot(main,{returnFixture:true})).fixture;await main.query('COMMIT');
 const approve=(c,request=randomUUID())=>value(c,'SELECT approve_school_pilot($1,$2,1,$3,$4,$5,1,$6)',[fixture.platform,fixture.school,fixture.acceptance,request,'synthetic-platform',fixture.sessionHash]);
 await a.query('BEGIN');await a.query('UPDATE auth_sessions SET revoked_at=now()WHERE token_hash=$1',[fixture.sessionHash]);
 const revoked=observed(approve(b));await blocked(main,b,a);await a.query('COMMIT');assert.deepEqual(await revoked,{ok:false,code:'42501'});
 assert.equal(await value(main,'SELECT count(*)::int FROM school_pilot_approvals WHERE school_id=$1',[fixture.school]),0);
 await main.query('UPDATE auth_sessions SET revoked_at=NULL WHERE token_hash=$1',[fixture.sessionHash]);
 checks.push('same-device logout first: waiting approval rechecks exact session and creates no decision');
 await a.query('BEGIN');await a.query('UPDATE users SET disabled_at=now()WHERE id=$1',[fixture.owner]);
 const deactivated=observed(approve(b));await blocked(main,b,a);await a.query('COMMIT');assert.deepEqual(await deactivated,{ok:false,code:'42501'});
 await main.query('UPDATE users SET disabled_at=NULL WHERE id=$1',[fixture.owner]);
 checks.push('owner deactivation first: waiting approval rechecks current owner state');
 await a.query('BEGIN');await a.query("UPDATE schools SET workspace_status='closed'WHERE id=$1",[fixture.school]);
 const closed=observed(approve(b));await blocked(main,b,a);await a.query('COMMIT');assert.deepEqual(await closed,{ok:false,code:'40001'});
 await main.query("UPDATE schools SET workspace_status='draft'WHERE id=$1",[fixture.school]);
 checks.push('school closure first: waiting approval cannot reopen or activate it');
 const request=randomUUID();await a.query('BEGIN');const first=await approve(a,request);
 const duplicate=observed(approve(b,request));await blocked(main,b,a);await a.query('COMMIT');const second=await duplicate;
 assert.equal(second.ok,true);assert.equal(second.result.approvalId,first.approvalId);assert.equal(second.result.replayed,true);
 assert.equal(await value(main,'SELECT count(*)::int FROM school_pilot_approvals WHERE school_id=$1',[fixture.school]),1);
 assert.equal(await value(main,"SELECT count(*)::int FROM school_access_events WHERE school_id=$1 AND action='pilot_approved'",[fixture.school]),1);
 checks.push('two approval retries commit one evidence-bound decision and one activation audit event');
 console.log(JSON.stringify({environment:'rehearsal',checks,externalRequests:0}));
}finally{
 for(const c of clients)await c.query('ROLLBACK').catch(()=>{});const main=clients[0];if(main&&fixture){await main.query('BEGIN');try{
  await main.query('UPDATE school_onboarding_policy SET ready=$1,required_agreement_version=$2,required_privacy_version=$3',[originalPolicy.ready,originalPolicy.required_agreement_version,originalPolicy.required_privacy_version]);
  await main.query('DELETE FROM school_pilot_approvals WHERE school_id=$1',[fixture.school]);
  await main.query('DELETE FROM legal_acceptances WHERE school_id=$1 AND user_id=ANY($2::uuid[])',[fixture.school,fixture.users]);
  await main.query('DELETE FROM legal_documents WHERE version=$1 AND title=$2',[fixture.version,'Synthetic test only']);
  await main.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])',[fixture.users]);
  await main.query('DELETE FROM school_access_events WHERE school_id=$1',[fixture.school]);
  await main.query('DELETE FROM schools WHERE id=$1',[fixture.school]);
  await main.query('DELETE FROM platform_role_assignments WHERE user_id=ANY($1::uuid[])',[fixture.users]);
  await main.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[fixture.users]);
  assert.deepEqual(await fingerprint(main),before);assert.deepEqual((await main.query('SELECT *FROM school_onboarding_policy WHERE singleton')).rows[0],originalPolicy);
  await main.query('COMMIT');console.log(JSON.stringify({cleanup:'complete',users:fixture.users.length,schools:1,policyRestored:true,existingDataUnchanged:true}));
 }catch(e){await main.query('ROLLBACK');throw e;}}
 for(const c of clients)await c.end();
}
