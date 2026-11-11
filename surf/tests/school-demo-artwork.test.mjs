import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {schoolArtworkChoice,schoolDefaultArtwork,retainedDemoSchoolId} from '../lib/school-artwork.mjs';
import {demoArtworkMessages} from '../lib/locale/demo-artwork-messages.mjs';
import {assertRetainedDemoOperator,publishRetainedDemoArtwork} from '../scripts/demo-artwork-publication-support.mjs';

test('Demo static version requires both the pinned registry key and exact retained school ID',()=>{
 for(const kind of['logo','cover']){
  const demo=schoolArtworkChoice(kind,{version:'demo-v1',schoolId:retainedDemoSchoolId});
  assert.equal(demo.artworkVersion,'demo-v1');assert.equal(demo.src,schoolDefaultArtwork['demo-v1'][kind].src);
  assert.equal(schoolArtworkChoice(kind,{version:'v1',schoolId:retainedDemoSchoolId}).src,schoolDefaultArtwork.v1[kind].src,'Historical neutral snapshots stay neutral');
  for(const schoolId of[undefined,null,'12345678-1234-4123-8123-123456789012','Demo Surf School'])
   assert.equal(schoolArtworkChoice(kind,{version:'demo-v1',schoolId}).src,schoolDefaultArtwork.v1[kind].src);
  for(const version of['__proto__','constructor','toString','unknown',{},null])
   assert.equal(schoolArtworkChoice(kind,{version,schoolId:retainedDemoSchoolId}).src,schoolDefaultArtwork.v1[kind].src);
 }
 assert.equal(schoolArtworkChoice('cover',{version:'v1',customUrl:schoolDefaultArtwork['demo-v1'].cover.src,hasCustom:true}).src,schoolDefaultArtwork.v1.cover.src,'Static URLs are not accepted as custom media URLs');
});

test('dedicated Demo files are bounded, version-frozen, metadata-free WebP at stable square/5:2 aspect',async()=>{
 const expected={
  'demo-cover-v1-640.webp':[640,256,'70524ff69c286f8ee4cbefed1217293e7c5d646f13871cbe15d2eaf083251cc1'],
  'demo-cover-v1-1280.webp':[1280,512,'9c9272610e1df7f605297b8a6434274f4efa17cd2faf6c05433304579c59c72a'],
  'demo-cover-v1-1920.webp':[1920,768,'bec0e3903c044c142c4f78e90ac6d0c67fd7152e751d05f347d3cdca51463739'],
  'demo-logo-v1-256.webp':[256,256,'073edf2a48ad3c05a875069815b024fc0a05c9c6e84ad37398e5ab58b4b13611'],
  'demo-logo-v1-512.webp':[512,512,'73f24e9c89b74d78bc79531c1c2fc10a845d2e97256a6f33c0e87f7dea55fcf4'],
 };
 let total=0;for(const[file,[width,height,checksum]]of Object.entries(expected)){
  const bytes=await fs.readFile(new URL('../public/images/schools/'+file,import.meta.url));total+=bytes.length;
  assert.equal(createHash('sha256').update(bytes).digest('hex'),checksum);
  const metadata=await sharp(bytes).metadata();assert.equal(metadata.format,'webp');assert.equal(metadata.width,width);assert.equal(metadata.height,height);
  for(const key of['exif','xmp','iptc','icc','orientation'])assert.equal(metadata[key],undefined);
  assert.equal(width/height,file.includes('cover')?2.5:1);
 }
 assert(total<300000);assert.match(schoolDefaultArtwork['demo-v1'].cover.srcSet,/640w.*1280w.*1920w/);
});

test('all four Demo captions explicitly identify fictional artwork and keep translated unavailable/alt text',()=>{
 assert.deepEqual(Object.keys(demoArtworkMessages),['en-GB','pt-PT','es','fr']);
 const terms={'en-GB':/fictional/,'pt-PT':/fictícia/,es:/ficticia/,fr:/fictive/};
 for(const[locale,messages]of Object.entries(demoArtworkMessages)){
  assert.equal(Object.keys(messages).length,3);assert.match(messages['demoArtwork.caption'],terms[locale]);
  assert(messages['demoArtwork.coverAlt'].length>20);assert(messages['demoArtwork.imageUnavailable'].length>10);
 }
});

