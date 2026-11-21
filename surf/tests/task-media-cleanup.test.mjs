import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {taskMediaCleanupScope,preflightTaskMediaCleanup,drainTaskMediaCleanup,finaliseTaskMediaCleanup} from '../lib/task-media-cleanup.mjs';

const user='11111111-1111-4111-8111-111111111111',asset='22222222-2222-4222-8222-222222222222',object='33333333-3333-4333-8333-333333333333';
function plan(){
 const scope=taskMediaCleanupScope({environment:'staging',prefix:'B5 QA cleanup123',userIds:[user],schoolIds:[]});
 const assets=[{id:asset,owner_user_id:user,owner_school_id:null,uploaded_by:user,environment:'staging',purpose:'profile',source_hash:'a'.repeat(64),fingerprint:'b'.repeat(64)}];
 const objects=[{id:object,asset_id:asset,access:'private',publication_id:null,role:'master',store_id:'store_Private',pathname:`staging/private/${asset}/${object}.webp`,byte_count:'10',checksum:'c'.repeat(64),width:128,height:128}];
 return{format:'mywaveplan.task-media-cleanup.v1',scope,assets,objects,references:[],versions:[],intents:[],pins:[],inventoryDigest:createHash('sha256').update(JSON.stringify({scope,assets,objects})).digest('hex')};
}
test('exact fixture scope rejects Demo, malformed IDs and non-task manifests',()=>{
 const good={environment:'staging',prefix:'B5 QA cleanup123',userIds:[user],schoolIds:[]};
 assert.deepEqual(taskMediaCleanupScope(good).userIds,[user]);
 for(const change of[{schoolIds:['7abd47ea-705a-4a75-ad90-274c32c14f95']},{userIds:['not-id']},{userIds:[user,user]},{prefix:'real users'},{environment:'default'},{allowedVersionPins:'all'}])
  assert.throws(()=>taskMediaCleanupScope({...good,...change}));
});
test('only the two explicitly approved literal test aliases can enter a cleanup manifest',()=>{
 const base={environment:'staging',prefix:'B5 QA aliases123',userIds:[user],schoolIds:[]};
 const approved=['ppaplin+b5-owner@gmail.com','ppaplin+b5-recipient@gmail.com'];
 assert.deepEqual(taskMediaCleanupScope({...base,allowedTestEmails:approved}).allowedTestEmails,approved);
 assert.deepEqual(taskMediaCleanupScope({...base,allowedTestEmails:[]}),taskMediaCleanupScope(base),'Existing synthetic plan scopes remain compatible');
 for(const allowedTestEmails of [['ppaplin@gmail.com'],['somebody@gmail.com'],['ppaplin+b5-other@gmail.com'],['*@gmail.com'],
  ['PPAPLIN+B5-OWNER@gmail.com'],[approved[0],approved[0]],'all']){
  assert.throws(()=>taskMediaCleanupScope({...base,allowedTestEmails}),e=>e.code==='unapproved_cleanup_test_email');
 }
});

