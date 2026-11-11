import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {ownershipInput,ownershipLink} from '../lib/school-ownership.mjs';
import {ownershipMessage} from '../lib/email/mailjet.mjs';
import {ownershipEmailCopy} from '../lib/email/ownership.mjs';
import {recipientAllowed} from '../lib/email/config.mjs';
const id=randomUUID(),requestId=randomUUID(),token='a'.repeat(43);
test('ownership inputs forbid actor/role fields and require explicit exact agreement acceptance',()=>{
 const body={action:'transfer',schoolId:id,ownershipRevision:1,recipientEmail:' Person@Example.com ',requestId,currentPassword:'secret',locale:'en-GB'};
 const result=ownershipInput(body,'manage');assert.equal(result.body.recipientEmail,'person@example.com');assert.equal(result.body.currentPassword,undefined);
 for(const forbidden of['actorId','recipientUserId','roles','platform','emailJobId','workspaceStatus'])assert.throws(()=>ownershipInput({...body,[forbidden]:id},'manage'));
 assert.throws(()=>ownershipInput({...body,ownershipRevision:1.1},'manage'));assert.throws(()=>ownershipInput(body,'claims'));
 const acceptance={action:'accept',token,offerId:id,ownershipRevision:1,documentId:'mywaveplan.school-processing',version:'required-v2',language:'fr',contentHash:'a'.repeat(64),
  acceptedOwnership:true,authorisedRepresentative:true,acceptedAgreement:true,consequencesVersion:'ownership-workspace/1',currentPassword:'secret',locale:'fr'};
 assert.equal(ownershipInput(acceptance,'offer').body.version,'required-v2');
 for(const flag of['acceptedOwnership','authorisedRepresentative','acceptedAgreement'])for(const v of[false,undefined,'true'])assert.throws(()=>ownershipInput({...acceptance,[flag]:v},'offer'));
 assert.throws(()=>ownershipInput({...acceptance,consequencesVersion:'business-title/1'},'offer'));
});
test('claim statements and shared decision reasons are bounded plain text with a private case reference',()=>{
 const submit={action:'submit',schoolId:id,ownershipRevision:1,statement:' I represent this school. ',requestId};
 assert.equal(ownershipInput(submit,'claims').body.statement,'I represent this school.');assert.throws(()=>ownershipInput({...submit,statement:'x'.repeat(2001)},'claims'));
 const review={action:'review',claimId:id,revision:1,decision:'approve',reason:'Verified by support.',caseReference:'CASE-123',requestId,currentPassword:'secret',locale:'en-GB'};
 assert.equal(ownershipInput(review,'claims').body.reason,review.reason);assert.throws(()=>ownershipInput({...review,privateNotes:'secret'},'claims'));
});
test('ownership links bind the environment and keep secrets in a fragment',()=>{
 assert.equal(ownershipLink('staging',token,'fr'),`https://staging.mywaveplan.com/ownership?language=fr#${token}`);
 assert.throws(()=>ownershipLink('evil',token,'fr'));assert.throws(()=>ownershipLink('production','short','fr'));
});
test('all ownership offer and notice variants render in all four locales with platform branding and escaped school names',()=>{
 for(const locale of['en-GB','pt-PT','es','fr']){
  assert.deepEqual(Object.keys(ownershipEmailCopy[locale]).sort(),Object.keys(ownershipEmailCopy['en-GB']).sort());
  for(const kind of['claim','transfer']){
   const result=ownershipMessage({id,type:'email.ownership_offer'},'recipient@example.com',{environment:'staging',from:'support@staging-mail.mywaveplan.com',callbackSecret:'x'.repeat(32)}, {kind,token,locale});
   assert(result.TextPart);
  }
  for(const audience of['new','previous']){
   const result=ownershipMessage({id,type:'email.ownership_changed'},'recipient@example.com',{environment:'staging',from:'support@staging-mail.mywaveplan.com',callbackSecret:'x'.repeat(32)}, {audience,schoolName:'<script>School & Co</script>',locale});
   assert(result.HTMLPart.includes('&lt;script&gt;School &amp; Co&lt;/script&gt;'));assert(!result.HTMLPart.includes('<script>'));assert.equal(result.TrackOpens,'disabled');assert.equal(result.TrackClicks,'disabled');
  }
 }
});
test('ownership email public delivery remains production-account gated and staging allowlisted',()=>{
 for(const type of['email.ownership_offer','email.ownership_changed']){
  assert.equal(recipientAllowed({environment:'staging',allowlist:[],publicAccounts:true},'person@example.com',type),false);
  assert.equal(recipientAllowed({environment:'production',allowlist:[],publicAccounts:false},'person@example.com',type),false);
  assert.equal(recipientAllowed({environment:'production',allowlist:[],publicAccounts:true},'person@example.com',type),true);
 }
});

test('UI and API share minimum statement/reason and maximum case-reference bounds',()=>{
 const s={action:'submit',schoolId:id,ownershipRevision:1,statement:'x'.repeat(20),requestId};assert(ownershipInput(s,'claims'));
 assert.throws(()=>ownershipInput({...s,statement:'x'.repeat(19)},'claims'));
 const r={action:'review',claimId:id,revision:1,decision:'reject',reason:'x'.repeat(10),caseReference:'x'.repeat(160),requestId,currentPassword:'secret',locale:'en-GB'};
 assert(ownershipInput(r,'claims'));assert.throws(()=>ownershipInput({...r,reason:'x'.repeat(9)},'claims'));assert.throws(()=>ownershipInput({...r,caseReference:'x'.repeat(161)},'claims'));
});
