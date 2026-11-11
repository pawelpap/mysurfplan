import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {retainedDemoSchoolId} from '../lib/school-artwork.mjs';
import {protectedDemoArtworkState,assertRetainedDemoOperator} from './demo-artwork-publication-support.mjs';

export async function verifySchoolDemoArtwork(client){
 const scalar=async(q,p=[])=>Object.values((await client.query(q,p)).rows[0])[0];
 const checks=[],prefix='b5-demo-art-'+randomUUID();
 const empty={accent:'sea',logoAssetId:null,logoAlt:'',coverAssetId:null,coverAlt:'',gallery:[]};
 const before=await protectedDemoArtworkState(client);
 const oldVersions=(await client.query('SELECT id,md5(to_jsonb(v)::text) AS digest FROM school_branding_versions v WHERE school_id=$1 ORDER BY id',[retainedDemoSchoolId])).rows;
 const mediaBefore=(await client.query('SELECT (SELECT count(*) FROM media_assets)::int AS assets,(SELECT count(*) FROM media_objects)::int AS objects')).rows[0];
 const demoPreview=await scalar('SELECT school_public_snapshot($1,$2::jsonb)',[retainedDemoSchoolId,empty]);
 assert.equal(demoPreview.schoolId,retainedDemoSchoolId);assert.equal(demoPreview.defaultArtworkVersion,'demo-v1');assert.equal(demoPreview.demo,true);
 const owner=await scalar("INSERT INTO users(name,email,role,email_verified_at) VALUES($1,$2,'student',now()) RETURNING id",[prefix+' owner',prefix+'@example.invalid']);
 const school=(await scalar('SELECT create_draft_school($1,$2,$3::jsonb)',[owner,randomUUID(),{name:'Demo Surf School imitation '+prefix,description:'',timezone:'Europe/Lisbon',contactEmail:'',contactPhone:'',website:'',socialLinks:[],operatingSpotIds:[]}])).data.id;
 const normal=await scalar('SELECT school_public_snapshot($1,$2::jsonb)',[school,{...empty,defaultArtworkVersion:'demo-v1',demo:true}]);
 assert.equal(normal.defaultArtworkVersion,'v1');assert.equal(normal.demo,false);
 async function denied(q,p,code){await client.query('SAVEPOINT demo_art_denial');try{await client.query(q,p);assert.fail('Expected rejection');}
  catch(error){assert.equal(error.code,code,error.message);}finally{await client.query('ROLLBACK TO SAVEPOINT demo_art_denial');}}
 await denied('SELECT save_school_branding($1,$2,1,1,$3::jsonb)',[owner,school,{...empty,defaultArtworkVersion:'demo-v1'}],'22023');
 await denied('SELECT save_school_branding($1,$2,1,1,$3::jsonb)',[owner,school,{...empty,demo:true}],'22023');
 await denied('SELECT begin_school_publication($1,$2,1,1,$3)',[owner,retainedDemoSchoolId,randomUUID()],'42501');
 checks.push('exact Demo ID selects dedicated static version; imitation/injected fields remain neutral or are rejected; no inferred authority');

 // Synthetic platform authority exists only in this rolled-back verifier.
 // The controlled live operations helper rejects this QA email identity.
 const platform=await scalar("INSERT INTO users(name,email,role,email_verified_at) VALUES($1,$2,'student',now()) RETURNING id",[prefix+' platform',prefix+'-platform@example.invalid']);
 await client.query('INSERT INTO platform_role_assignments(user_id) VALUES($1)',[platform]);
 assert.throws(()=>assertRetainedDemoOperator({id:platform,name:prefix+' platform',email:prefix+'-platform@example.invalid',active:true,verified:true,platform:true},
  {operatorId:platform,expectedOperatorEmail:prefix+'-platform@example.invalid',qaUserIds:[]}),/retained real platform/);
 const source=(await client.query('SELECT s.settings_revision,d.revision,d.details FROM schools s JOIN school_branding_drafts d ON d.school_id=s.id WHERE s.id=$1',[retainedDemoSchoolId])).rows[0];
 assert.deepEqual(source.details,empty,'Do not overwrite custom Demo branding even in the test');
 const intent=await scalar('SELECT begin_school_publication($1,$2,$3,$4,$5)',[platform,retainedDemoSchoolId,source.revision,source.settings_revision,randomUUID()]);
 await scalar('SELECT finish_school_publication($1,$2)',[platform,intent.id]);
 const version=(await client.query('SELECT snapshot,published_by FROM school_branding_versions WHERE id=$1',[intent.id])).rows[0];
 assert.equal(version.published_by,platform);assert.equal(version.snapshot.defaultArtworkVersion,'demo-v1');assert.deepEqual(version.snapshot.objects,[]);
 assert.deepEqual(await protectedDemoArtworkState(client),before);
 assert.deepEqual((await client.query('SELECT (SELECT count(*) FROM media_assets)::int AS assets,(SELECT count(*) FROM media_objects)::int AS objects')).rows[0],mediaBefore);
 const historic=(await client.query('SELECT id,md5(to_jsonb(v)::text) AS digest FROM school_branding_versions v WHERE id=ANY($1::uuid[]) ORDER BY id',[oldVersions.map(v=>v.id)])).rows;
 assert.deepEqual(historic,oldVersions);
 checks.push('existing begin/finish publication pins demo-v1 with no media rows, unchanged protected students/owner/memberships/pilot state and unchanged historic versions');
 return checks;
}
