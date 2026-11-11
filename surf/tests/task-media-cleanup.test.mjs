import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {taskMediaCleanupScope,drainTaskMediaCleanup,finaliseTaskMediaCleanup} from '../lib/task-media-cleanup.mjs';

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
