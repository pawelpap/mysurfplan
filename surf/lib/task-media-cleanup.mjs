import {createHash} from 'node:crypto';
import {isUuid} from './school-access.mjs';

const demoSchool='7abd47ea-705a-4a75-ad90-274c32c14f95';
// Explicitly approved ownership-test inboxes. This is not a Gmail/domain rule
// and never discovers users by address instead of recorded fixture IDs.
const approvedCleanupTestEmails=Object.freeze(['ppaplin+b5-owner@gmail.com','ppaplin+b5-recipient@gmail.com']);
export class TaskMediaCleanupError extends Error {
 constructor(code,details={}){super(code);this.code=code;this.details=details;}
}
const fail=(code,details)=>{throw new TaskMediaCleanupError(code,details);};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ids=values=>{
 if(!Array.isArray(values)||values.length>500||values.some(id=>!isUuid(id)))fail('invalid_exact_fixture_ids');
 const result=values.map(id=>id.toLowerCase());if(new Set(result).size!==result.length)fail('duplicate_fixture_ids');return result.sort();
};
export function taskMediaCleanupScope(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||!['rehearsal','staging','production'].includes(input.environment)||
  typeof input.prefix!=='string'||!input.prefix.startsWith('B5 QA ')||input.prefix.length>100)fail('invalid_fixture_scope');
 const userIds=ids(input.userIds),schoolIds=ids(input.schoolIds);
 if(schoolIds.includes(demoSchool))fail('protected_demo_school');
 const allowedTestEmails=input.allowedTestEmails??[];
 if(!Array.isArray(allowedTestEmails)||allowedTestEmails.length>approvedCleanupTestEmails.length||
  allowedTestEmails.some(email=>typeof email!=='string'||!approvedCleanupTestEmails.includes(email))||
  new Set(allowedTestEmails).size!==allowedTestEmails.length)fail('unapproved_cleanup_test_email');
 if(!Array.isArray(input.allowedVersionPins||[])||(input.allowedVersionPins||[]).length>1000)fail('invalid_version_pins');
 const allowedVersionPins=(input.allowedVersionPins||[]).map(pin=>{
  if(!isUuid(pin?.versionId)||!isUuid(pin?.referenceId))fail('invalid_version_pin');
  return{versionId:pin.versionId.toLowerCase(),referenceId:pin.referenceId.toLowerCase()};
 });
 return{environment:input.environment,prefix:input.prefix,userIds,schoolIds,allowedVersionPins,allowedAssetPinIds:ids(input.allowedAssetPinIds||[]),
  // Omitting the empty optional field keeps existing synthetic-plan digests
  // compatible with the original v1 scope representation.
  ...(allowedTestEmails.length?{allowedTestEmails:[...allowedTestEmails].sort()}:{} )};
}
const assetIdentity=a=>({id:a.id,owner_user_id:a.owner_user_id,owner_school_id:a.owner_school_id,uploaded_by:a.uploaded_by,
 environment:a.environment,purpose:a.purpose,source_hash:a.source_hash,fingerprint:a.fingerprint});
const objectIdentity=o=>({id:o.id,asset_id:o.asset_id,access:o.access,publication_id:o.publication_id,role:o.role,store_id:o.store_id,
 pathname:o.pathname,byte_count:String(o.byte_count),checksum:o.checksum,width:o.width,height:o.height});
const referenceKey=r=>[r.asset_id,r.owner_kind,r.owner_id,r.kind,r.reference_id].join(':');
const pinKey=p=>[p.version_id??p.versionId,p.reference_id??p.referenceId].join(':');

