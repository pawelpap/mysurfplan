import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import {connect} from './membership-migration-support.mjs';import {ownershipSourceFingerprint} from './migrate-school-ownership.mjs';import {verifySchoolOwnership} from './verify-school-ownership.mjs';
assert(process.argv.length===2,'Isolated rehearsal only');const clients=[],checks=[];let fixture,before,originalPolicy;
const hash=v=>createHash('sha256').update(v).digest('hex');
const value=async(c,q,p=[])=>Object.values((await c.query(q,p)).rows[0])[0];
const observed=p=>p.then(result=>({ok:true,result}),e=>({ok:false,code:e.code,message:e.message}));
async function blocked(main,waiter,holder){const start=Date.now();while(Date.now()-start<4000){if(await value(main,'SELECT $1::int=ANY(pg_blocking_pids($2::int))',[holder.databasePid,waiter.databasePid]))return;await new Promise(r=>setTimeout(r,20));}assert.fail('Expected real ownership lock wait');}
try{
 for(let i=0;i<3;i++){const c=await connect('rehearsal');clients.push(c);await c.query("SET lock_timeout='10s';SET statement_timeout='20s';SET idle_in_transaction_session_timeout='30s'");c.databasePid=await value(c,'SELECT pg_backend_pid()');}
 const[main,a,b]=clients;before=await ownershipSourceFingerprint(main);originalPolicy=(await main.query('SELECT *FROM school_onboarding_policy WHERE singleton')).rows[0];
 await main.query('BEGIN');fixture=(await verifySchoolOwnership(main,{returnFixture:true})).fixture;await main.query('COMMIT');
 const people=fixture.people,school=fixture.school;
 const mail=(label,extras={})=>({jobId:randomUUID(),userId:people[label].id,email:people[label].email,authVersion:1,environment:fixture.mailEnvironment,recipientHash:hash(people[label].email),payload:{synthetic:true},...extras});
 const run=(c,label,op,body,m={})=>value(c,'SELECT school_ownership_action($1,$2,$3,$4,$5,$6,$7)',[people[label].id,op,body,people[label].session,['transfer','cancel','reissue','accept','review'].includes(op)?people[label].password:null,['transfer','cancel','reissue','accept','review'].includes(op)?1:null,m]);
 let token,offer,revision;
 const create=async()=>{revision=Number(await value(main,'SELECT ownership_revision FROM schools WHERE id=$1',[school]));token=hash(randomUUID());offer=(await run(main,'recipient','transfer',{schoolId:school,ownershipRevision:revision,recipientEmail:people.owner.email,requestId:randomUUID(),locale:'en-GB'},{offer:mail('owner',{tokenHash:token})})).offer;};
 const accept=c=>run(c,'owner','accept',{tokenHash:token,offerId:offer.id,ownershipRevision:revision,documentId:'mywaveplan.school-processing',version:fixture.version,
  language:'fr',contentHash:fixture.contentHash,acceptedOwnership:true,acceptedAgreement:true,authorisedRepresentative:true,consequencesVersion:'ownership-workspace/1',locale:'fr'},{new:mail('owner'),previous:mail('recipient')});
 const cancel=c=>run(c,'recipient','cancel',{schoolId:school,ownershipRevision:revision,offerId:offer.id,requestId:randomUUID()});
 await create();
 await a.query('BEGIN');await a.query('UPDATE auth_sessions SET revoked_at=clock_timestamp()WHERE token_hash=$1',[people.owner.session]);
 const revoked=observed(accept(b));await blocked(main,b,a);await a.query('COMMIT');assert.equal((await revoked).code,'42501');
 await main.query('UPDATE auth_sessions SET revoked_at=NULL WHERE token_hash=$1',[people.owner.session]);checks.push('exact same-device session logout wins against waiting acceptance');
 await a.query('BEGIN');await a.query("UPDATE users SET password_hash='changed'WHERE id=$1",[people.owner.id]);
 const password=observed(accept(b));await blocked(main,b,a);await a.query('COMMIT');assert.equal((await password).code,'42501');
 await main.query('UPDATE users SET password_hash=$1 WHERE id=$2',[people.owner.password,people.owner.id]);await main.query('UPDATE users SET auth_version=1 WHERE id=$1',[people.owner.id]);checks.push('password mutation wins against waiting verified-password acceptance');
 await a.query('BEGIN');await a.query('UPDATE users SET auth_version=auth_version+1 WHERE id=$1',[people.recipient.id]);
 const epoch=observed(accept(b));await blocked(main,b,a);await a.query('COMMIT');assert.equal((await epoch).code,'23514');
 await main.query('UPDATE users SET auth_version=1 WHERE id=$1',[people.recipient.id]);checks.push('initiating owner global revocation wins against waiting acceptance');
 await a.query('BEGIN');await a.query("UPDATE school_memberships SET status='suspended'WHERE id=$1",[fixture.ownerMember]);
 const suspension=observed(accept(b));await blocked(main,b,a);await a.query('COMMIT');assert.equal((await suspension).code,'23514');
 await main.query("UPDATE school_memberships SET status='active'WHERE id=$1",[fixture.ownerMember]);checks.push('recipient membership suspension wins against waiting acceptance');
 await a.query('BEGIN');await a.query('SELECT 1 FROM schools WHERE id=$1 FOR UPDATE',[school]);
 await a.query("UPDATE school_ownership_offers SET expires_at=clock_timestamp()-interval '1 second'WHERE id=$1",[offer.id]);
 const expired=observed(accept(b));await blocked(main,b,a);await a.query('COMMIT');assert.equal((await expired).message,'ownership.expired');
 await cancel(main);checks.push('clock_timestamp expiry is rechecked after the real school lock wait');
 await create();await a.query('BEGIN');const currentMember=await value(a,'SELECT owner_membership_id FROM schools WHERE id=$1 FOR UPDATE',[school]);
 await a.query('UPDATE schools SET owner_membership_id=$1 WHERE id=$2',[fixture.ownerMember,school]);await a.query('UPDATE schools SET owner_membership_id=$1 WHERE id=$2',[currentMember,school]);
 const aba=observed(accept(b));await blocked(main,b,a);await a.query('COMMIT');assert.equal((await aba).message,'ownership.revoked');
 revision=Number(await value(main,'SELECT ownership_revision FROM schools WHERE id=$1',[school]));await cancel(main);checks.push('A→B→A ownership invalidates the waiting offer through monotonic revision');
 await create();await a.query('BEGIN');await cancel(a);const cancelled=observed(accept(b));await blocked(main,b,a);await a.query('COMMIT');assert.equal((await cancelled).message,'ownership.revoked');checks.push('cancellation first leaves no acceptance or new membership');
 await create();const evidenceBefore=await value(main,'SELECT count(*)::int FROM legal_acceptances WHERE school_id=$1',[school]);
 await a.query('BEGIN');const first=await accept(a);const duplicate=observed(accept(b));await blocked(main,b,a);await a.query('COMMIT');const second=await duplicate;
 assert.equal(first.currentlyOwner,true);assert.equal(second.ok,true);assert.equal(second.result.replayed,true);
 assert.equal(await value(main,'SELECT count(*)::int FROM school_ownership_acceptances WHERE offer_id=$1',[offer.id]),1);
 assert.equal(await value(main,'SELECT count(*)::int FROM school_ownership_notice_jobs n JOIN school_ownership_acceptances ac ON ac.id=n.acceptance_id WHERE ac.offer_id=$1',[offer.id]),2);
 assert.equal(await value(main,'SELECT count(*)::int FROM legal_acceptances WHERE school_id=$1',[school]),evidenceBefore);
 checks.push('two real acceptance sessions commit one fresh event and two notices while reusing exact canonical evidence');
 // Two distinct platform reviewers race to approve different claims for the same unresolved school.
 const claimSchool=fixture.privateSchool;await main.query("UPDATE schools SET listing_status='published'WHERE id=$1",[claimSchool]);
 await main.query('INSERT INTO platform_role_assignments(user_id)VALUES($1)',[people.other.id]);
 const claims=[];for(const label of['owner','recipient'])claims.push((await run(main,label,'submit',{schoolId:claimSchool,ownershipRevision:1,statement:'Synthetic representation',requestId:randomUUID()})).claim);
 const review=(client,label,index)=>run(client,label,'review',{claimId:claims[index].id,revision:1,decision:'approve',reason:'Synthetic verified representation',caseReference:'CASE-RACE',requestId:randomUUID(),locale:'en-GB'},{offer:mail(index===0?'owner':'recipient',{tokenHash:hash(randomUUID())})});
 await a.query('BEGIN');await review(a,'platform',0);const competing=observed(review(b,'other',1));await blocked(main,b,a);await a.query('COMMIT');assert.equal((await competing).code,'23514');
 assert.equal(await value(main,'SELECT owner_membership_id FROM schools WHERE id=$1',[claimSchool]),null);
 assert.equal(await value(main,"SELECT count(*)::int FROM school_ownership_offers WHERE school_id=$1 AND status='pending'",[claimSchool]),1);
 checks.push('distinct reviewers race: one pending approved offer, no automatic ownership or membership');
 console.log(JSON.stringify({environment:'rehearsal',checks,externalRequests:0}));
}finally{
 for(const c of clients)await c.query('ROLLBACK').catch(()=>{});const main=clients[0];if(main&&fixture){await main.query('BEGIN');try{
  const schools=[fixture.school,fixture.privateSchool],users=Object.values(fixture.people).map(p=>p.id);
  const jobs=(await main.query('SELECT email_job_id AS id FROM school_ownership_offers WHERE school_id=ANY($1::uuid[])UNION SELECT n.job_id FROM school_ownership_notice_jobs n JOIN school_ownership_acceptances a ON a.id=n.acceptance_id WHERE a.school_id=ANY($1::uuid[])',[schools])).rows.map(r=>r.id).filter(Boolean);
  await main.query('UPDATE school_onboarding_policy SET ready=$1,required_agreement_version=$2,required_privacy_version=$3',[originalPolicy.ready,originalPolicy.required_agreement_version,originalPolicy.required_privacy_version]);
  await main.query('DELETE FROM school_ownership_notice_jobs WHERE job_id=ANY($1::uuid[])',[jobs]);
  await main.query('DELETE FROM school_ownership_acceptances WHERE school_id=ANY($1::uuid[])',[schools]);
  await main.query('DELETE FROM school_ownership_requests WHERE school_id=ANY($1::uuid[])',[schools]);
  await main.query('DELETE FROM school_ownership_offers WHERE school_id=ANY($1::uuid[])',[schools]);
  await main.query('DELETE FROM school_ownership_claims WHERE school_id=ANY($1::uuid[])',[schools]);
  await main.query('DELETE FROM job_outbox WHERE id=ANY($1::uuid[])',[jobs]);
  await main.query('DELETE FROM legal_acceptances WHERE school_id=ANY($1::uuid[])AND user_id=ANY($2::uuid[])',[schools,users]);
  await main.query('DELETE FROM legal_documents WHERE version=ANY($1::text[])AND title=$2',[[fixture.version,fixture.privacyVersion],'Synthetic test only']);
  await main.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])',[users]);
  await main.query('DELETE FROM school_access_events WHERE school_id=ANY($1::uuid[])',[schools]);
  await main.query('DELETE FROM schools WHERE id=ANY($1::uuid[])',[schools]);
  await main.query('DELETE FROM platform_role_assignments WHERE user_id=ANY($1::uuid[])',[users]);
  await main.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
  await main.query('SET CONSTRAINTS ALL IMMEDIATE');
  assert.deepEqual(await ownershipSourceFingerprint(main),before);assert.deepEqual((await main.query('SELECT *FROM school_onboarding_policy WHERE singleton')).rows[0],originalPolicy);
  await main.query('COMMIT');console.log(JSON.stringify({cleanup:'complete',users:users.length,schools:schools.length,policyRestored:true,existingDataUnchanged:true}));
 }catch(e){await main.query('ROLLBACK');throw e;}}
 for(const c of clients)await c.end();
}
