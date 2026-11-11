import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { createMediaStorage,mediaObjectUrl } from '../lib/media-storage.mjs';
import { mediaHandlers,mediaUploadOptions,readMediaUpload } from '../lib/media-server.mjs';

const actor='11111111-1111-4111-8111-111111111111',asset='22222222-2222-4222-8222-222222222222',objectId='33333333-3333-4333-8333-333333333333';
const cfg={environment:'staging',actual_environment:'staging',private_store_id:'store_Private',public_store_id:'store_Public'};
const env={APP_ENVIRONMENT:'staging',MEDIA_PRIVATE_STORE_ID:'store_Private',MEDIA_PUBLIC_STORE_ID:'store_Public',VERCEL_OIDC_TOKEN:'test-oidc'};
const bytes=Buffer.from('sanitised test pixels');
const checksum=createHash('sha256').update(bytes).digest('hex');
const variant={role:'w128',bytes,byteCount:bytes.length,checksum,width:128,height:128};
const object={id:objectId,asset_id:asset,access:'private',publication_id:null,role:'w128',store_id:'store_Private',
 pathname:`staging/private/${asset}/${objectId}.webp`,byte_count:bytes.length,checksum,width:128,height:128,state:'planned'};
test('runtime cleanup reconciles expired publication intents and version pins before bounded object claims',async()=>{
 const calls=[];
 const sql=async(parts,...values)=>{const query=parts.join('?');
  if(query.includes('media_storage_config'))return[cfg];
  if(query.includes('school_branding_maintenance')){calls.push('publication-maintenance');assert.equal(values[0],3);return[{data:{expiredIntents:1,prunedVersions:1}}];}
  if(query.includes('claim_media_cleanup')){calls.push('object-claim');assert.equal(values[0],3);return[{objects:[]}];}
  assert.fail('Unexpected maintenance query');
 };
 const result=await createMediaStorage({sql,env,blob:{}}).cleanup(10);
 assert.deepEqual(calls,['publication-maintenance','object-claim']);assert.deepEqual(result,{deleted:0,failed:0,expiredIntents:1,prunedVersions:1});
});
function reply(){return{headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;},end(v){this.bytes=v;return this;}};}
function imageRequest(data=bytes){const req=Readable.from([data]);req.method='POST';req.headers={'content-type':'image/png','x-media-options':JSON.stringify({requestId:actor,purpose:'profile',revision:1})};return req;}

test('upload options and raw stream reject forged scopes, invalid crop, unsupported media and oversized bodies',async()=>{
 assert.equal(mediaUploadOptions(JSON.stringify({requestId:actor,purpose:'profile',revision:1})).crop.zoom,1);
 for(const change of [{schoolId:asset},{revision:0},{purpose:'private-original'},{crop:{x:101,y:50,zoom:1}},{ownerId:asset},{requestId:'not-uuid'}])
  assert.throws(()=>mediaUploadOptions(JSON.stringify({requestId:actor,purpose:'profile',revision:1,...change})));
 const png=imageRequest();assert.equal((await readMediaUpload(png)).bytes.length,bytes.length);
 const bad=imageRequest();bad.headers['content-type']='image/svg+xml';await assert.rejects(readMediaUpload(bad),e=>e.status===400);
 const large=imageRequest(Buffer.alloc(3*1024*1024+1));await assert.rejects(readMediaUpload(large),e=>e.status===413);
});

test('journal precedes immutable private write; verified bytes are required before written state',async()=>{
 const events=[];let stored;
 const sql=async(parts,...values)=>{
  const query=parts.join('?');
  if(query.includes('media_storage_config'))return[cfg];
  if(query.includes('journal_media_objects')){events.push('journal');assert.equal(values[3],'private');return[{objects:[{...object}]}];}
  if(query.includes('UPDATE media_objects')){events.push('mark-written');return[{id:objectId}];}throw new Error('Unexpected SQL');
 };
 const blob={async put(path,data,options){events.push('put');assert.equal(options.storeId,'store_Private');assert.equal(options.oidcToken,undefined);assert.equal(options.access,'private');assert.equal(options.allowOverwrite,false);stored=Buffer.from(data);},
  async get(){events.push('verify');return{statusCode:200,blob:{contentType:'image/webp',size:stored.length},stream:new Response(stored).body};}};
 const storage=createMediaStorage({sql,env,blob});
 const objects=await storage.writeJournaledObjects(actor,asset,[variant]);
 assert.deepEqual(events,['journal','put','verify','mark-written']);assert.equal(objects[0].state,'written');assert.equal(objects[0].url,undefined);
 await assert.rejects(storage.writeJournaledObjects(actor,asset,[{...variant,checksum:'a'.repeat(64)}]));
});

test('store configuration and exact object paths fail closed; remote diagnostics remain private',async()=>{
 let remote=0;const sql=async()=>[cfg];const blob={async get(){remote++;throw new Error('UPSTREAM TOKEN secret');}};
 for(const change of [{APP_ENVIRONMENT:'production'},{MEDIA_PRIVATE_STORE_ID:'store_Other'},{VERCEL_OIDC_TOKEN:''},{VERCEL_PROJECT_ID:'wrong'},{BLOB_READ_WRITE_TOKEN:'static-fallback'}])
  await assert.rejects(createMediaStorage({sql,env:{...env,...change},blob}).readPrivateObject({...object,state:'written'}),e=>e.message==='media.unavailable');
 assert.equal(remote,0);
 const storage=createMediaStorage({sql,env,blob});
 await assert.rejects(storage.readPrivateObject({...object,state:'written',pathname:'https://evil.invalid/'}),e=>e.message==='media.unavailable');
 assert.equal(remote,0);
 await assert.rejects(storage.readPrivateObject({...object,state:'written'}),e=>e.message==='media.unavailable'&&!e.message.includes('secret'));
 assert.equal(remote,1);
 assert.throws(()=>mediaObjectUrl(object));
 assert.equal(mediaObjectUrl({...object,state:'written',access:'public',store_id:'store_Public',pathname:`staging/public/${asset}/${objectId}.webp`}),`https://public.public.blob.vercel-storage.com/staging/public/${asset}/${objectId}.webp`);
});

