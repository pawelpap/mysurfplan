import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createMediaStorage} from '../lib/media-storage.mjs';
import {preflightTaskMediaCleanup,stageTaskMediaCleanup,drainTaskMediaCleanup,finaliseTaskMediaCleanup} from '../lib/task-media-cleanup.mjs';

export async function verifyTaskMediaCleanup(client){
 const prefix=`B5 QA media-cleanup-${randomUUID()}`,checks=[];
 const hash=value=>createHash('sha256').update(value).digest('hex');
 const scalar=async(q,p=[])=>Object.values((await client.query(q,p)).rows[0])[0];
 const sql=async(parts,...values)=>{let q=parts[0];for(let i=0;i<values.length;i++)q+=`$${i+1}`+parts[i+1];return(await client.query(q,values)).rows;};
 const owner=await scalar("INSERT INTO users(name,email,role,email_verified_at) VALUES($1,$2,'student',now()) RETURNING id",[prefix,`b5-${prefix.slice(-8)}-owner@example.invalid`]);
 const real=await scalar("INSERT INTO users(name,email,role,email_verified_at) VALUES($1,$2,'student',now()) RETURNING id",['Preserved fixture operator',`preserved-${randomUUID()}@example.invalid`]);
 const school=await scalar("INSERT INTO schools(name) VALUES($1) RETURNING id",[prefix+' school']);
 const retainedSchool=await scalar("INSERT INTO schools(name) VALUES($1) RETURNING id",['Retained school '+randomUUID()]);
 const cfg=(await client.query('SELECT * FROM media_storage_config WHERE singleton')).rows[0];
 const data=new Map();
 async function asset(person,schoolId,uploader,purpose,state='ready'){
  const id=await scalar(`INSERT INTO media_assets(owner_user_id,owner_school_id,uploaded_by,environment,purpose,state,request_id,fingerprint,source_hash,reserved_bytes,byte_count)
   VALUES($1,$2,$3,'staging',$4,$5,$6,$7,$7,0,300) RETURNING id`,[person,schoolId,uploader,purpose,state,randomUUID(),hash(randomUUID())]);
  await client.query("INSERT INTO media_asset_cleanup VALUES($1,now()+interval '24 hours','unreferenced_asset')",[id]);return id;
 }
 async function object(assetId,role,access='private',publication=null,state='written'){
  const id=randomUUID(),pathname=`staging/${access}/${assetId}/${id}.webp`,bytes=Buffer.from(id);
  await client.query(`INSERT INTO media_objects(id,asset_id,access,publication_id,role,store_id,pathname,byte_count,checksum,width,height,state)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,128,128,$10)`,[id,assetId,access,publication,role,access==='private'?cfg.private_store_id:cfg.public_store_id,pathname,bytes.length,hash(bytes),state]);
  data.set(pathname,bytes);return id;
 }
 const current=await asset(owner,null,owner,'profile'),replaced=await asset(owner,null,owner,'profile'),orphan=await asset(owner,null,owner,'profile','pending');
 for(const id of[current,replaced,orphan])for(const role of['master','w128','w384'])await object(id,role,'private',null,id===orphan?'planned':'written');
 await client.query("UPDATE users SET photo_mode='uploaded',photo_asset_id=$1 WHERE id=$2",[current,owner]);
 await client.query("INSERT INTO media_asset_references VALUES($1,'user',$2,'profile',$2,now())",[current,owner]);
 const cover=await asset(null,school,owner,'cover');for(const role of['master','w800','w1600'])await object(cover,role);
 const version=randomUUID();await client.query(`INSERT INTO school_branding_versions(id,school_id,version_number,source_revision,source_settings_revision,snapshot,published_by)
  VALUES($1,$2,1,1,1,'{}',$3)`,[version,school,owner]);
 await client.query("UPDATE schools SET published_branding_version_id=$1,listing_status='published' WHERE id=$2",[version,school]);
 const draft=await scalar('SELECT id FROM school_branding_drafts WHERE school_id=$1',[school]);
 await client.query("INSERT INTO media_asset_references VALUES($1,'school',$2,'school_draft',$3,now()),($1,'school',$2,'school_publication',$4,now())",[cover,school,draft,version]);
 for(const role of['w800','w1600'])await object(cover,role,'public',version);
 const pin=randomUUID();await client.query('INSERT INTO school_branding_version_pins VALUES($1,$2,NULL)',[version,pin]);
 const retained=await asset(null,retainedSchool,real,'logo');await object(retained,'master');
 const retainedDraft=await scalar('SELECT id FROM school_branding_drafts WHERE school_id=$1',[retainedSchool]);
 await client.query("INSERT INTO media_asset_references VALUES($1,'school',$2,'school_draft',$3,now())",[retained,retainedSchool,retainedDraft]);
 const protectedSnapshot=async()=>({
  user:(await client.query('SELECT to_jsonb(u) AS row FROM users u WHERE id=$1',[real])).rows[0].row,
  school:(await client.query('SELECT to_jsonb(s) AS row FROM schools s WHERE id=$1',[retainedSchool])).rows[0].row,
  asset:(await client.query('SELECT to_jsonb(a) AS row FROM media_assets a WHERE id=$1',[retained])).rows[0].row,
  refs:(await client.query('SELECT * FROM media_asset_references WHERE asset_id=$1',[retained])).rows,
 });
 const protectedBefore=await protectedSnapshot();
 const scope={environment:'rehearsal',prefix,userIds:[owner],schoolIds:[school]};
 await assert.rejects(preflightTaskMediaCleanup(client,scope),e=>e.code==='unrecorded_version_pin');
 scope.allowedVersionPins=[{versionId:version,referenceId:pin}];
 await client.query('SAVEPOINT retained_upload');
 await asset(null,retainedSchool,owner,'logo');
 await assert.rejects(preflightTaskMediaCleanup(client,scope),e=>e.code==='task_uploader_has_retained_asset');
 assert.equal(await scalar('SELECT disabled_at IS NULL FROM users WHERE id=$1',[owner]),true);
 await client.query('ROLLBACK TO SAVEPOINT retained_upload');
 checks.push('preflight hard-scopes users/schools, requires explicit task version pins and refuses retained-school uploader assets without mutation');

 const plan=await preflightTaskMediaCleanup(client,scope);assert.equal(plan.assets.length,4);assert.equal(plan.objects.length,14);
 const staged=await stageTaskMediaCleanup(client,plan);assert.equal(staged.requiresRuntimeVerification,true);
 assert.equal(await scalar('SELECT disabled_at IS NOT NULL FROM users WHERE id=$1',[owner]),true);
 assert.equal(await scalar('SELECT published_branding_version_id IS NULL FROM schools WHERE id=$1',[school]),true);
 assert.equal((await stageTaskMediaCleanup(client,plan)).alreadyStaged,true);
 assert.deepEqual(await protectedSnapshot(),protectedBefore);
 checks.push('exact preflight inventory is frozen/queued idempotently; retained operator and foreign school/assets remain unchanged');

 // Simulate only elapsed settling/backoff time on these exact synthetic IDs.
 await client.query('UPDATE media_asset_cleanup SET not_before=now() WHERE asset_id=ANY($1::uuid[])',[plan.assets.map(a=>a.id)]);
 await client.query('UPDATE media_cleanup_queue SET not_before=now() WHERE object_id=ANY($1::uuid[])',[plan.objects.map(o=>o.id)]);
 const paths=new Set(plan.objects.map(o=>o.pathname));let failOnce=true;const originChecks=[];
 const env={APP_ENVIRONMENT:'staging',MEDIA_PRIVATE_STORE_ID:cfg.private_store_id,MEDIA_PUBLIC_STORE_ID:cfg.public_store_id,VERCEL_OIDC_TOKEN:'isolated-mock-only'};
 const storage=createMediaStorage({sql,env,blob:{
  async del(path){assert(paths.has(path),'Foreign storage path reached cleanup');if(failOnce){failOnce=false;throw new Error('Synthetic provider failure');}data.delete(path);},
  async get(path,options){assert(paths.has(path));assert.equal(options.useCache,false);originChecks.push(path);return data.has(path)?{stream:new Response(data.get(path)).body}:null;},
 }});
 const transport=async()=>storage.cleanup(3);
 const partial=await drainTaskMediaCleanup(client,plan,{maintenanceTransport:transport});
 assert.equal(partial.complete,false);assert(partial.verifiedObjects.length>0);assert(partial.nextAttemptAt);
 await assert.rejects(finaliseTaskMediaCleanup(client,plan,partial),e=>e.code==='storage_cleanup_not_verified');
 assert.equal(await scalar('SELECT count(*)::int FROM media_objects WHERE asset_id=ANY($1::uuid[])',[plan.assets.map(a=>a.id)]),14);
 checks.push('provider failure keeps cleanup incomplete and all metadata available; aggregate maintenance counts do not substitute for per-object origin verification');
 await client.query('UPDATE media_cleanup_queue SET not_before=now() WHERE object_id=ANY($1::uuid[])',[plan.objects.map(o=>o.id)]);
 const receipt=await drainTaskMediaCleanup(client,plan,{maintenanceTransport:transport});
 assert.equal(receipt.complete,true);assert.equal(receipt.verifiedObjects.length,14);
 assert(plan.objects.every(object=>originChecks.includes(object.pathname)));
 assert(plan.objects.every(object=>!data.has(object.pathname)));
 const final=await finaliseTaskMediaCleanup(client,plan,receipt);assert.equal(final.deletedMetadata.objects,14);
 assert.equal((await finaliseTaskMediaCleanup(client,plan,receipt)).alreadyFinalised,true);
 assert.equal(await scalar('SELECT count(*)::int FROM media_assets WHERE uploaded_by=$1',[owner]),0);
 assert.equal(await scalar('SELECT count(*)::int FROM users WHERE id=$1',[owner]),1,'Full account cleanup is separate');
 assert.deepEqual(await protectedSnapshot(),protectedBefore);
 checks.push('all current/replaced/abandoned private and published task objects are verified absent before exact metadata deletion; retry is idempotent and foreign data survives');
 return checks;
}
