import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { emailConfig, equalSecret, PROJECTS } from '../lib/email/config.mjs';
import { encryptPayload, decryptPayload, recipientHash, eventToken } from '../lib/email/crypto.mjs';
import { createMailjetAdapter, deliveryCheckMessage, retryDelay } from '../lib/email/mailjet.mjs';
import { parseDeliveryEvent } from '../lib/email/events.mjs';
import { emailHandler } from '../lib/email/http.mjs';
import { runEmailWorker } from '../lib/email/worker.mjs';
import { supportEmail } from '../lib/email/template.mjs';

const env = { APP_ENVIRONMENT: 'staging', EMAIL_ENABLED: 'true', VERCEL_ENV: 'production',
  VERCEL_PROJECT_ID: PROJECTS.staging, MAILJET_API_KEY: 'a'.repeat(32), MAILJET_SECRET_KEY: 'b'.repeat(32),
  EMAIL_PAYLOAD_KEY: 'c'.repeat(64), EMAIL_PAYLOAD_KEY_ID: 'v1', EMAIL_RECIPIENT_KEY: 'd'.repeat(64),
  EMAIL_CALLBACK_SECRET: 'e'.repeat(64), EMAIL_OPERATIONS_SECRET: 'f'.repeat(64), CRON_SECRET: 'g'.repeat(64),
  EMAIL_TEST_RECIPIENTS: 'owner@example.com', EMAIL_FROM: 'support@staging-mail.mywaveplan.com',
  EMAIL_DAILY_LIMIT: '20', EMAIL_MONTHLY_LIMIT: '500' };
const config = emailConfig(env);
const job = { id: randomUUID(), type: 'email.delivery_check', schema_version: 1, attempts: 0 };

