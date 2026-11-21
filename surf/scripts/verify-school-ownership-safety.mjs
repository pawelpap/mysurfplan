import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
export async function verifySchoolOwnershipSafety(client){
 const value=async(q,p=[])=>Object.values((await client.query(q,p)).rows[0])[0],hash=v=>createHash('sha256').update(v).digest('hex');
 const prefix='b5-ownership-retention-'+randomUUID(),environment=await value('SELECT environment FROM job_environment WHERE singleton');
 const people=[];for(const label of['claimant','reviewer']){
  const id=await value("INSERT INTO users(name,email,role,email_verified_at,password_hash,auth_version)VALUES($1,$2,'student',now(),$3,1)RETURNING id",[label,prefix+'-'+label+'@example.invalid','synthetic-'+label]);
  const session=hash(randomUUID());await client.query("INSERT INTO auth_sessions(token_hash,user_id,auth_version,expires_at)VALUES($1,$2,1,now()+interval '1 hour')",[session,id]);people.push({id,session,email:prefix+'-'+label+'@example.invalid'});
 }
 const[claimant,reviewer]=people;await client.query('INSERT INTO platform_role_assignments(user_id)VALUES($1)',[reviewer.id]);
 const fixtures=[];
 for(const label of['outage','previously-terminalised','unrelated']){
  const school=await value("INSERT INTO schools(name,workspace_kind,workspace_status,listing_status)VALUES($1,'legacy','active','published')RETURNING id",[prefix+'-'+label]);
  const submitted=await value('SELECT school_ownership_action($1,$2,$3,$4)',[claimant.id,'submit',{schoolId:school,ownershipRevision:1,statement:'Synthetic claimant representation statement',requestId:randomUUID()},claimant.session]);
  const mail={jobId:randomUUID(),userId:claimant.id,email:claimant.email,authVersion:1,environment,recipientHash:hash(claimant.email),payload:{synthetic:true},tokenHash:hash(randomUUID())};
  const approved=await value('SELECT school_ownership_action($1,$2,$3,$4,$5,1,$6)',[reviewer.id,'review',{claimId:submitted.claim.id,revision:1,decision:'approve',reason:'Synthetic claimant-facing review reason',caseReference:'CASE-RETENTION',requestId:randomUUID(),locale:'en-GB'},reviewer.session,'synthetic-reviewer',{offer:mail}]);
  fixtures.push({school,claim:submitted.claim.id,offer:approved.claim.offer.id,job:mail.jobId});
 }
 const[outage,previous,unrelated]=fixtures;
 const snapshots=async fixture=>(await client.query(`SELECT jsonb_build_object('claim',(SELECT to_jsonb(c)FROM school_ownership_claims c WHERE c.id=$1),
 'offer',(SELECT to_jsonb(o)FROM school_ownership_offers o WHERE o.id=$2),'job',(SELECT to_jsonb(j)FROM job_outbox j WHERE j.id=$3))AS data`,[fixture.claim,fixture.offer,fixture.job])).rows[0].data;
 const unrelatedBefore=await snapshots(unrelated);
 const immutableBefore=(await client.query('SELECT id,school_id,actor_id,person_id,action,details,created_at FROM school_access_events WHERE school_id=ANY($1::uuid[])ORDER BY id',[fixtures.map(f=>f.school)])).rows;
 await client.query("UPDATE school_ownership_offers SET expires_at=clock_timestamp()-interval '31 days'WHERE id=ANY($1::uuid[])",[[outage.offer,previous.offer]]);
 await client.query("UPDATE school_ownership_offers SET status='expired',terminal_at=expires_at WHERE id=$1",[previous.offer]);
 await client.query("UPDATE school_ownership_claims SET status='expired',terminal_at=clock_timestamp()WHERE id=$1",[previous.claim]);
 const result=await client.query('SELECT * FROM maintain_school_ownership($1)',[environment]);assert.equal(result.rows[0].expired,1);assert.equal(result.rows[0].purged,2);
 for(const fixture of[outage,previous]){
  const data=await snapshots(fixture);assert.equal(data.claim.status,'expired');assert.equal(data.offer.status,'expired');
  assert.equal(data.claim.terminal_at,data.offer.expires_at);assert.equal(data.offer.terminal_at,data.offer.expires_at);
  for(const field of['statement','decision_reason','case_reference'])assert.equal(data.claim[field],null);
  for(const field of['token_hash','recipient_email'])assert.equal(data.offer[field],null);
  assert.equal(data.job.status,'cancelled');assert.equal(data.job.payload,null);
  assert.equal(data.claim.claimant_id,claimant.id);assert.equal(data.claim.reviewed_by,reviewer.id);assert(data.claim.reviewed_at);
  assert.equal(data.offer.recipient_user_id,claimant.id);assert.equal(data.offer.issued_by,reviewer.id);assert.equal(data.offer.claim_id,fixture.claim);
 }
 assert.deepEqual(await snapshots(unrelated),unrelatedBefore);
 assert.deepEqual((await client.query('SELECT id,school_id,actor_id,person_id,action,details,created_at FROM school_access_events WHERE school_id=ANY($1::uuid[])ORDER BY id',[fixtures.map(f=>f.school)])).rows,immutableBefore);
 const second=(await client.query('SELECT * FROM maintain_school_ownership($1)',[environment])).rows[0];assert.equal(second.expired,0);assert.equal(second.purged,0);
 return ['one pass after a 31-day outage clears expired claim statement/reason/case reference and offer token/email using actual offer expiry',
 'bounded maintenance corrects a previously late-terminalised expired claim without a migration-time backfill',
 'obsolete jobs cancel and clear payloads; minimal identity/decision/audit evidence and unrelated pending claim/offer/job remain unchanged',
 'a repeated pass is idempotent'];
}