export async function preflightTaskMediaCleanup(client,input){
 const scope=taskMediaCleanupScope(input);
 const actual=(await client.query('SELECT environment FROM job_environment WHERE singleton')).rows[0]?.environment;
 const expected=scope.environment==='rehearsal'?'staging':scope.environment;
 if(actual!==expected)fail('fixture_environment_mismatch');
 const users=(await client.query('SELECT id,name,email,is_demo FROM users WHERE id=ANY($1::uuid[]) ORDER BY id',[scope.userIds])).rows;
 for(const user of users){const seededEmail=user.email.toLowerCase().startsWith(`b5-${scope.prefix.slice(-8).toLowerCase()}-`);
  const prefixedName=user.name===scope.prefix||user.name.startsWith(scope.prefix+' ');
  const synthetic=user.email.toLowerCase().endsWith('@example.invalid')&&(prefixedName||seededEmail);
  const approvedAlias=scope.allowedTestEmails?.includes(user.email)&&prefixedName;
  if(user.is_demo||!scope.userIds.includes(user.id)||!(synthetic||approvedAlias))
   fail('protected_or_unverified_task_user',{userIds:[user.id]});}
 const schools=(await client.query(`SELECT s.id,s.name,s.published_branding_version_id,
  EXISTS(SELECT 1 FROM school_creation_requests r WHERE r.school_id=s.id AND r.actor_id=ANY($2::uuid[])) AS created_by_task_actor
  FROM schools s WHERE s.id=ANY($1::uuid[]) ORDER BY s.id`,[scope.schoolIds,scope.userIds])).rows;
 for(const school of schools)if(school.id===demoSchool||!(school.name===scope.prefix||school.name.startsWith(scope.prefix+' ')||school.created_by_task_actor))
  fail('protected_or_unverified_task_school',{schoolIds:[school.id]});
 const cfg=(await client.query('SELECT * FROM media_storage_config WHERE singleton')).rows[0];
 if(!cfg||cfg.environment!==expected)fail('media_environment_mismatch');
 const assets=(await client.query(`SELECT * FROM media_assets WHERE owner_user_id=ANY($1::uuid[]) OR owner_school_id=ANY($2::uuid[])
  OR uploaded_by=ANY($1::uuid[]) ORDER BY id LIMIT 2001`,[scope.userIds,scope.schoolIds])).rows;
 if(assets.length>2000)fail('fixture_asset_limit');
 for(const asset of assets){
  const owned=asset.owner_user_id?scope.userIds.includes(asset.owner_user_id):scope.schoolIds.includes(asset.owner_school_id);
  if(!owned||asset.owner_school_id===demoSchool)fail('task_uploader_has_retained_asset',{assetIds:[asset.id],schoolIds:[asset.owner_school_id].filter(Boolean)});
  if(asset.environment!==expected)fail('asset_environment_mismatch',{assetIds:[asset.id]});
 }
 const assetIds=assets.map(a=>a.id);
 const objects=(await client.query('SELECT * FROM media_objects WHERE asset_id=ANY($1::uuid[]) ORDER BY id LIMIT 20001',[assetIds])).rows;
 if(objects.length>20000)fail('fixture_object_limit');
 for(const object of objects){
  const store=object.access==='private'?cfg.private_store_id:cfg.public_store_id;
  if(!['private','public'].includes(object.access)||object.store_id!==store||object.pathname!==`${expected}/${object.access}/${object.asset_id}/${object.id}.webp`)
   fail('unexpected_object_storage',{objectIds:[object.id]});
 }
 const drafts=(await client.query('SELECT id,school_id FROM school_branding_drafts WHERE school_id=ANY($1::uuid[]) ORDER BY id',[scope.schoolIds])).rows;
 const versions=(await client.query('SELECT id,school_id,published_by FROM school_branding_versions WHERE school_id=ANY($1::uuid[]) ORDER BY id',[scope.schoolIds])).rows;
 const intents=(await client.query('SELECT id,school_id,actor_id FROM school_publication_intents WHERE school_id=ANY($1::uuid[]) ORDER BY id',[scope.schoolIds])).rows;
 const foreignPublished=(await client.query(`SELECT id,school_id FROM school_branding_versions WHERE published_by=ANY($1::uuid[]) AND NOT school_id=ANY($2::uuid[])
  UNION ALL SELECT id,school_id FROM school_publication_intents WHERE actor_id=ANY($1::uuid[]) AND NOT school_id=ANY($2::uuid[])`,[scope.userIds,scope.schoolIds])).rows;
 if(foreignPublished.length)fail('task_actor_has_retained_publication',{publicationIds:foreignPublished.map(p=>p.id)});
 const references=(await client.query('SELECT * FROM media_asset_references WHERE asset_id=ANY($1::uuid[]) ORDER BY asset_id,kind,reference_id',[assetIds])).rows;
 const map=rows=>new Map(rows.map(row=>[row.id,row.school_id]));const draftSchools=map(drafts),versionSchools=map(versions),intentSchools=map(intents);
 for(const reference of references){
  const school=reference.kind==='school_draft'?draftSchools.get(reference.reference_id):reference.kind==='school_publication'?versionSchools.get(reference.reference_id):
   reference.kind==='publish_intent'?intentSchools.get(reference.reference_id):null;
  const valid=reference.kind==='profile'?scope.userIds.includes(reference.owner_id)&&reference.reference_id===reference.owner_id:
   reference.kind==='email_pin'?scope.schoolIds.includes(reference.owner_id)&&scope.allowedAssetPinIds.includes(reference.reference_id):school===reference.owner_id;
  if(!valid)fail('foreign_or_unrecorded_media_reference',{assetIds:[reference.asset_id],referenceIds:[reference.reference_id]});
 }
 const pins=(await client.query('SELECT p.* FROM school_branding_version_pins p JOIN school_branding_versions v ON v.id=p.version_id WHERE v.school_id=ANY($1::uuid[]) ORDER BY p.version_id,p.reference_id',[scope.schoolIds])).rows;
 const allowedPins=new Set(scope.allowedVersionPins.map(pinKey));
 if(pins.some(pin=>!allowedPins.has(pinKey(pin))))fail('unrecorded_version_pin',{pins:pins.map(p=>({versionId:p.version_id,referenceId:p.reference_id}))});
 const inventory={scope,assets:assets.map(assetIdentity),objects:objects.map(objectIdentity)};
 return{format:'mywaveplan.task-media-cleanup.v1',createdAt:new Date().toISOString(),scope,users,schools,assets:inventory.assets,objects:inventory.objects,
  drafts,versions,intents,references,pins,inventoryDigest:digest(inventory)};
}