test('controlled publication requires an explicitly reviewed retained real operator and rejects every QA/demo identity',()=>{
 const id='12345678-1234-4123-8123-123456789012';
 const user={id,name:'Retained operator',email:'operator@retained.invalid',is_demo:false,active:true,verified:true,platform:true};
 const options={operatorId:id,expectedOperatorEmail:user.email,qaUserIds:[]};
 assert.doesNotThrow(()=>assertRetainedDemoOperator(user,options));
 for(const change of[{is_demo:true},{active:false},{verified:false},{platform:false},{name:'B5 QA temporary'},
  {email:'temporary@example.invalid'},{email:'ppaplin+b5-owner@gmail.com'},{email:'ppaplin+b5-recipient@gmail.com'}])
  assert.throws(()=>assertRetainedDemoOperator({...user,...change},{...options,expectedOperatorEmail:change.email||user.email}));
 assert.throws(()=>assertRetainedDemoOperator(user,{...options,qaUserIds:[id]}));
 assert.throws(()=>assertRetainedDemoOperator(user,{...options,operatorId:retainedDemoSchoolId}));
 assert.throws(()=>assertRetainedDemoOperator(user,{...options,expectedOperatorEmail:'another@retained.invalid'}));
});

test('controlled seed is idempotent for current demo-v1 and never silently resets custom or hidden/newer Demo artwork',async()=>{
 const operatorId='12345678-1234-4123-8123-123456789012';
 const operator={id:operatorId,name:'Retained operator',email:'operator@retained.invalid',active:true,verified:true,platform:true,is_demo:false};
 const details={accent:'sea',logoAssetId:null,logoAlt:'',coverAssetId:null,coverAlt:'',gallery:[]};
 const preview={schoolId:retainedDemoSchoolId,demo:true,defaultArtworkVersion:'demo-v1',branding:details,contactEmail:'',contactPhone:'',website:'',socialLinks:[],baseLocation:null};
 const base={id:retainedDemoSchoolId,details,preview,current_snapshot:preview,listing_status:'published',published_branding_version_id:'22345678-1234-4123-8123-123456789012',
  contact_email:null,contact_phone:'',website:'',social_links:[],base_location:{hasFixedBase:false,publicVisible:false,address:'',latitude:null,longitude:null},draft_revision:1,settings_revision:1};
 const options={environment:'rehearsal',operatorId,expectedOperatorEmail:operator.email,qaUserIds:[],requestId:'32345678-1234-4123-8123-123456789012',rehearse:true};
 function client(row){return{async query(sql){
  assert.match(sql,/^\s*SELECT\b/,'A noop or rejected seed must perform no writes');
  if(sql.includes('begin_school_publication')||sql.includes('finish_school_publication'))assert.fail('Unexpected publication');
  if(sql.includes('SELECT environment FROM job_environment'))return{rows:[{environment:'staging'}]};
  if(sql.includes('AS active,account_is_platform'))return{rows:[operator]};
  if(sql.includes('AS current_snapshot'))return{rows:[row]};
  if(sql.includes('AS school_digest'))return{rows:[{id:retainedDemoSchoolId,owner_membership_id:null,membership_count:0,student_count:2,media_asset_count:0,media_object_count:0}]};
  return{rows:[]};
 }};}
 const noop=await publishRetainedDemoArtwork(client(base),options);assert.equal(noop.replayed,true);assert.equal(noop.publicationId,base.published_branding_version_id);
 for(const change of[{listing_status:'unlisted'},
  {current_snapshot:null,details:{...details,coverAssetId:operatorId}},
  {current_snapshot:{...preview,defaultArtworkVersion:'demo-v2'}},
  {current_snapshot:{...preview,contactEmail:'real-contact@retained.invalid'}},
  {current_snapshot:null,contact_phone:'+351999999999'}])
  await assert.rejects(publishRetainedDemoArtwork(client({...base,...change}),options));
 await assert.rejects(publishRetainedDemoArtwork(client({...base,current_snapshot:null}),{...options,rehearse:false}),/exact reviewed preview hash/);
});
