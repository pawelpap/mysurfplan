import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';

export async function verifySchoolMedia(client) {
 const checks=[];
 const row=async(q,p=[]) => (await client.query(q,p)).rows[0];
 const scalar=async(q,p=[])=>Object.values(await row(q,p))[0];
 const hash=value=>createHash('sha256').update(value).digest('hex');
 const prefix=`b7-${randomUUID()}`;
 async function denied(q,p,code='42501') {
  await client.query('SAVEPOINT expected_media_denial');
  try{await client.query(q,p);assert.fail('Expected media denial');}catch(error){assert.equal(error.code,code,error.message);}
  finally{await client.query('ROLLBACK TO SAVEPOINT expected_media_denial');}
 }
 async function person(label,verified=true) {
  return scalar("INSERT INTO users(name,email,role,email_verified_at,photo_url) VALUES($1,$2,'student',CASE WHEN $3 THEN now() END,'https://example.invalid/old.jpg') RETURNING id",[prefix+label,prefix+label+'@example.invalid',verified]);
 }
 const owner=await person('owner'),other=await person('other'),unverified=await person('unverified',false),platform=await person('platform');
 await client.query('INSERT INTO platform_role_assignments(user_id) VALUES($1)',[platform]);
 const details={name:prefix,description:'',timezone:'Europe/Lisbon',contactEmail:'',contactPhone:'',website:'',socialLinks:[],operatingSpotIds:[]};
 const school=(await scalar('SELECT create_draft_school($1,$2,$3::jsonb)',[owner,randomUUID(),details])).data.id;
 const reserveSql='SELECT reserve_media_upload($1,$2,$3,$4,$5,$6,$7,$8)';
 const reserve=async(actor,purpose='profile',scope=null,revision=1,replacing=null,request=randomUUID(),fingerprint=hash(request))=>scalar(reserveSql,[actor,scope,purpose,request,fingerprint,hash('source'),revision,replacing]);
 const first=await reserve(owner);
 assert.equal(first.owner_user_id,owner);assert.equal(first.owner_school_id,null);assert.equal(first.state,'pending');
 assert.equal(Number(first.reserved_bytes),16777216);
 const replay=await reserve(owner,'profile',null,1,null,first.request_id,first.fingerprint);assert.equal(replay.id,first.id);
 await denied(reserveSql,[owner,null,'profile',first.request_id,hash('changed'),hash('source'),1,null],'23514');
 await denied(reserveSql,[unverified,null,'profile',randomUUID(),hash('a'),hash('source'),1,null]);
 await denied(reserveSql,[other,school,'logo',randomUUID(),hash('a'),hash('source'),1,null]);
 await denied(reserveSql,[platform,school,'logo',randomUUID(),hash('a'),hash('source'),1,null]);
 checks.push('verified exclusive ownership, actor-scoped idempotency and foreign/private-draft protection');

 const manifest=purpose=>(purpose==='profile'?['master','w128','w384']:purpose==='logo'?['master','w128','w512']:purpose==='cover'?['master','w800','w1600']:['master','w600','w1200'])
  .map(role=>({role,byteCount:100,checksum:hash(role),width:128,height:128}));
 const journal='SELECT journal_media_objects($1,$2,$3::jsonb,$4,$5)';
 const objects=await scalar(journal,[owner,first.id,JSON.stringify(manifest('profile')),'private',null]);
 assert.equal(objects.length,3);
 assert(objects.every(o=>o.access==='private'&&o.publication_id===null&&o.pathname===`staging/private/${first.id}/${o.id}.webp`));
 await denied('INSERT INTO media_asset_references(asset_id,owner_kind,owner_id,kind,reference_id) VALUES($1,$2,$3,$4,$5)',[first.id,'user',owner,'profile',owner],'23514');
 await denied('SELECT finish_media_asset($1,$2,320,200)',[owner,first.id],'23514');
 await denied('SELECT finish_media_asset($1,$2,320,200)',[other,first.id]);
 await client.query("UPDATE media_objects SET state='written' WHERE asset_id=$1",[first.id]);
 const finished=await scalar('SELECT finish_media_asset($1,$2,320,200)',[owner,first.id]);
 assert.equal(finished.photo.mode,'uploaded');assert.equal(finished.photo.revision,2);assert.equal(finished.photo.assetId,first.id);
 assert.equal(finished.photo.url,`/api/media/${first.id}?variant=w384`);
 assert.deepEqual(await scalar('SELECT finish_media_asset($1,$2,320,200)',[owner,first.id]),finished);
 await denied('INSERT INTO media_asset_references(asset_id,owner_kind,owner_id,kind,reference_id) VALUES($1,$2,$3,$4,$5)',[first.id,'user',other,'profile',other],'23503');
 checks.push('durable private object journal, complete-only attach, private application URL, relational owner references and replay');

 const pending=await reserve(owner,'profile',null,2,first.id);
 const pendingObjects=await scalar(journal,[owner,pending.id,JSON.stringify(manifest('profile')),'private',null]);
 assert.equal(pendingObjects.length,3);
 await client.query("UPDATE media_objects SET state='written' WHERE asset_id=$1",[pending.id]);
 const removed=await scalar('SELECT remove_personal_photo($1,2)',[owner]);
 assert.equal(removed.mode,'none');assert.equal(removed.url,null);assert.equal(removed.revision,3);
 assert.equal(await scalar('SELECT photo_url FROM users WHERE id=$1',[owner]),'https://example.invalid/old.jpg');
 await denied('SELECT finish_media_asset($1,$2,320,200)',[owner,pending.id],'40001');
 assert.equal((await scalar('SELECT media_profile_json($1)',[owner])).mode,'none');
 await denied('SELECT remove_personal_photo($1,2)',[owner],'40001');
 checks.push('remove preserves explicit none mode; old external URL cannot resurrect; stale upload leaves previous profile unchanged');

 const schoolAsset=await reserve(owner,'logo',school,null);
 const schoolObjects=await scalar(journal,[owner,schoolAsset.id,JSON.stringify(manifest('logo')),'private',null]);
 await client.query("UPDATE media_objects SET state='written' WHERE asset_id=$1",[schoolAsset.id]);
 await scalar('SELECT finish_media_asset($1,$2,320,200)',[owner,schoolAsset.id]);
 await denied(journal,[owner,schoolAsset.id,JSON.stringify(manifest('logo').filter(v=>v.role!=='master')),'public',randomUUID()]);
 const publication=randomUUID();
 await client.query("INSERT INTO media_asset_references VALUES($1,'school',$2,'publish_intent',$3,now())",[schoolAsset.id,school,publication]);
 await denied(journal,[owner,schoolAsset.id,JSON.stringify(manifest('logo')),'public',publication],'23514');
 const copies=await scalar(journal,[owner,schoolAsset.id,JSON.stringify(manifest('logo').filter(v=>v.role!=='master')),'public',publication]);
 assert.equal(copies.length,2);assert(copies.every(o=>o.access==='public'&&o.publication_id===publication));
 assert.equal(schoolObjects.length,3);
 checks.push('school publishing requires exact intent pin and copies only sanitised non-master derivatives');

 await client.query('UPDATE media_asset_cleanup SET not_before=now() WHERE asset_id=$1',[schoolAsset.id]);
 for(const object of copies)await client.query('SELECT queue_media_object_cleanup($1,$2)',[object.id,'failed_publish']);
 await client.query('UPDATE media_cleanup_queue SET not_before=now() WHERE object_id=ANY($1::uuid[])',[copies.map(o=>o.id)]);
 const protectedObjects=await scalar('SELECT claim_media_cleanup(20)');
 assert(!protectedObjects.some(o=>o.asset_id===schoolAsset.id));
 await client.query("DELETE FROM media_asset_references WHERE asset_id=$1 AND kind='publish_intent'",[schoolAsset.id]);
 const draftReference=randomUUID();
 await client.query("INSERT INTO media_asset_references VALUES($1,'school',$2,'school_draft',$3,now())",[schoolAsset.id,school,draftReference]);
 const claimed=await scalar('SELECT claim_media_cleanup(20)');
 const publicCopies=claimed.filter(o=>o.asset_id===schoolAsset.id);
 assert.equal(publicCopies.length,2);assert(publicCopies.every(o=>o.access==='public'));
 for(const o of claimed)await client.query('SELECT finish_media_cleanup($1,$2,true)',[o.id,o.leaseId]);
 assert.equal(await scalar('SELECT state FROM media_assets WHERE id=$1',[schoolAsset.id]),'ready');
 await client.query("DELETE FROM media_asset_references WHERE asset_id=$1 AND kind='school_draft'",[schoolAsset.id]);
 const orphaned=await scalar('SELECT claim_media_cleanup(20)');
 assert(orphaned.some(o=>o.asset_id===schoolAsset.id&&o.access==='private'));
 await denied("INSERT INTO media_asset_references VALUES($1,'school',$2,'school_draft',$3,now())",[schoolAsset.id,school,randomUUID()],'23514');
 for(const o of orphaned)await client.query('SELECT finish_media_cleanup($1,$2,true)',[o.id,o.leaseId]);
 assert.equal(await scalar('SELECT state FROM media_assets WHERE id=$1',[schoolAsset.id]),'deleted');
 checks.push('exact publication pins protect copies, unrelated draft pins do not retain failed public copies, deleting assets reject new references');

 // The personal fixture has one expired pending replacement (16MiB). Another
 // full reservation would exceed24MiB; no new row may survive the denial.
 await denied(reserveSql,[owner,null,'profile',randomUUID(),hash('quota'),hash('source'),3,null],'P0003');
 const schoolPendingA=await reserve(owner,'cover',school,null),schoolPendingB=await reserve(owner,'gallery',school,null);
 await denied(reserveSql,[owner,school,'gallery',randomUUID(),hash('pending'),hash('source'),null,null],'P0003');
 await client.query('SELECT fail_media_upload($1,$2)',[owner,schoolPendingA.id]);
 await client.query('SELECT fail_media_upload($1,$2)',[owner,schoolPendingB.id]);
 await client.query('UPDATE media_asset_cleanup SET not_before=now() WHERE asset_id=ANY($1::uuid[])',[[schoolPendingA.id,schoolPendingB.id]]);
 await scalar('SELECT claim_media_cleanup(20)');
 assert.equal(await scalar('SELECT state FROM media_assets WHERE id=$1',[schoolPendingA.id]),'deleted');
 checks.push('owner-byte and pending limits are transactional; empty failed reservations release after exact cleanup');
 return checks;
}