test('email defaults off and explicit project/target/isolation/budgets are required', () => {
  assert.equal(emailConfig({}).enabled, false);
  for (const patch of [{ APP_ENVIRONMENT:'production' }, { VERCEL_ENV:'preview' }, { VERCEL_PROJECT_ID:PROJECTS.production },
    { EMAIL_TEST_RECIPIENTS:'' }, { EMAIL_FROM:'support@mywaveplan.com' }, { EMAIL_DAILY_LIMIT:'201' },
    { EMAIL_MONTHLY_LIMIT:'6001' }, { EMAIL_PAYLOAD_KEY:'bad' }, { MAILJET_SECRET_KEY:'' }])
    assert.throws(() => emailConfig({ ...env, ...patch }));
});
test('secret comparisons reject missing, malformed and incorrect tokens', () => {
  assert.equal(equalSecret(undefined, undefined), false);
  assert.equal(equalSecret(['abc'],'abc'), false);
  assert.equal(equalSecret('x','yy'), false);
  assert.equal(equalSecret('same','same'), true);
});
test('encrypted recipients are bound to job, environment and key; tampering fails', () => {
  const data = { recipient:'owner@example.com' }, encrypted = encryptPayload(data, job.id, config);
  assert(!JSON.stringify(encrypted).includes(data.recipient));
  assert.deepEqual(decryptPayload(encrypted,job.id,config),data);
  assert.throws(() => decryptPayload(encrypted, randomUUID(), config));
  assert.throws(() => decryptPayload(encrypted, job.id, { ...config, environment:'production' }));
  assert.throws(() => decryptPayload({ ...encrypted, kid:'old' },job.id,config));
  assert.throws(() => decryptPayload({ ...encrypted, data:'AAAA' },job.id,config));
  assert.notEqual(recipientHash(data.recipient,config),recipientHash(data.recipient,{ ...config,environment:'production' }));
});
test('template uses one recipient, static branding and disabled tracking', () => {
  const message=deliveryCheckMessage(job,'owner@example.com',config);
  assert.equal(message.To.length,1);
  assert.equal(message.TrackOpens,'disabled'); assert.equal(message.TrackClicks,'disabled');
  assert(message.Subject.startsWith('[Staging]')); assert(message.TextPart);
  assert(message.HTMLPart.includes('https://mywaveplan.com/icons/icon-192.png'));
  assert(!message.HTMLPart.includes(job.id)); assert(!message.HTMLPart.includes('owner@example.com'));
  assert(!/\?/.test(message.HTMLPart)); assert(message.HTMLPart.includes('MyWavePlan Support Team'));
  assert.equal(message.CustomID,job.id);
});
test('email shell escapes copy and includes usable text when images are blocked', () => {
  const content=supportEmail({title:'<script>bad</script>',paragraphs:['Hello & welcome <img src=x>']});
  assert(!content.html.includes('<script>'));assert(content.html.includes('&lt;img src=x&gt;'));
  assert(content.text.includes('MyWavePlan Support Team'));assert(content.text.includes('https://mywaveplan.com'));
});
test('provider returns accepted only with a real per-recipient message UUID', async () => {
  let request;
  const send=createMailjetAdapter(config,async(url,args)=>{ request={url,...args};return Response.json({Messages:[{Status:'success',To:[{MessageUUID:'provider-123'}]}]});});
  assert.equal((await send(job,'owner@example.com')).status,'accepted');
  assert.equal(request.url,'https://api.mailjet.com/v3.1/send'); assert.equal(request.redirect,'error');
  assert.equal(JSON.parse(request.body).Messages[0].TrackOpens,'disabled');
  const sandbox=createMailjetAdapter(config,async()=>Response.json({Messages:[{Status:'success'}]}));
  assert.equal((await sandbox(job,'owner@example.com')).status,'delivery_unknown');
});
test('429 retries; explicit rejection stops; timeout/5xx/malformed responses never blindly retry', async () => {
  for(const [status,expected] of [[429,'retry'],[400,'failed'],[401,'failed'],[403,'failed'],[500,'delivery_unknown'],[503,'delivery_unknown']]) {
    const send=createMailjetAdapter(config,async()=>new Response('',{status,headers:{'Retry-After':'600'}}));
    assert.equal((await send(job,'owner@example.com')).status,expected);
  }
  const send=createMailjetAdapter(config,async()=>{throw Error('request timed out after acceptance');});
  assert.deepEqual(await send(job,'owner@example.com'),{status:'delivery_unknown',code:'provider_connection_uncertain'});
});
test('backoff honours Retry-After in seconds or HTTP date and avoids early retries', () => {
  const now=Date.UTC(2026,8,13);
  assert.equal(retryDelay(1,'600',now,()=>0),600000);
  assert.equal(retryDelay(1,new Date(now+900000).toUTCString(),now,()=>0),900000);
  assert.equal(retryDelay(6,null,now,()=>0),3600000);
});
test('callbacks reject forgery/cross-environment and strip recipient/raw SMTP metadata', () => {
  const raw={event:'bounce',time:Math.floor(Date.now()/1000),CustomID:job.id,Payload:eventToken(job.id,config),
    email:'owner@example.com',hard_bounce:true,Message_GUID:'provider-123',comment:'PII',ip:'1.2.3.4'};
  const event=parseDeliveryEvent(raw,config);
  assert.equal(event.suppress,'hard_bounce'); assert(!JSON.stringify(event).includes('owner@example.com'));
  assert(!JSON.stringify(event).includes('PII')); assert(!JSON.stringify(event).includes('1.2.3.4'));
  assert.equal(parseDeliveryEvent({...raw,Payload:'forged'},config),null);
  assert.equal(parseDeliveryEvent(raw,{...config,environment:'production'}),null);
  assert.equal(parseDeliveryEvent({...raw,event:'open'},config),null);
  assert.equal(parseDeliveryEvent({...raw,hard_bounce:false},config).suppress,null);
});
test('worker cannot send outside allowlist and handles unknown send without retry', async () => {
  for (const recipient of ['owner@example.com','other@example.com']) {
    let sent=0, claimed=false;const finished=[];
    const entry={...job,payload:encryptPayload({recipient},job.id,config),recipient_hash:recipientHash(recipient,config)};
    const store={heartbeat:async()=>{},maintain:async()=>{},claim:async()=>{if(claimed)return;claimed=true;return entry;},
      prepare:async()=> 'ready',finish:async(_,result,due)=>finished.push({result,due})};
    await runEmailWorker({config,store,send:async()=>{sent++;return {status:'delivery_unknown',code:'timeout'};}});
    assert.equal(sent,recipient==='owner@example.com'?1:0);
    assert.equal(finished[0].result.status,sent?'delivery_unknown':'failed');
    assert.equal(finished[0].due == null,true);
  }
});
test('disabled or unauthorised HTTP routes do not load the database', async () => {
  for (const kind of ['worker','events','operations']) for (const enabled of [false,true]) {
    const handler=emailHandler(kind,()=>{throw Error('database must not be loaded');},enabled?env:{});
    const res={setHeader(){},status(value){this.code=value;return this;},json(value){this.body=value;}};
    await handler({method:kind==='events'?'POST':'GET',headers:{},body:{}},res);
    assert.equal(res.code,enabled?401:503);
  }
});