function preflightIdentityClient(record){return{async query(sql,values){
 assert.match(sql,/^\s*SELECT\b/,'Identity preflight must remain read-only');
 if(sql.includes('SELECT environment FROM job_environment'))return{rows:[{environment:'staging'}]};
 if(sql.includes('SELECT id,name,email,is_demo FROM users')){
  assert(sql.includes('id=ANY($1::uuid[])'),'Users must be selected only by recorded IDs');
  return{rows:values[0].includes(record.id)?[record]:[]};
 }
 if(sql.includes('SELECT * FROM media_storage_config'))return{rows:[{environment:'staging'}]};
 return{rows:[]};
}};}
test('approved aliases still require explicit recorded IDs, opt-in and strict task-name prefix',async()=>{
 const base={environment:'staging',prefix:'B5 QA aliases123',userIds:[user],schoolIds:[]};
 for(const email of ['ppaplin+b5-owner@gmail.com','ppaplin+b5-recipient@gmail.com']){
  const record={id:user,name:base.prefix+' ownership test',email,is_demo:false};
  const client=preflightIdentityClient(record);
  await assert.rejects(preflightTaskMediaCleanup(client,base),e=>e.code==='protected_or_unverified_task_user');
  const explicit={...base,allowedTestEmails:[email]};
  assert.equal((await preflightTaskMediaCleanup(client,explicit)).users[0].email,email);
  const noId=await preflightTaskMediaCleanup(client,{...explicit,userIds:[]});
  assert.deepEqual(noId.users,[],'An allowed email never discovers or authorises an unrecorded user');
  for(const change of [{name:'Retained real operator'},{is_demo:true},{email:'ppaplin@gmail.com'},{email:'ppaplin+b5-other@gmail.com'}])
   await assert.rejects(preflightTaskMediaCleanup(preflightIdentityClient({...record,...change}),explicit),e=>e.code==='protected_or_unverified_task_user');
 }
});
test('existing synthetic safeguards are unchanged by the explicit Gmail alias exception',async()=>{
 const base={environment:'staging',prefix:'B5 QA aliases123',userIds:[user],schoolIds:[],allowedTestEmails:['ppaplin+b5-owner@gmail.com']};
 const synthetic={id:user,name:base.prefix,email:'synthetic@example.invalid',is_demo:false};
 assert.equal((await preflightTaskMediaCleanup(preflightIdentityClient(synthetic),base)).users.length,1);
 assert.equal((await preflightTaskMediaCleanup(preflightIdentityClient({...synthetic,name:'Edited test name',email:`b5-${base.prefix.slice(-8)}-owner@example.invalid`}),base)).users.length,1);
 await assert.rejects(preflightTaskMediaCleanup(preflightIdentityClient({...synthetic,name:'Retained external account'}),base),e=>e.code==='protected_or_unverified_task_user');
 await assert.rejects(preflightTaskMediaCleanup(preflightIdentityClient({...synthetic,is_demo:true}),base),e=>e.code==='protected_or_unverified_task_user');
});
test('worker aggregate claims are not deletion evidence; metadata cannot disappear before origin verification',async()=>{
 const p=plan();let state='written',completed=null,attempts=0,assetState='deleting';
 const client={async query(sql){
  if(sql.includes('SELECT o.id,o.state'))return{rows:[{id:object,state,completed_at:completed,attempts,not_before:new Date(0),lease_until:null}]};
  if(sql.includes('SELECT id,state FROM media_assets'))return{rows:[{id:asset,state:assetState}]};
  if(sql.includes('SELECT not_before'))return{rows:[]};throw new Error('Unexpected query');
 }};
 let receipt=await drainTaskMediaCleanup(client,p,{maxRounds:1,maintenanceTransport:async()=>({deleted:999,verifiedObjects:[object]})});
 assert.equal(receipt.complete,false);assert.equal(receipt.remainingObjects,1);
 await assert.rejects(finaliseTaskMediaCleanup(client,p,receipt),e=>e.code==='storage_cleanup_not_verified');
 state='deleted';assetState='deleted';
 receipt=await drainTaskMediaCleanup(client,p,{maxRounds:1,maintenanceTransport:async()=>({deleted:1})});
 assert.equal(receipt.complete,false,'DB-only deleted state is insufficient');
 completed=new Date();attempts=1;
 receipt=await drainTaskMediaCleanup(client,p,{maxRounds:1,maintenanceTransport:async()=>{throw new Error('Not needed');}});
 assert.equal(receipt.complete,true);assert.equal(receipt.transport.length,0);
 assert.equal(receipt.verifiedObjects[0].verification,'runtime_worker_delete_then_origin_get_useCache_false_returned_null');
});
test('runtime failure remains incomplete, redacts transport diagnostics and permits safe retry',async()=>{
 const p=plan();let completed=null;
 const client={async query(sql){
  if(sql.includes('SELECT o.id,o.state'))return{rows:[{id:object,state:completed?'deleted':'written',completed_at:completed,attempts:completed?1:0,not_before:new Date(0),lease_until:null}]};
  if(sql.includes('SELECT id,state FROM media_assets'))return{rows:[{id:asset,state:completed?'deleted':'deleting'}]};
  if(sql.includes('SELECT not_before'))return{rows:[]};throw new Error('Unexpected query');
 }};
 const failed=await drainTaskMediaCleanup(client,p,{maintenanceTransport:async()=>{throw new Error('SECRET header/token URL');}});
 assert.equal(failed.complete,false);assert.doesNotMatch(JSON.stringify(failed),/SECRET|token/);
 const retry=await drainTaskMediaCleanup(client,p,{maintenanceTransport:async()=>{completed=new Date();return{deleted:0};}});
 assert.equal(retry.complete,true,'Actual queue evidence wins over aggregate count');
 await assert.rejects(drainTaskMediaCleanup(client,{...p,objects:[]},{maintenanceTransport:async()=>{}}),e=>e.code==='media_cleanup_plan_changed');
});
