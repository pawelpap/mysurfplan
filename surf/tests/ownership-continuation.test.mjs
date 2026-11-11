import test from'node:test';import assert from'node:assert/strict';
import{ownershipContinuation,ownershipStorageKey,ownershipLifetime,ownershipNext,clearOwnership}from'../lib/ownership-continuation.mjs';
import{invitationStorageKey}from'../lib/invitation-continuation.mjs';
import{accountNext}from'../lib/account-flow.mjs';
import{ownershipMessages}from'../lib/locale/ownership-messages.mjs';
import{createLocale}from'../lib/locale/index.mjs';
import{ownershipRequest,ownershipError,ownershipRecovery,ownershipReviewIdentity}from'../lib/ownership-client.mjs';

const memory=()=>{const values=new Map();return{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
test('ownership fragments are tab-bound, isolated from staff invitations and cannot extend their original expiry',()=>{
 const storage=memory(),token='o'.repeat(43),now=1000;storage.setItem(invitationStorageKey,JSON.stringify({token:'i'.repeat(43),expires:now+ownershipLifetime}));
 const first=ownershipContinuation('#'+token,storage,now);assert.equal(first.token,token);assert.equal(first.expires,now+ownershipLifetime);assert.equal(first.stored,true);
 const reopened=ownershipContinuation('#'+token,storage,now+5000);assert.equal(reopened.expires,first.expires);
 assert.equal(ownershipContinuation('',storage,first.expires).token,'');assert.equal(storage.getItem(ownershipStorageKey),null);assert(storage.getItem(invitationStorageKey));
 assert.equal(ownershipContinuation('#<script>',storage,now).token,'');clearOwnership(storage);assert(storage.getItem(invitationStorageKey));
});
test('unavailable tab storage keeps a valid token only in memory and safe login returns never contain it',()=>{
 const denied={getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}},token='x'.repeat(43);
 const held=ownershipContinuation('#'+token,denied,1000);assert.equal(held.token,token);assert.equal(held.stored,false);
 for(const locale of['en-GB','pt-PT','es','fr']){const next=ownershipNext(locale);assert.equal(accountNext(next),next);assert(!next.includes(token));assert(!next.includes('#'));}
 assert.equal(ownershipContinuation('',denied,2000).token,'');
});
test('every ownership screen/error key has all four translations and identical interpolation fields',()=>{
 const english=ownershipMessages['en-GB'];for(const locale of['en-GB','pt-PT','es','fr']){
  assert.deepEqual(Object.keys(ownershipMessages[locale]),Object.keys(english));for(const[key,value]of Object.entries(english)){
   const text=ownershipMessages[locale][key];assert(text.trim());assert.deepEqual(text.match(/\{\w+\}/g),value.match(/\{\w+\}/g));
   assert.equal(createLocale(locale).t(key),text);
  }
 }
 assert.equal(ownershipError('SQL statement with private recipient'),'ownership.unavailable');
 assert.equal(ownershipError('ownership.agreementChanged'),'ownership.agreementChanged');
});
test('ownership request keeps the token in the body and exposes a safe401 without redirecting away from continuation',async t=>{
 let request;t.mock.method(globalThis,'fetch',async(path,options)=>{request={path,options};return Response.json({ok:false,error:'private upstream details'},{status:401});});
 await assert.rejects(ownershipRequest('/api/school-ownership/offer',{body:{action:'preview',token:'t'.repeat(43)}}),e=>e.status===401&&e.message==='ownership.unavailable');
 assert.equal(request.path,'/api/school-ownership/offer');assert.equal(JSON.parse(request.options.body).token,'t'.repeat(43));
 assert.equal(request.options.headers['X-MyWavePlan-Request'],'1');
});
test('expired/revoked mutation responses withdraw token and controls, while401 preserves only the login continuation',()=>{
 for(const message of['ownership.expired','ownership.revoked','ownership.offerExpired','ownership.offerRevoked']){
  const recovery=ownershipRecovery({message,status:409});assert.equal(recovery.clearToken,true);assert.equal(recovery.clearPreview,true);assert.equal(recovery.clearConsents,true);assert.equal(recovery.reload,false);
 }
 const loggedOut=ownershipRecovery({message:'ownership.unavailable',status:401});assert.equal(loggedOut.signIn,true);assert.equal(loggedOut.clearPreview,true);assert.equal(loggedOut.clearConsents,true);assert.equal(loggedOut.clearToken,false);
 const changed=ownershipRecovery({message:'ownership.agreementChanged',status:409});assert.equal(changed.clearPreview,true);assert.equal(changed.clearConsents,true);assert.equal(changed.reload,true);assert.equal(changed.clearToken,false);
 const uncertain=ownershipRecovery({message:'ownership.unavailable'});assert.equal(uncertain.clearToken,false);assert.equal(uncertain.reload,false);
});
test('transfer review binds exact revision/offer/recipient while harmless delivery refreshes preserve it',()=>{
 const record={canTransfer:true,school:{id:'school',name:'School',ownershipRevision:4},formerOwnerRoles:['coach'],pendingOffer:{id:'offer-a',status:'pending',recipientEmail:'a@example.invalid',deliveryStatus:'queued'}};
 const key=ownershipReviewIdentity(record,'reissue');
 assert.equal(ownershipReviewIdentity({...record,pendingOffer:{...record.pendingOffer,deliveryStatus:'sent'}},'reissue'),key);
 assert.notEqual(ownershipReviewIdentity({...record,pendingOffer:{...record.pendingOffer,id:'offer-b'}},'reissue'),key);
 assert.equal(ownershipReviewIdentity({...record,pendingOffer:null},'reissue'),null);
 assert.notEqual(ownershipReviewIdentity({...record,school:{...record.school,ownershipRevision:6}},'reissue'),key);
 assert.notEqual(ownershipReviewIdentity({...record,pendingOffer:{...record.pendingOffer,recipientEmail:'b@example.invalid'}},'reissue'),key);
 assert.equal(ownershipReviewIdentity({...record,canTransfer:false},'reissue'),null);
 const clear={...record,pendingOffer:null},a=ownershipReviewIdentity(clear,'transfer','a@example.invalid');
 assert.notEqual(ownershipReviewIdentity(clear,'transfer','b@example.invalid'),a);assert.equal(ownershipReviewIdentity(record,'transfer','a@example.invalid'),null);
});