test('recrop reads only an authorised stored master and uses trusted processing with a fresh revision-bound asset',async()=>{
 const nextAsset='44444444-4444-4444-8444-444444444444';let foreign=false,reads=0,trusted=0,written=0;
 const master=Buffer.alloc(3*1024*1024+1,1);
 const sql=async(parts,...values)=>{const q=parts.join('?');
  if(q.includes('to_jsonb(a)'))return foreign?[]:[{asset:{id:asset,purpose:'profile',owner_user_id:actor,owner_school_id:null},object:{...object,role:'master',state:'written'}}];
  if(q.includes('reserve_media_upload')){assert.equal(values[0],actor);assert.equal(values[1],null);assert.equal(values[6],2);assert.equal(values[7],asset);return[{asset:{id:nextAsset,state:'pending'}}];}
  if(q.includes('finish_media_asset'))return[{data:{assetId:nextAsset,photo:{mode:'uploaded',revision:3}}}];
  throw new Error('Unexpected SQL');
 };
 const storage={async readPrivateObject(source){reads++;assert.equal(source.role,'master');return master;},async writeJournaledObjects(_,id){written++;assert.equal(id,nextAsset);}};
 const handlers=mediaHandlers({sql,requireAuth:async()=>({userId:actor}),storage,processor:async()=>{throw new Error('External upload limit must not be used for stored master');},
  trustedProcessor:async(data,options)=>{trusted++;assert.equal(data.length,master.length);assert.equal(options.purpose,'profile');return{variants:[variant],sourceWidth:200,sourceHeight:200};}});
 const req={method:'POST',body:{assetId:asset,requestId:actor,revision:2,crop:{zoom:2,x:40,y:60}}};
 let res=reply();await handlers.recrop(req,res);assert.equal(res.statusCode,201);assert.equal(res.body.data.assetId,nextAsset);assert.equal(trusted,1);assert.equal(written,1);
 foreign=true;res=reply();await handlers.recrop(req,res);assert.equal(res.statusCode,404);assert.equal(reads,1);
 res=reply();await handlers.recrop({...req,body:{...req.body,ownerId:actor}},res);assert.equal(res.statusCode,400);assert.equal(reads,1);
});

test('upload failures schedule exact compensation and never expose storage errors or alter prior profile',async()=>{
 const calls=[];let profileChanged=false;
 const sql=async(parts)=>{const q=parts.join('?');if(q.includes('EXISTS(SELECT 1 FROM users'))return[{allowed:true}];
  if(q.includes('reserve_media_upload'))return[{asset:{id:asset,state:'pending'}}];
  if(q.includes('finish_media_asset')){profileChanged=true;return[];}
  if(q.includes('fail_media_upload')){calls.push('compensate');return[];}throw new Error('Unexpected SQL');};
 const storage={async config(){},async writeJournaledObjects(){throw new Error('SECRET provider URL');},async cleanup(){calls.push('cleanup');}};
 const handlers=mediaHandlers({sql,requireAuth:async()=>({userId:actor}),storage,processor:async()=>({variants:[variant],sourceWidth:200,sourceHeight:200})});
 const res=reply();await handlers.upload(imageRequest(),res);
 assert.equal(res.statusCode,503);assert.deepEqual(calls,['compensate','cleanup']);assert.equal(profileChanged,false);
 assert.deepEqual(res.body,{ok:false,error:'media.unavailable'});assert.equal(res.headers['Cache-Control'],'private, no-store');
});

test('private images authenticate every request, reject foreign assets and return private bytes without redirects',async()=>{
 let session=null,reads=0;
 const sql=async(parts,...values)=>{assert(parts.join('?').includes('account_reads_school_settings'));assert.equal(values.at(-1),actor);return session?.foreign?[]:[{...object,state:'written'}];};
 const storage={async readPrivateObject(){reads++;return bytes;}};
 const requireAuth=async(_,res)=>{if(!session){res.status(401).json({ok:false});return null;}return session;};
 const handlers=mediaHandlers({sql,requireAuth,storage});
 const req={method:'GET',query:{id:asset,variant:'w128'}};
 let res=reply();await handlers.image(req,res);assert.equal(res.statusCode,401);assert.equal(reads,0);
 session={userId:actor};res=reply();await handlers.image(req,res);assert.equal(res.statusCode,200);assert.equal(reads,1);assert.deepEqual(res.bytes,bytes);
 assert.equal(res.headers['Cache-Control'],'private, no-store');assert.equal(res.headers.Location,undefined);
 session={userId:actor,foreign:true};res=reply();await handlers.image(req,res);assert.equal(res.statusCode,404);assert.equal(reads,1);
 session=null;res=reply();await handlers.image(req,res);assert.equal(res.statusCode,401);assert.equal(reads,1);
});
