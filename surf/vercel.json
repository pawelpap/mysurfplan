import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { invitationInput, invitationLink, invitationType } from '../lib/invitations.mjs';
import { accountNext } from '../lib/account-flow.mjs';
import { invitationHandler } from '../lib/invitation-server.mjs';
import { encryptPayload, recipientHash } from '../lib/email/crypto.mjs';
import { recipientAllowed } from '../lib/email/config.mjs';
import { runEmailWorker } from '../lib/email/worker.mjs';
import { invitationMessage } from '../lib/email/mailjet.mjs';
const token='a'.repeat(43), userId=randomUUID();
const config={enabled:true,environment:'staging',allowlist:['staff@example.com'],payloadKey:'a'.repeat(64),recipientKey:'b'.repeat(64),callbackSecret:'c'.repeat(64),keyId:'v1',from:'support@staging-mail.mywaveplan.com'};
const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});
test('invitation input normalises addresses, requires staff roles and explicit instructor claims',()=>{
 assert.deepEqual(invitationInput({email:' STAFF@Example.com ',roles:['coach']}),{email:'staff@example.com',roles:['coach'],legacyCoachId:null});
 for(const roles of [[],['platform_admin'],['coach','coach'],null]) assert.equal(invitationInput({email:'staff@example.com',roles}),null);
 assert.equal(invitationInput({email:'staff@example.com',roles:['school_admin'],legacyCoachId:randomUUID()}),null);
});
test('invitation links keep the secret in a fragment and clean continuation survives account routing',()=>{
 const link=new URL(invitationLink('staging',token,'pt-PT'));
 assert.equal(link.hash,`#${token}`);assert(!link.search.includes(token));assert.equal(link.pathname,'/invitation');
 assert.equal(accountNext('/invitation?language=pt-PT'),'/invitation?language=pt-PT');
 assert.throws(()=>invitationLink('wrong',token,'en-GB'));
});
test('staging invitation recipients stay allowlisted and translated email disables tracking',()=>{
 assert.equal(recipientAllowed(config,'other@example.com',invitationType),false);
 assert.equal(recipientAllowed({...config,publicAccounts:true},'other@example.com',invitationType),false);
 assert.equal(recipientAllowed({...config,environment:'production',publicAccounts:true},'other@example.com',invitationType),true);
 // publicAccounts is production-only in emailConfig; allowlist still applies on normal staging config.
 const mail=invitationMessage({id:randomUUID()},'staff@example.com',config,{token,locale:'pt-PT'});
 assert.equal(mail.TrackClicks,'disabled');assert.equal(mail.TrackOpens,'disabled');assert(mail.TextPart.includes('Consultar convite'));
 assert(mail.TextPart.includes(`#${token}`));
});
test('obsolete invitation job is cancelled without sending and malformed secrets fail closed',async()=>{
 for(const [valid,preparation,status] of [[true,'obsolete','cancelled'],[false,'ready','failed'],[true,'ready','accepted']]) {
 const id=randomUUID(),recipient='staff@example.com';
 const job={id,type:invitationType,schema_version:1,recipient_hash:recipientHash(recipient,config),attempts:0,
 payload:encryptPayload({recipient,token:valid?token:'bad',locale:'en-GB'},id,config,invitationType)};
 let sent=0,finished;
 const store={claim:async()=>job,prepare:async()=>preparation,finish:async(j,outcome)=>{finished=outcome;}};
 await runEmailWorker({config,store,jobId:id,send:async()=>{sent++;return {status:'accepted'};}});
 assert.equal(finished.status,status);assert.equal(sent,status==='accepted'?1:0);
 }
});
test('token GET requests never authenticate or query and cannot consume invitations',async()=>{
 const handler=invitationHandler({sql:()=>{throw Error('query');},requireAuth:()=>{throw Error('auth');}},'accept');
 const res=response();await handler({method:'GET',query:{token}},res);assert.equal(res.statusCode,405);
});
test('preview hashes token, contains no email, and acceptance failures are generic',async()=>{
 const prior=process.env.SESSION_SECRET;process.env.SESSION_SECRET='x'.repeat(40);
 try {
 for(const action of ['preview','accept']) {
 const calls=[];
 const sql=async(strings,...values)=>{
  calls.push({query:strings.join('?'),values});
  if(strings.join('').includes('auth_login_limits'))return [{allowed:true,retry_seconds:0}];
  return action==='preview'?[{schoolId:randomUUID(),schoolName:'School',roles:['coach'],emailMatches:false,verified:true}]:[{id:null}];
 };
 const res=response();await invitationHandler({sql,requireAuth:async()=>({userId})},action)({method:'POST',body:{token}},res);
 assert(!JSON.stringify(calls).includes(token));assert(!JSON.stringify(res.body).includes('invited_email'));
 assert.equal(res.statusCode,action==='preview'?200:409);
 }
 } finally {if(prior===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=prior;}
});
test('coach claim options require school-scoped management before a directory query',async()=>{
 const school=randomUUID();let queried=false,checked;
 const deps={sql:async()=>{queried=true;return [];},resolveSchoolScope:async()=>({id:school}),requireAuth:async(req,res,options)=>{if(options){checked=options;res.status(403).json({ok:false});return null;}return {userId};}};
 const res=response();await invitationHandler(deps)({method:'GET',query:{school,options:'1'}},res);
 assert.deepEqual(checked,{schoolId:school,roles:['school_admin']});assert.equal(queried,false);assert.equal(res.statusCode,403);
});
test('successful acceptance returns only a clean personal workspace continuation',async()=>{
 const prior=process.env.SESSION_SECRET;process.env.SESSION_SECRET='x'.repeat(40);
 try {for(const manages of [true,false]) {
  const schoolId=randomUUID();const sql=async(strings)=>{
   const query=strings.join('');
   if(query.includes('auth_login_limits'))return [{allowed:true,retry_seconds:0}];
   if(query.includes('accept_staff_invitation'))return [{id:schoolId}];
   return [{slug:'a-school',manages}];
  };
  const res=response();await invitationHandler({sql,requireAuth:async()=>({userId})},'accept')({method:'POST',body:{token}},res);
  assert.equal(res.body.data.next,`/?view=${manages?'people':'teaching'}&school=a-school`);
  assert.equal(res.body.data.schoolId,schoolId);assert(!JSON.stringify(res.body).includes(token));
 }} finally {if(prior===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=prior;}
});
test('worker maintenance applies environment-scoped invitation retention before generic job cleanup',async()=>{
 const {createJobStore}=await import('../lib/email/store.mjs');
 const calls=[];
 await createJobStore(async(query,values)=>{calls.push({query,values});return [];},'staging').maintain();
 assert.deepEqual(calls[0],{query:'SELECT * FROM maintain_staff_invitations($1)',values:['staging']});
 assert(calls.some(({query})=>query.includes('DELETE FROM job_outbox')));
});
