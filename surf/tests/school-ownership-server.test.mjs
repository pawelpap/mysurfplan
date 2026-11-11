import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {schoolOwnershipHandler} from '../lib/school-ownership-server.mjs';
import {ownershipInput} from '../lib/school-ownership.mjs';
import {runEmailWorker} from '../lib/email/worker.mjs';import {encryptPayload,recipientHash} from '../lib/email/crypto.mjs';
const actor=randomUUID(),school=randomUUID(),token='a'.repeat(43),sessionHash='b'.repeat(64);
const response=()=>({headers:{},code:200,setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(body){this.body=body;return this;}});
test('ownership scanner GET and unauthenticated requests never inspect a token or call SQL',async()=>{
 let queried=0;const handler=schoolOwnershipHandler({sql:async()=>{queried++;},requireAuth:async()=>null,getSessionHash:()=>sessionHash},'offer');
 for(const method of['GET','POST']){const res=response();await handler({method,body:{action:'preview',token,locale:'en-GB'}},res);assert.equal(queried,0);if(method==='GET')assert.equal(res.code,405);}
});
test('unverified accounts receive only public target projections and cannot infer submission authority',async()=>{
 const calls=[];const sql=async(strings,...args)=>{const q=strings.join('?');calls.push({q,args});if(q.includes('canSubmit'))return[{canSubmit:false,canReview:false}];return[{id:school,name:'Public school',slug:'public-school',ownershipRevision:1}];};
 const handler=schoolOwnershipHandler({sql,requireAuth:async()=>({userId:actor}),getSessionHash:()=>sessionHash},'claims');
 const res=response();await handler({method:'GET',query:{view:'targets',search:'Public'}},res);assert.equal(res.body.data.canSubmit,false);assert.equal(res.body.data.canReview,false);
 assert.deepEqual(Object.keys(res.body.data.schools[0]),['id','name','slug','ownershipRevision']);assert.equal(calls.length,2);assert(!calls[1].q.includes('base_'));
});
test('claim target revisions cross the database bigint boundary as safe JSON numbers usable for submission',async()=>{
 for(const revision of ['1','9007199254740992']){
  const sql=async strings=>strings.join('?').includes('canSubmit')?[{canSubmit:true,canReview:false}]:[{id:school,name:'Public school',slug:'public-school',ownershipRevision:revision}];
  const handler=schoolOwnershipHandler({sql,requireAuth:async()=>({userId:actor}),getSessionHash:()=>sessionHash},'claims');
  const res=response();await handler({method:'GET',query:{view:'targets'}},res);
  if(revision==='1'){
   assert.equal(res.code,200);const target=res.body.data.schools[0];assert.equal(target.ownershipRevision,1);
   const input=ownershipInput({action:'submit',schoolId:target.id,ownershipRevision:target.ownershipRevision,statement:'I am authorised to manage this school workspace.',requestId:randomUUID()},'claims');
   assert.equal(input.body.ownershipRevision,1);
  }else{assert.equal(res.code,503);assert.deepEqual(res.body,{ok:false,error:'ownership.unavailable'});}
 }
});
test('token preview sends only a server hash to SQL and wrong-account errors contain no offer details',async()=>{
 const calls=[];const sql=async(strings,...args)=>{const q=strings.join('?');calls.push({q,args});if(q.includes('auth_login_limits'))return[{allowed:true,retry_seconds:0}];throw Object.assign(new Error('ownership.wrongAccount'),{code:'42501'});};
 const handler=schoolOwnershipHandler({sql,requireAuth:async()=>({userId:actor}),getSessionHash:()=>sessionHash,env:{SESSION_SECRET:'s'.repeat(32)}},'offer');
 const res=response();await handler({method:'POST',body:{action:'preview',token,locale:'fr'},headers:{}},res);
 assert.equal(res.code,403);assert.deepEqual(res.body,{ok:false,error:'ownership.wrongAccount'});assert(!JSON.stringify(calls).includes(token));assert.equal(res.headers['Referrer-Policy'],'no-referrer');assert.equal(res.headers['Cache-Control'],'private, no-store');
});
test('a wrong password prevents recipient lookup, mail construction and ownership mutation',async()=>{
 let calls=0;const sql=async()=>{calls++;return[{allowed:true,retry_seconds:0}];};const handler=schoolOwnershipHandler({sql,requireAuth:async()=>({userId:actor}),getSessionHash:()=>sessionHash,env:{SESSION_SECRET:'s'.repeat(32)},proof:async()=>{throw Object.assign(new Error('account.currentPasswordInvalid'),{status:400});}});
 const res=response();await handler({method:'POST',body:{action:'transfer',schoolId:school,ownershipRevision:1,recipientEmail:'person@example.com',requestId:randomUUID(),currentPassword:'wrong',locale:'en-GB'},headers:{}},res);
 assert.equal(res.code,400);assert.equal(res.body.error,'account.currentPasswordInvalid');assert.equal(calls,1);
});
test('ownership worker authenticates encrypted type/recipient and never sends obsolete or malformed offers',async()=>{
 const config={enabled:true,environment:'staging',allowlist:['owner@example.com'],payloadKey:'c'.repeat(64),keyId:'v1',recipientKey:'d'.repeat(64)};
 for(const scenario of['valid-offer','invalid-kind','invalid-locale','wrong-recipient','obsolete','valid-notice']){
  const type=scenario==='valid-notice'?'email.ownership_changed':'email.ownership_offer',id=randomUUID();
  const payload={recipient:scenario==='wrong-recipient'?'other@example.com':'owner@example.com',locale:scenario==='invalid-locale'?'xx':'fr',token,kind:scenario==='invalid-kind'?'staff':'claim',audience:'previous',schoolName:'School'};
  const job={id,type,schema_version:1,attempts:0,recipient_hash:recipientHash(payload.recipient,config),payload:encryptPayload(payload,id,config,type)};
  let sent=0,finish;const store={claim:async()=>job,prepare:async()=>scenario==='obsolete'?'obsolete':'ready',finish:async(_j,result)=>{finish=result;}};
  await runEmailWorker({config,store,jobId:id,send:async()=>{sent++;return{status:'accepted'};}});
  assert.equal(sent,['valid-offer','valid-notice'].includes(scenario)?1:0);assert.equal(finish.status,['valid-offer','valid-notice'].includes(scenario)?'accepted':scenario==='obsolete'?'cancelled':'failed');
 }
});
