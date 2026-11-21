import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { mediaHandlers } from '../lib/media-server.mjs';
import { processSanitisedMaster } from '../lib/image-media.mjs';
import { maxCropZoom } from '../lib/media-crop-controls.mjs';

// Actual encoded processing and API handler flow, with real SQL transactions
// and an in-memory object transport. No Blob objects or provider calls.
export async function verifyMediaSafety(client) {
 const checks=[];const prefix=`b7-safe-${randomUUID()}`;
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const scalar=async(q,p=[])=>Object.values((await client.query(q,p)).rows[0])[0];
 const owner=await scalar("INSERT INTO users(name,email,role,email_verified_at) VALUES($1,$2,'student',now()) RETURNING id",[prefix,prefix+'@example.invalid']);
 const details={name:prefix,description:'',timezone:'Europe/Lisbon',contactEmail:'',contactPhone:'',website:'',socialLinks:[],operatingSpotIds:[]};
 const school=(await scalar('SELECT create_draft_school($1,$2,$3::jsonb)',[owner,randomUUID(),details])).data.id;
 const sql=async(parts,...values)=>{
  let query=parts[0];for(let n=0;n<values.length;n++)query+=`$${n+1}`+parts[n+1];
  return(await client.query(query,values)).rows;
 };
 const bytesByObject=new Map();
 const storage={
  async config(){},
  async writeJournaledObjects(actor,asset,variants){
   const manifest=variants.map(({role,byteCount,checksum,width,height})=>({role,byteCount,checksum,width,height}));
   const objects=await scalar("SELECT journal_media_objects($1,$2,$3::jsonb,'private',NULL)",[actor,asset,JSON.stringify(manifest)]);
   for(const object of objects){const variant=variants.find(v=>v.role===object.role);assert.equal(hash(variant.bytes),object.checksum);bytesByObject.set(object.id,variant.bytes);}
   await client.query("UPDATE media_objects SET state='written',written_at=now() WHERE asset_id=$1",[asset]);return objects;
  },
  async readPrivateObject(object){const bytes=bytesByObject.get(object.id);assert(bytes);assert.equal(hash(bytes),object.checksum);return bytes;},
  async cleanup(){return{deleted:0,failed:0};},
 };
 const handlers=mediaHandlers({sql,requireAuth:async()=>({userId:owner}),storage,trustedProcessor:processSanitisedMaster});
 const response=()=>({headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
 for(const[width,height]of[[8192,64],[64,8192]]) {
  const source=await sharp({create:{width,height,channels:3,background:'#096b75'}}).png().toBuffer();
  for(const purpose of['profile','logo','cover','gallery']) {
   const photo=purpose==='profile'?await scalar('SELECT media_profile_json($1)',[owner]):null;
   const req=Readable.from([source]);req.method='POST';req.headers={'content-type':'image/png','x-media-options':JSON.stringify({requestId:randomUUID(),purpose,
    ...(photo?{revision:photo.revision,...(photo.assetId?{replaceAssetId:photo.assetId}:{})}:{schoolId:school})})};
   const uploaded=response();await handlers.upload(req,uploaded);
   assert.equal(uploaded.statusCode,201,JSON.stringify(uploaded.body));assert.equal(uploaded.body.ok,true);
   const assetId=uploaded.body.data.assetId;
   const master=(await client.query("SELECT * FROM media_objects WHERE asset_id=$1 AND role='master' AND access='private'",[assetId])).rows[0];
   assert(master.width>=64&&master.height>=64);assert(Math.max(master.width,master.height)<=8192);
   assert.equal(await scalar('SELECT state FROM media_assets WHERE id=$1',[assetId]),'ready');
   const zoom=maxCropZoom(master.width,master.height,purpose);
   const recropped=response();await handlers.recrop({method:'POST',body:{assetId,requestId:randomUUID(),crop:{zoom,x:0,y:100},
    ...(photo?{revision:uploaded.body.data.photo.revision}:{})}},recropped);
   assert.equal(recropped.statusCode,201,JSON.stringify(recropped.body));assert.equal(recropped.body.ok,true);
   const nextAsset=recropped.body.data.assetId;assert.notEqual(nextAsset,assetId);
   assert.equal(await scalar('SELECT state FROM media_assets WHERE id=$1',[nextAsset]),'ready');
   const output=(await client.query('SELECT source_width,source_height FROM media_assets WHERE id=$1',[nextAsset])).rows[0];
   assert(output.source_width>=64&&output.source_height>=64);
   assert.equal(await scalar("SELECT count(*)::int FROM media_objects WHERE asset_id=$1 AND role<>'master' AND (width>2560 OR height>2560)",[nextAsset]),0);
   if(photo){assert.equal(recropped.body.data.photo.mode,'uploaded');assert.equal(recropped.body.data.photo.assetId,nextAsset);}
  }
 }
 checks.push('real wide/tall upload API → encoded master → SQL journal/finalise → owned recrop API at maximum valid zoom → SQL finalise, all four purposes');

 const photo=await scalar('SELECT media_profile_json($1)',[owner]);
 const asset=await scalar('SELECT reserve_media_upload($1,NULL,$2,$3,$4,$4,$5,$6)',[owner,'profile',randomUUID(),hash('invalid-derivative'),photo.revision,photo.assetId]);
 const manifest=['master','w128','w384'].map(role=>({role,byteCount:100,checksum:hash(role),width:role==='w384'?2561:128,height:128}));
 await client.query('SAVEPOINT derivative_limit');
 try{await client.query("SELECT journal_media_objects($1,$2,$3::jsonb,'private',NULL)",[owner,asset.id,JSON.stringify(manifest)]);assert.fail('Oversized derivative accepted');}
 catch(error){assert.equal(error.code,'22023',error.message);}
 finally{await client.query('ROLLBACK TO SAVEPOINT derivative_limit');}
 checks.push('master-only expansion keeps non-master journal dimension limits unchanged');
 return checks;
}
