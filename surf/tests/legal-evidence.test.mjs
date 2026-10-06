import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLegalAction,defaultPreferences,preferenceVersion,isLegalStagingPreview } from '../lib/legal/contracts.mjs';
import { createLegalHandler } from '../lib/legal/handler.mjs';
const userId='9dcd789c-c49d-4945-8800-48b7328a4359',schoolId='3a47e2a1-123b-4311-95e5-ea81bb3bbbd4',membershipId='b58b4492-a38a-4a3c-81fc-1453e27af428';
const session={userId,role:'student',schools:[]};
const document={document_id:'mywaveplan.adult-pilot-terms',version:'v1',language:'en-GB',content_hash:'a'.repeat(64),kind:'terms',status:'published',effective_at:'2026-01-01T00:00:00Z'};
const terms={action:'accept_terms',documentId:document.document_id,version:'v1',language:'en-GB',contentHash:document.content_hash,accepted:true};
const schoolDoc={...document,document_id:'mywaveplan.school-processing',kind:'school_processing'};
const schoolBody={...terms,action:'accept_school',documentId:schoolDoc.document_id,schoolId,authorisedRepresentative:true};
test('acceptance is explicit and exact document, language and hash are required',()=>{
  assert.equal(validateLegalAction(terms,session,document).userId,userId);
  for (const change of [{accepted:false},{version:'v2'},{language:'pt-PT'},{documentId:'another'},{contentHash:'b'.repeat(64)}]) assert.throws(()=>validateLegalAction({...terms,...change},session,document));
  assert.throws(()=>validateLegalAction(terms,{...session,demo:true},document),{statusCode:403});
  assert.throws(()=>validateLegalAction(terms,null,document),{statusCode:401});
});
test('drafts, future versions and staging previews cannot be production agreements',()=>{
  assert.throws(()=>validateLegalAction(terms,session,{...document,status:'draft'}),{statusCode:409});
  assert.throws(()=>validateLegalAction(terms,session,{...document,effective_at:'2099-01-01'}),{statusCode:409});
  assert.throws(()=>validateLegalAction(terms,session,{...document,status:'staging_preview'}),{statusCode:409});
  assert.equal(validateLegalAction(terms,session,{...document,status:'staging_preview'},{stagingPreview:true}).action,'accept_terms');
});
test('school acceptance needs an active representative, scoped membership and explicit authority',()=>{
  const relation={id:schoolId,membershipId,status:'active',open:true,roles:['school_admin']};
  assert.equal(validateLegalAction(schoolBody,{...session,schools:[relation]},schoolDoc).membershipId,membershipId);
  for (const change of [{status:'suspended'},{open:false},{roles:['coach']},{id:userId},{membershipId:null}]) assert.throws(()=>validateLegalAction(schoolBody,{...session,schools:[{...relation,...change}]},schoolDoc),{statusCode:403});
  assert.throws(()=>validateLegalAction(schoolBody,{...session,role:'platform_admin'},schoolDoc),{statusCode:403});
  assert.throws(()=>validateLegalAction({...schoolBody,authorisedRepresentative:false},{...session,schools:[relation]},schoolDoc));
});
test('privacy delivery is distinct from contractual acceptance',()=>{
  const notice={...document,document_id:'mywaveplan.privacy',kind:'privacy_notice'};
  assert.throws(()=>validateLegalAction({...terms,documentId:notice.document_id},session,notice));
  const action=validateLegalAction({...terms,action:'notice_delivery',documentId:notice.document_id,accepted:false},session,notice);
  assert.equal(action.action,'notice_delivery');assert.equal(action.accepted,undefined);
});
test('optional purposes default off, reject activation and allow independent withdrawal',()=>{
  assert(Object.values(defaultPreferences()).every(value=>value===false));
  const body={action:'optional_preference',purpose:'analytics',selected:false,version:preferenceVersion,language:'en-GB'};
  assert.equal(validateLegalAction(body,session).selected,false);
  assert.throws(()=>validateLegalAction({...body,selected:true},session),{statusCode:409});
  for(const change of [{purpose:'unknown'},{version:'wrong'},{language:'pt-PT'},{selected:'false'}]) assert.throws(()=>validateLegalAction({...body,...change},session));
});
test('staging preview needs verified database, host and project boundaries',()=>{
  const binding={host:'staging.mywaveplan.com',environment:'staging',projectId:'prj_sWC9MbvG8rWtAO0YpuSNiOqZwYlO'};
  assert.equal(isLegalStagingPreview(binding),true);
  for(const change of [{host:'mywaveplan.com'},{environment:'production'},{projectId:'prj_J100oKHrcYqghajndUkaEI8LDSvi'},{host:'untrusted.example'}]) assert.equal(isLegalStagingPreview({...binding,...change}),false);
});
function response(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.statusCode=c;return this;},json(v){this.body=v;return this;}};}
test('handler never trusts client subject and notice delivery cannot be forged through API',async()=>{
  const writes=[];
  const store={preview:async()=>false,document:async()=>document,record:async action=>writes.push(action),records:async id=>({userId:id})};
  const handler=createLegalHandler({requireAuth:async()=>session,store});
  const res=response();await handler({method:'POST',body:{...terms,userId:'another-account'}},res);
  assert.equal(res.statusCode,200);assert.equal(writes[0].userId,userId);
  const notice=response();await handler({method:'POST',body:{...terms,action:'notice_delivery'}},notice);
  assert.equal(notice.statusCode,400);assert.equal(writes.length,1);
  const invalid=response();await handler({method:'POST',body:{}},invalid);assert.equal(invalid.statusCode,400);
  const method=response();await handler({method:'DELETE'},method);assert.equal(method.statusCode,405);
});
test('handler respects authentication, handles stale documents and redacts storage failures',async()=>{
  const anonymous=createLegalHandler({requireAuth:async(req,res)=>{res.status(401).json({ok:false});return null;},store:{}});
  const res=response();await anonymous({method:'GET'},res);assert.equal(res.statusCode,401);
  const stale=createLegalHandler({requireAuth:async()=>session,store:{preview:async()=>false,document:async()=>null}});
  const mismatch=response();await stale({method:'POST',body:terms},mismatch);assert.equal(mismatch.statusCode,409);
  const failure=createLegalHandler({requireAuth:async()=>session,store:{records:async()=>{throw new Error('private database details');}}});
  const unavailable=response();await failure({method:'GET'},unavailable);assert.equal(unavailable.statusCode,503);assert(!JSON.stringify(unavailable.body).includes('private database'));
});

test('account overview exposes document metadata and only eligible schools without document bodies',async()=>{
  const relation={id:schoolId,name:'Eligible school',status:'active',open:true,roles:['school_admin']};
  const store={records:async id=>({subject:id,acceptances:[],notices:[]}),preview:async()=>true,document:async id=>({...document,document_id:id,content:'Private policy body'})};
  const handler=createLegalHandler({requireAuth:async()=>({...session,schools:[relation,{...relation,id:userId,roles:['student']}]}),store});
  const res=response();await handler({method:'GET'},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.data.subject,userId);
  assert.equal(res.body.data.documents.length,2);assert(res.body.data.documents.every(d=>d.content===undefined));
  assert.deepEqual(res.body.data.schools,[{id:schoolId,name:'Eligible school'}]);
});
