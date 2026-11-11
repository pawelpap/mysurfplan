import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { connect, fingerprint } from './membership-migration-support.mjs';

assert(process.argv.length === 2, 'Rehearsal-only script; no environment override');
const clients = [], users = [], schools = [], checks = [];
const prefix = `b5-geo-race-${randomUUID()}`;
const globalId = '00000000-0000-0000-0000-000000000000';
const row = async (c,q,p=[]) => (await c.query(q,p)).rows[0];
const scalar = async (c,q,p=[]) => Object.values(await row(c,q,p))[0];
const observe = promise => promise.then(value=>({ok:true,value}),error=>({ok:false,code:error.code}));
let originalPolicy, originalDispatch, before;
async function blockedBy(observer, waiter, holder) {
  const start=Date.now();
  while(Date.now()-start<4000) {
    if(await scalar(observer,'SELECT $1::int=ANY(pg_blocking_pids($2::int))',[holder.databasePid,waiter.databasePid])) return;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.fail('Expected a real database lock wait');
}
async function person(c,label) {
  const id=randomUUID();users.push(id);
  await c.query("INSERT INTO users(id,name,email,role,email_verified_at) VALUES($1,$2,$3,'student',now())",[id,prefix+'-'+label,prefix+'-'+label+'@example.invalid']);
  return id;
}
async function draft(c,actor,label) {
  const details={name:prefix+'-'+label,description:'',timezone:'Europe/Lisbon',contactEmail:'',contactPhone:'',website:'',socialLinks:[],operatingSpotIds:[]};
  const result=await scalar(c,'SELECT create_draft_school($1,$2,$3::jsonb)',[actor,randomUUID(),details]);
  schools.push(result.data.id);return result.data.id;
}
async function agreement(c,actor,school) {
  await c.query(`INSERT INTO legal_acceptances(user_id,document_id,version,language,content_hash,kind,school_id,membership_id)
    SELECT $1,d.document_id,d.version,d.language,d.content_hash,d.kind,$2,m.id FROM legal_documents d
    JOIN school_memberships m ON m.school_id=$2 AND m.user_id=$1 WHERE d.document_id='mywaveplan.school-processing'
    AND d.version=$3 AND d.language='en-GB'`,[actor,school,prefix]);
}
const lookup=(c,actor,school)=>scalar(c,'SELECT reserve_school_address_lookup($1,$2,$3)',[actor,school,'staging']);
try {
  for(let n=0;n<3;n++) {
    const c=await connect('rehearsal');clients.push(c);
    await c.query("SET lock_timeout='10s';SET statement_timeout='20s';SET idle_in_transaction_session_timeout='30s'");
    c.databasePid=await scalar(c,'SELECT pg_backend_pid()');
  }
  const [main,a,b]=clients;
  assert.equal(await scalar(main,'SELECT environment FROM job_environment WHERE singleton'),'staging');
  originalPolicy=await row(main,'SELECT * FROM school_geocoding_policy WHERE singleton');
  originalDispatch=await row(main,'SELECT * FROM school_geocoding_dispatch WHERE singleton');
  assert.equal(originalPolicy.enabled,false,'Do not run committed fixtures against an enabled shared integration');
  assert.equal(await scalar(main,'SELECT count(*)::int FROM school_geocoding_budget'),0,'A clean isolated budget is required');
  before=await fingerprint(main);
  const ownerA=await person(main,'owner-a'),ownerB=await person(main,'owner-b');
  const schoolA=await draft(main,ownerA,'school-a'),schoolB=await draft(main,ownerB,'school-b');
  const admin=await person(main,'admin'),platform=await person(main,'platform');
  await main.query('INSERT INTO platform_role_assignments(user_id) VALUES($1)',[platform]);
  const legacy=await scalar(main,'INSERT INTO schools(name) VALUES($1) RETURNING id',[prefix+'-legacy']);schools.push(legacy);
  await main.query("SELECT set_school_access($1,$2,$3,ARRAY['school_admin'],'active')",[platform,admin,legacy]);
  const content='Isolated rehearsal synthetic document only: optional Geoapify provider.';
  const hash=createHash('sha256').update(content).digest('hex');
  for(const id of ['mywaveplan.privacy','mywaveplan.school-processing']) for(const language of ['en-GB','pt-PT','es','fr']) {
    await main.query(`INSERT INTO legal_documents(document_id,version,language,kind,title,content,content_hash,status,environment,effective_at,reviewed_at)
      VALUES($1,$2,$3,$4,'ISOLATED TEST ONLY',$5,$6,'published','staging',now()-interval '1 minute',now())`,
    [id,prefix,language,id==='mywaveplan.privacy'?'privacy_notice':'school_processing',content,hash]);
  }
  for(const [actor,school] of [[ownerA,schoolA],[ownerB,schoolB],[admin,legacy]]) await agreement(main,actor,school);
  await main.query('UPDATE school_geocoding_policy SET enabled=true,provider_reviewed_at=now(),required_agreement_version=$1,required_privacy_version=$1',[prefix]);
  await main.query("INSERT INTO school_geocoding_budget(scope,subject,bucket,used) VALUES('global',$1,date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',199)",[globalId]);
  await main.query('UPDATE school_geocoding_dispatch SET last_dispatch_at=NULL');
  await a.query('BEGIN');
  assert.deepEqual(await lookup(a,ownerA,schoolA),{allowed:true});
  // Isolate the quota guard from the independent dispatch-spacing guard.
  await a.query("UPDATE school_geocoding_dispatch SET last_dispatch_at=now()-interval '2 seconds'");
  const lastSlot=observe(lookup(b,ownerB,schoolB));
  await blockedBy(main,b,a);await a.query('COMMIT');
  assert.deepEqual(await lastSlot,{ok:true,value:{allowed:false,reason:'limited'}});
  assert.equal(await scalar(main,"SELECT used FROM school_geocoding_budget WHERE scope='global' AND subject=$1",[globalId]),200);
  assert.equal(await scalar(main,"SELECT count(*)::int FROM school_geocoding_budget WHERE scope='actor' AND subject=$1",[ownerB]),0);
  checks.push('last daily slot: competing school waits on policy lock, rechecks quota and leaves no actor reservation');

  await main.query('DELETE FROM school_geocoding_budget WHERE subject=ANY($1::uuid[])',[[globalId,...users,...schools]]);
  await main.query('UPDATE school_geocoding_dispatch SET last_dispatch_at=NULL');
  await a.query('BEGIN');
  await a.query("SELECT set_school_access($1,$2,$3,ARRAY[]::text[],'suspended')",[platform,admin,legacy]);
  const revoked=observe(lookup(b,admin,legacy));
  await blockedBy(main,b,a);await a.query('COMMIT');
  assert.deepEqual(await revoked,{ok:false,code:'42501'});
  assert.equal(await scalar(main,'SELECT count(*)::int FROM school_geocoding_budget'),0);
  checks.push('administrator revocation first: waiting lookup rechecks current authority and consumes no budget');

  await main.query("SELECT set_school_access($1,$2,$3,ARRAY['school_admin'],'active')",[platform,admin,legacy]);
  await a.query('BEGIN');
  assert.deepEqual(await lookup(a,admin,legacy),{allowed:true});
  const revokeAfter=observe(b.query("SELECT set_school_access($1,$2,$3,ARRAY[]::text[],'suspended')",[platform,admin,legacy]));
  await blockedBy(main,b,a);await a.query('COMMIT');
  assert.equal((await revokeAfter).ok,true);
  assert.deepEqual(await observe(lookup(main,admin,legacy)),{ok:false,code:'42501'});
  checks.push('lookup first: reservation commits before waiting revocation; subsequent lookup is denied');
  console.log(JSON.stringify({environment:'rehearsal',checks,providerRequests:0}));
} finally {
  for(const c of clients) await c.query('ROLLBACK').catch(()=>{});
  const main=clients[0];
  if(main && originalPolicy) {
    await main.query('BEGIN');
    try {
      await main.query('UPDATE school_geocoding_policy SET enabled=$1,provider_reviewed_at=$2,required_agreement_version=$3,required_privacy_version=$4',
        [originalPolicy.enabled,originalPolicy.provider_reviewed_at,originalPolicy.required_agreement_version,originalPolicy.required_privacy_version]);
      await main.query('UPDATE school_geocoding_dispatch SET last_dispatch_at=$1',[originalDispatch.last_dispatch_at]);
      await main.query('DELETE FROM school_geocoding_budget WHERE subject=ANY($1::uuid[])',[[globalId,...users,...schools]]);
      await main.query('DELETE FROM legal_acceptances WHERE user_id=ANY($1::uuid[]) AND version=$2',[users,prefix]);
      await main.query('DELETE FROM legal_documents WHERE version=$1 AND title=$2',[prefix,'ISOLATED TEST ONLY']);
      await main.query('DELETE FROM school_access_events WHERE school_id=ANY($1::uuid[])',[schools]);
      await main.query('DELETE FROM schools WHERE id=ANY($1::uuid[])',[schools]);
      await main.query('DELETE FROM platform_role_assignments WHERE user_id=ANY($1::uuid[])',[users]);
      await main.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
      if(before) assert.deepEqual(await fingerprint(main),before,'Existing application fingerprints changed');
      assert.deepEqual(await row(main,'SELECT * FROM school_geocoding_policy WHERE singleton'),originalPolicy);
      assert.equal(await scalar(main,'SELECT count(*)::int FROM school_geocoding_budget'),0);
      await main.query('COMMIT');console.log(JSON.stringify({cleanup:'complete',users:users.length,schools:schools.length,policyRestored:true}));
    } catch(error) { await main.query('ROLLBACK');throw error; }
  }
  for(const c of clients) await c.end();
}
