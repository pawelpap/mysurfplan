// Run only against the existing isolated security rehearsal branch. No emails sent.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { connect } from './membership-migration-support.mjs';
import { createJobStore, enqueueDeliveryCheck } from '../lib/email/store.mjs';
import { recipientHash, eventToken } from '../lib/email/crypto.mjs';
import { recordDeliveryEvents } from '../lib/email/events.mjs';
import { runEmailWorker } from '../lib/email/worker.mjs';

assert.equal(process.argv[2], 'rehearsal', 'This destructive fixture test is restricted to rehearsal');
const a = await connect('rehearsal'), b = await connect('rehearsal');
const query = async (text, params) => (await a.query(text, params)).rows;
const queryB = async (text, params) => (await b.query(text, params)).rows;
const config = { enabled:true,environment:'staging',allowlist:['a6-test@example.invalid'],
  payloadKey:'a'.repeat(64),keyId:'test',recipientKey:'b'.repeat(64),callbackSecret:'c'.repeat(64),dailyLimit:20,monthlyLimit:500 };
const store = createJobStore(query,'staging'), storeB = createJobStore(queryB,'staging');
const run = randomUUID(), prefix = `a6:${run}:`, recipient=config.allowlist[0];
let sequence=0, fixturesStarted=false; const checks=[];
const enqueue = extra => enqueueDeliveryCheck(query,config,{recipient,idempotencyKey:`${prefix}${++sequence}`,...extra});
const row = async id => (await query('SELECT * FROM job_outbox WHERE id=$1',[id]))[0];
const clean = async () => {
  await query('DELETE FROM job_outbox WHERE idempotency_key LIKE $1',[`${prefix}%`]);
  await query('DELETE FROM email_suppressions WHERE recipient_hash=$1',[recipientHash(recipient,config)]);
  await query("DELETE FROM email_usage WHERE environment='staging'");
  await query("DELETE FROM job_worker_status WHERE environment='staging'");
};
try {
  assert.equal((await query('SELECT count(*)::int AS n FROM job_outbox'))[0].n,0,'Do not run over existing jobs');
  assert.equal((await query('SELECT count(*)::int AS n FROM email_usage'))[0].n,0,'Do not overwrite existing budget evidence');
  fixturesStarted=true;
  await a.query('BEGIN'); const rolled=await enqueue(); await a.query('ROLLBACK');
  assert.equal(await row(rolled.id),undefined); checks.push('Enqueue follows caller transaction rollback');

  const key=prefix+'idempotent';
  const one=await enqueue({idempotencyKey:key});
  const again=await enqueue({idempotencyKey:key}); assert.equal(one.id,again.id);
  await enqueue();
  const [claimedA,claimedB]=await Promise.all([store.claim(),storeB.claim()]);
  assert(claimedA&&claimedB);assert.notEqual(claimedA.id,claimedB.id);
  assert.equal(await store.claim(),undefined); checks.push('Business idempotency and concurrent SKIP LOCKED claims');

  await query("UPDATE job_outbox SET lease_until=now()-interval '1 second' WHERE id=$1",[claimedA.id]);
  assert.equal(await store.prepare(claimedA,recipient,config),'lost_lease');
  await store.maintain(); assert.equal((await row(claimedA.id)).status,'pending');
  const reclaimed=await store.claim();
  await store.finish(claimedA,{status:'accepted',providerId:'stale'});
  assert.equal((await row(reclaimed.id)).status,'leased');
  checks.push('Expired pre-dispatch leases recover; stale holder cannot finish');

  const cap={...config,dailyLimit:1};
  const outcomes=await Promise.all([store.prepare(reclaimed,recipient,cap),storeB.prepare(claimedB,recipient,cap)]);
  assert.equal(outcomes.filter(x=>x==='ready').length,1);assert.equal(outcomes.filter(x=>x==='budget_exhausted').length,1);
  const dispatched=outcomes[0]==='ready'?reclaimed:claimedB;
  checks.push('Concurrent quota reservation permits only one provider attempt');
  await query("UPDATE job_outbox SET lease_until=now()-interval '1 second' WHERE id=$1",[dispatched.id]);
  await store.maintain();
  assert.equal((await row(dispatched.id)).status,'delivery_unknown');assert.equal((await row(dispatched.id)).payload,null);
  checks.push('Interrupted dispatch becomes unknown without a duplicate send');

  const raw={event:'sent',time:Math.floor(Date.now()/1000),CustomID:dispatched.id,Payload:eventToken(dispatched.id,config),email:recipient,Message_GUID:'test-provider-guid'};
  assert.equal(await recordDeliveryEvents(query,raw,config),1);
  assert.equal((await row(dispatched.id)).status,'delivered');
  assert.equal(await recordDeliveryEvents(query,raw,config),0);
  const bounce={...raw,event:'bounce',hard_bounce:true};
  assert.equal(await recordDeliveryEvents(query,bounce,config),1);
  assert.equal((await row(dispatched.id)).status,'failed');
  await recordDeliveryEvents(query,{...raw,time:raw.time+1},config);
  assert.equal((await row(dispatched.id)).status,'failed');
  checks.push('Callbacks reconcile unknown, deduplicate and preserve hard-bounce suppression');
  await enqueue(); const suppressed=await store.claim();
  assert.equal(await store.prepare(suppressed,recipient,config),'cancelled');
  assert.equal((await row(suppressed.id)).payload,null); checks.push('Suppressed recipients are cancelled before dispatch');
  await clean();

  const expiry=await enqueue();
  await query("UPDATE job_outbox SET created_at=now()-interval '3 hours',expires_at=now()-interval '1 second' WHERE id=$1",[expiry.id]);
  await store.maintain(); assert.equal((await row(expiry.id)).status,'expired');assert.equal((await row(expiry.id)).payload,null);
  checks.push('Expiry erases delivery payload without sending'); await clean();

  const retried=await enqueue();let sendCalls=0;
  await runEmailWorker({config,store,send:async()=>{sendCalls++;return {status:'retry',code:'provider_throttled',retryAfter:'900'};}});
  const delayed=await row(retried.id);assert.equal(delayed.status,'pending');assert.equal(delayed.attempts,1);
  assert(new Date(delayed.due_at)>new Date(Date.now()+850000));assert.equal(sendCalls,1);
  await query("UPDATE job_outbox SET attempts=5,due_at=now() WHERE id=$1",[retried.id]);
  await runEmailWorker({config,store,send:async()=>({status:'retry',code:'provider_throttled'})});
  assert.equal((await row(retried.id)).status,'failed');assert.equal((await row(retried.id)).attempts,6);
  assert.equal((await row(retried.id)).payload,null); checks.push('Retry-After persists and the sixth attempt stops'); await clean();

  await enqueue(); const racing=await store.claim();assert.equal(await store.prepare(racing,recipient,config),'ready');
  await recordDeliveryEvents(query,{...raw,CustomID:racing.id,Payload:eventToken(racing.id,config)},config);
  await store.finish(racing,{status:'accepted',providerId:'test-provider-guid'});
  assert.equal((await row(racing.id)).status,'delivered');checks.push('Fast callback is not overwritten by worker completion');await clean();

  await a.query('BEGIN');
  const userId=randomUUID();
  await query("INSERT INTO users(id,name,email,role) VALUES($1,'A6 temporary fixture',$2,'student')",[userId,recipient]);
  await enqueue({userId,authVersion:0});const userJob=await store.claim();
  await query('UPDATE users SET disabled_at=now() WHERE id=$1',[userId]);
  assert.equal(await store.prepare(userJob,recipient,config),'cancelled');
  await a.query('ROLLBACK');checks.push('User status/auth version is checked again immediately before dispatch');

  await assert.rejects(()=>enqueueDeliveryCheck(query,{...config,environment:'production'},{recipient,idempotencyKey:prefix+'wrong-environment'}));
  checks.push('Database environment binding rejects production jobs on staging');

  const opA=await enqueue({operator:true});const opB=await enqueue({operator:true});
  assert(opA);assert.equal(opB,null);checks.push('Operator delivery checks have a database-enforced enqueue cooldown');
  console.log(JSON.stringify({environment:'rehearsal',checks,passed:checks.length,providerCalls:0}));
} finally {
  await a.query('ROLLBACK').catch(()=>{});
  if (fixturesStarted) await clean(); await a.end();await b.end();
  console.log(JSON.stringify({temporaryJobsRemoved:true,noExternalEmailSent:true}));
}