function assertPlan(plan){
 if(plan?.format!=='mywaveplan.task-media-cleanup.v1')fail('invalid_media_cleanup_plan');
 taskMediaCleanupScope(plan.scope);
 if(plan.inventoryDigest!==digest({scope:plan.scope,assets:plan.assets,objects:plan.objects}))fail('media_cleanup_plan_changed');
}
async function lockScope(client,plan){
 await client.query('SELECT id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[plan.scope.userIds]);
 await client.query('SELECT id FROM schools WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[plan.scope.schoolIds]);
 await client.query('SELECT id FROM school_publication_intents WHERE school_id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[plan.scope.schoolIds]);
 await client.query('SELECT id FROM media_assets WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[plan.assets.map(a=>a.id)]);
}
function compareInventory(plan,fresh){
 if(plan.inventoryDigest!==fresh.inventoryDigest)fail('fixture_media_inventory_changed');
 const originalRefs=new Set(plan.references.map(referenceKey));if(fresh.references.some(r=>!originalRefs.has(referenceKey(r))))fail('new_fixture_media_reference');
 const originalDrafts=new Set(plan.drafts.map(v=>v.id)),originalVersions=new Set(plan.versions.map(v=>v.id)),originalIntents=new Set(plan.intents.map(v=>v.id));
 if(fresh.drafts.some(v=>!originalDrafts.has(v.id))||fresh.versions.some(v=>!originalVersions.has(v.id))||fresh.intents.some(v=>!originalIntents.has(v.id)))fail('new_fixture_publication');
}

// Caller must wrap stage/finalise in a transaction and commit before transport.
// No external storage call is ever made while database locks are held.
export async function stageTaskMediaCleanup(client,plan){
 assertPlan(plan);await lockScope(client,plan);
 const fresh=await preflightTaskMediaCleanup(client,plan.scope);compareInventory(plan,fresh);
 const objectIds=plan.objects.map(o=>o.id),assetIds=plan.assets.map(a=>a.id);
 const prior=(await client.query(`SELECT
  NOT EXISTS(SELECT 1 FROM users WHERE id=ANY($1::uuid[]) AND disabled_at IS NULL) AND
  NOT EXISTS(SELECT 1 FROM schools WHERE id=ANY($2::uuid[]) AND (workspace_status<>'closed' OR published_branding_version_id IS NOT NULL)) AND
  NOT EXISTS(SELECT 1 FROM media_assets a LEFT JOIN media_asset_cleanup c ON c.asset_id=a.id WHERE a.id=ANY($3::uuid[]) AND c.reason IS DISTINCT FROM 'task_fixture_closeout') AND
  NOT EXISTS(SELECT 1 FROM media_objects o LEFT JOIN media_cleanup_queue q ON q.object_id=o.id WHERE o.id=ANY($4::uuid[]) AND q.reason IS DISTINCT FROM 'task_fixture_closeout') AS staged`,
 [plan.scope.userIds,plan.scope.schoolIds,assetIds,objectIds])).rows[0];
 if(prior?.staged&&!fresh.references.length&&!fresh.pins.length)return{inventoryDigest:plan.inventoryDigest,alreadyStaged:true,assetIds,objectIds,requiresRuntimeVerification:true};
 const leases=(await client.query('SELECT object_id FROM media_cleanup_queue WHERE object_id=ANY($1::uuid[]) AND lease_until>clock_timestamp() AND completed_at IS NULL FOR UPDATE',[objectIds])).rows;
 if(leases.length)fail('fixture_cleanup_worker_busy',{objectIds:leases.map(l=>l.object_id)});
 await client.query('UPDATE users SET disabled_at=COALESCE(disabled_at,now()),photo_mode=$2,photo_asset_id=NULL,photo_revision=photo_revision+1 WHERE id=ANY($1::uuid[])',[plan.scope.userIds,'none']);
 await client.query("UPDATE schools SET workspace_status='closed',listing_status='unlisted',published_branding_version_id=NULL WHERE id=ANY($1::uuid[])",[plan.scope.schoolIds]);
 await client.query("UPDATE school_publication_intents SET state='failed',finished_at=COALESCE(finished_at,now()) WHERE school_id=ANY($1::uuid[]) AND state='pending'",[plan.scope.schoolIds]);
 await client.query('DELETE FROM media_asset_references WHERE asset_id=ANY($1::uuid[])',[assetIds]);
 for(const pin of fresh.pins)await client.query('DELETE FROM school_branding_version_pins WHERE version_id=$1 AND reference_id=$2',[pin.version_id,pin.reference_id]);
 await client.query(`INSERT INTO media_asset_cleanup(asset_id,not_before,reason) SELECT id,now()+interval '2 minutes','task_fixture_closeout' FROM media_assets WHERE id=ANY($1::uuid[])
  ON CONFLICT(asset_id) DO UPDATE SET not_before=EXCLUDED.not_before,reason=EXCLUDED.reason`,[assetIds]);
 // Reverify every exact object, even one previously marked deleted, through the
 // runtime worker's delete+origin-read path before its metadata can disappear.
 await client.query(`INSERT INTO media_cleanup_queue(object_id,not_before,reason) SELECT id,now()+interval '2 minutes','task_fixture_closeout' FROM media_objects WHERE id=ANY($1::uuid[])
  ON CONFLICT(object_id) DO UPDATE SET not_before=GREATEST(media_cleanup_queue.not_before,EXCLUDED.not_before),reason=EXCLUDED.reason,
  completed_at=NULL,lease_id=NULL,lease_until=NULL`,[objectIds]);
 return{inventoryDigest:plan.inventoryDigest,stagedAt:new Date().toISOString(),assetIds,objectIds,requiresRuntimeVerification:true};
}

export async function inspectTaskMediaCleanup(client,plan){
 assertPlan(plan);
 const rows=(await client.query(`SELECT o.id,o.state,q.completed_at,q.attempts,q.not_before,q.lease_until FROM media_objects o
  LEFT JOIN media_cleanup_queue q ON q.object_id=o.id WHERE o.id=ANY($1::uuid[]) ORDER BY o.id`,[plan.objects.map(o=>o.id)])).rows;
 const assets=(await client.query('SELECT id,state FROM media_assets WHERE id=ANY($1::uuid[]) ORDER BY id',[plan.assets.map(a=>a.id)])).rows;
 if(rows.length!==plan.objects.length||assets.length!==plan.assets.length)fail('fixture_media_metadata_missing_before_verification');
 const verified=rows.filter(o=>o.state==='deleted'&&o.completed_at&&o.attempts>0).map(o=>({objectId:o.id,completedAt:new Date(o.completed_at).toISOString(),attempts:o.attempts,
  verification:'runtime_worker_delete_then_origin_get_useCache_false_returned_null'}));
 const complete=verified.length===rows.length&&assets.every(a=>a.state==='deleted');
 const now=Date.now();const future=rows.filter(o=>!verified.some(v=>v.objectId===o.id)).flatMap(o=>[o.not_before,o.lease_until]).filter(Boolean).map(v=>new Date(v).getTime()).filter(v=>v>now);
 const assetDue=(await client.query('SELECT not_before FROM media_asset_cleanup WHERE asset_id=ANY($1::uuid[]) AND not_before>clock_timestamp()',[assets.filter(a=>a.state!=='deleted').map(a=>a.id)])).rows;
 future.push(...assetDue.map(row=>new Date(row.not_before).getTime()));
 return{inventoryDigest:plan.inventoryDigest,complete,verifiedObjects:verified,deletedAssets:assets.filter(a=>a.state==='deleted').length,
  remainingObjects:rows.length-verified.length,nextAttemptAt:future.length?new Date(Math.min(...future)).toISOString():null};
}

export async function drainTaskMediaCleanup(client,plan,{maintenanceTransport,maxRounds=100,onProgress=()=>{}}={}){
 assertPlan(plan);if(typeof maintenanceTransport!=='function'||!Number.isInteger(maxRounds)||maxRounds<1||maxRounds>1000)fail('invalid_cleanup_transport');
 const transport=[];let status=await inspectTaskMediaCleanup(client,plan);
 for(let round=1;!status.complete&&round<=maxRounds;round++){
  const priorVerified=status.verifiedObjects.length,priorAssets=status.deletedAssets;
  try{await maintenanceTransport({round,objectIds:plan.objects.map(o=>o.id),assetIds:plan.assets.map(a=>a.id)});transport.push({round,result:'runtime_maintenance_completed'});}
  catch{transport.push({round,result:'runtime_maintenance_failed'});status=await inspectTaskMediaCleanup(client,plan);break;}
  status=await inspectTaskMediaCleanup(client,plan);await onProgress({round,...status});
  if(!status.complete&&status.verifiedObjects.length===priorVerified&&status.deletedAssets===priorAssets&&status.nextAttemptAt)break;
 }
 return{...status,transport,checkedAt:new Date().toISOString()};
}

function assertReceipt(plan,receipt){
 if(!receipt?.complete||receipt.inventoryDigest!==plan.inventoryDigest||!Array.isArray(receipt.verifiedObjects)||
  receipt.verifiedObjects.length!==plan.objects.length||new Set(receipt.verifiedObjects.map(o=>o.objectId)).size!==plan.objects.length||
  plan.objects.some(o=>!receipt.verifiedObjects.some(v=>v.objectId===o.id&&v.completedAt&&v.attempts>0&&v.verification==='runtime_worker_delete_then_origin_get_useCache_false_returned_null')))
  fail('storage_cleanup_not_verified');
}
export async function finaliseTaskMediaCleanup(client,plan,receipt){
 assertPlan(plan);assertReceipt(plan,receipt);await lockScope(client,plan);
 const fresh=await preflightTaskMediaCleanup(client,plan.scope);
 const frozen=(await client.query(`SELECT NOT EXISTS(SELECT 1 FROM users WHERE id=ANY($1::uuid[]) AND disabled_at IS NULL) AND
  NOT EXISTS(SELECT 1 FROM schools WHERE id=ANY($2::uuid[]) AND (workspace_status<>'closed' OR published_branding_version_id IS NOT NULL)) AS frozen`,
 [plan.scope.userIds,plan.scope.schoolIds])).rows[0];
 if(!frozen?.frozen)fail('fixture_scope_not_frozen');
 if(!fresh.assets.length&&!fresh.objects.length&&!fresh.drafts.length&&!fresh.versions.length&&!fresh.intents.length)
  return{alreadyFinalised:true,inventoryDigest:plan.inventoryDigest};
 compareInventory(plan,fresh);
 const current=await inspectTaskMediaCleanup(client,plan);if(!current.complete)fail('storage_cleanup_not_verified');
 const references=(await client.query('SELECT asset_id FROM media_asset_references WHERE asset_id=ANY($1::uuid[])',[plan.assets.map(a=>a.id)])).rows;
 if(references.length)fail('fixture_media_still_referenced');
 await client.query('DELETE FROM school_branding_version_pins WHERE version_id=ANY($1::uuid[])',[plan.versions.map(v=>v.id)]);
 await client.query('DELETE FROM school_branding_versions WHERE school_id=ANY($1::uuid[])',[plan.scope.schoolIds]);
 await client.query('DELETE FROM school_publication_intents WHERE school_id=ANY($1::uuid[])',[plan.scope.schoolIds]);
 await client.query('DELETE FROM school_branding_drafts WHERE school_id=ANY($1::uuid[])',[plan.scope.schoolIds]);
 await client.query('DELETE FROM media_cleanup_queue WHERE object_id=ANY($1::uuid[])',[plan.objects.map(o=>o.id)]);
 await client.query('DELETE FROM media_asset_cleanup WHERE asset_id=ANY($1::uuid[])',[plan.assets.map(a=>a.id)]);
 await client.query('DELETE FROM media_objects WHERE id=ANY($1::uuid[])',[plan.objects.map(o=>o.id)]);
 await client.query('DELETE FROM media_assets WHERE id=ANY($1::uuid[])',[plan.assets.map(a=>a.id)]);
 return{alreadyFinalised:false,inventoryDigest:plan.inventoryDigest,deletedMetadata:{assets:plan.assets.length,objects:plan.objects.length},
  accountsNotDeleted:true,legalEvidenceUntouched:true};
}
