import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isUuid} from '../lib/school-access.mjs';
import {retainedDemoSchoolId} from '../lib/school-artwork.mjs';

const qaAliases=new Set(['ppaplin+b5-owner@gmail.com','ppaplin+b5-recipient@gmail.com']);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const qaIdentity=user=>Boolean(user?.is_demo||user?.name?.startsWith('B5 QA ')||/@example\.invalid$/i.test(user?.email||'')||qaAliases.has(user?.email?.toLowerCase()));
export function assertRetainedDemoOperator(user,{operatorId,expectedOperatorEmail,qaUserIds}={}){
 assert(isUuid(operatorId)&&typeof expectedOperatorEmail==='string'&&Array.isArray(qaUserIds)&&qaUserIds.length<=500&&qaUserIds.every(isUuid),'Supply explicit verified operator identity and exact QA exclusion IDs');
 assert(user?.id===operatorId&&user.email===expectedOperatorEmail.trim().toLowerCase(),'Operator identity does not match the reviewed account');
 assert(user.active&&user.verified&&user.platform&&!qaIdentity(user)&&!qaUserIds.includes(operatorId),'Use an active verified retained real platform operator outside the QA cleanup set');
}
const defaultDetails=details=>details&&details.accent==='sea'&&details.logoAssetId===null&&details.coverAssetId===null&&
 details.logoAlt===''&&details.coverAlt===''&&Array.isArray(details.gallery)&&details.gallery.length===0;
const noPublicContacts=snapshot=>snapshot&&!snapshot.contactEmail&&!snapshot.contactPhone&&!snapshot.website&&
 Array.isArray(snapshot.socialLinks)&&snapshot.socialLinks.length===0&&snapshot.baseLocation===null;

export async function protectedDemoArtworkState(client){
 const row=(await client.query(`SELECT s.id,s.owner_membership_id,s.workspace_kind,s.workspace_status,s.pilot_access_status,
  md5((to_jsonb(s)-ARRAY['listing_status','published_branding_version_id','updated_at']::text[])::text) AS school_digest,
  (SELECT count(*)::int FROM school_memberships m WHERE m.school_id=s.id) AS membership_count,
  (SELECT md5(COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.id),'[]'::jsonb)::text) FROM school_memberships m WHERE m.school_id=s.id) AS membership_digest,
  (SELECT md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.membership_id,r.role),'[]'::jsonb)::text) FROM membership_roles r JOIN school_memberships m ON m.id=r.membership_id WHERE m.school_id=s.id) AS role_digest,
  (SELECT count(*)::int FROM students st WHERE st.school_id=s.id) AS student_count,
  (SELECT COALESCE(jsonb_agg(st.id ORDER BY st.id),'[]'::jsonb) FROM students st WHERE st.school_id=s.id) AS student_ids,
  (SELECT md5(COALESCE(jsonb_agg(to_jsonb(st) ORDER BY st.id),'[]'::jsonb)::text) FROM students st WHERE st.school_id=s.id) AS student_digest,
  (SELECT md5(COALESCE(jsonb_agg(to_jsonb(os) ORDER BY os.spot_id),'[]'::jsonb)::text) FROM school_operating_spots os WHERE os.school_id=s.id) AS operating_spots_digest,
  (SELECT count(*)::int FROM media_assets a WHERE a.owner_school_id=s.id) AS media_asset_count,
  (SELECT count(*)::int FROM media_objects o JOIN media_assets a ON a.id=o.asset_id WHERE a.owner_school_id=s.id) AS media_object_count
  FROM schools s WHERE s.id=$1`,[retainedDemoSchoolId])).rows[0];
 assert(row,'The registered retained Demo school is missing');return row;
}

export async function preflightRetainedDemoArtwork(client,options){
 const {environment,operatorId,expectedOperatorEmail,qaUserIds}=options;
 assert(['rehearsal','staging','production'].includes(environment),'Specify the exact environment');
 const actual=(await client.query('SELECT environment FROM job_environment WHERE singleton')).rows[0]?.environment;
 assert.equal(actual,environment==='rehearsal'?'staging':environment,'Environment mismatch');
 const operator=(await client.query(`SELECT id,name,email,is_demo,email_verified_at IS NOT NULL AS verified,
  deleted_at IS NULL AND disabled_at IS NULL AND self_closed_at IS NULL AS active,account_is_platform(id) AS platform
  FROM users WHERE id=$1`,[operatorId])).rows[0];
 assertRetainedDemoOperator(operator,{operatorId,expectedOperatorEmail,qaUserIds});
 const row=(await client.query(`SELECT s.id,s.name,s.slug,s.description,s.contact_email,s.contact_phone,s.website,s.social_links,s.settings_revision,
  s.listing_status,s.published_branding_version_id,d.revision AS draft_revision,d.details,
  school_settings_json(s,NULL)->'baseLocation' AS base_location,
  school_public_snapshot(s.id,d.details) AS preview,v.snapshot AS current_snapshot,v.published_by
  FROM schools s JOIN school_branding_drafts d ON d.school_id=s.id
  LEFT JOIN school_branding_versions v ON v.id=s.published_branding_version_id
  WHERE s.id=$1`,[retainedDemoSchoolId])).rows[0];
 assert(row,'Demo branding draft is missing');
 const protectedState=await protectedDemoArtworkState(client);
 assert.equal(protectedState.owner_membership_id,null,'Do not infer or replace Demo ownership');
 assert.equal(protectedState.membership_count,0,'Unexpected Demo memberships require review');
 assert.equal(protectedState.student_count,2,'Expected protected Demo student set requires review');
 assert.equal(protectedState.media_asset_count,0,'Existing Demo-owned media requires deliberate review');
 assert.equal(protectedState.media_object_count,0);
 const dependencies=(await client.query(`SELECT u.id,u.name,u.email,u.is_demo FROM users u WHERE u.id IN(
  SELECT actor_id FROM school_publication_intents WHERE school_id=$1 UNION
  SELECT published_by FROM school_branding_versions WHERE school_id=$1 UNION
  SELECT uploaded_by FROM media_assets WHERE owner_school_id=$1)`,[retainedDemoSchoolId])).rows;
 assert(!dependencies.some(user=>qaIdentity(user)||qaUserIds.includes(user.id)),'Demo has a QA/demo actor dependency; do not conceal or replace it');
 assert.equal(row.preview?.schoolId,retainedDemoSchoolId);assert.equal(row.preview?.demo,true);
 assert.equal(row.preview?.defaultArtworkVersion,'demo-v1','Install the reviewed Demo artwork snapshot migration first');
 if(row.current_snapshot?.defaultArtworkVersion==='demo-v1')assert(noPublicContacts(row.current_snapshot),'Demo contact/location publication requires deliberate review');
 const alreadyPublished=row.current_snapshot?.schoolId===retainedDemoSchoolId&&row.current_snapshot?.demo===true&&
  row.current_snapshot?.defaultArtworkVersion==='demo-v1'&&defaultDetails(row.current_snapshot.branding);
 if(alreadyPublished){assert.equal(row.listing_status,'published','Do not silently relist an intentionally hidden Demo version');}
 else{
  assert(defaultDetails(row.details),'Custom Demo draft branding requires deliberate review; no automatic reset');
  if(row.current_snapshot){
   assert(defaultDetails(row.current_snapshot.branding),'Custom published Demo branding requires deliberate review');
   assert([undefined,'v1'].includes(row.current_snapshot.defaultArtworkVersion),'Do not overwrite a newer or unknown dedicated Demo artwork version');
  }
  assert(!row.contact_email&&!row.contact_phone&&!row.website&&Array.isArray(row.social_links)&&!row.social_links.length,'Demo business/contact fields require review');
  const base=row.base_location;
  assert(base&&base.hasFixedBase===false&&base.publicVisible===false&&!base.address&&base.latitude===null&&base.longitude===null,'Demo must have no invented fixed base');
 }
 return{environment,operatorId,schoolId:retainedDemoSchoolId,preview:row.preview,previewHash:hash(row.preview),
  draftRevision:row.draft_revision,settingsRevision:row.settings_revision,publishedVersionId:row.published_branding_version_id,
  publishedBy:row.published_by||null,alreadyPublished,protectedState};
}

// Caller owns BEGIN/COMMIT/ROLLBACK. No actor discovery, grants, media write,
// settings reset or operational approval is performed here.
export async function publishRetainedDemoArtwork(client,options){
 assert(isUuid(options.requestId),'Record an explicit publication request UUID');
 await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[options.operatorId]);
 await client.query('SELECT id FROM schools WHERE id=$1 FOR UPDATE',[retainedDemoSchoolId]);
 await client.query('SELECT id FROM school_branding_drafts WHERE school_id=$1 FOR UPDATE',[retainedDemoSchoolId]);
 const before=await preflightRetainedDemoArtwork(client,options);
 if(before.alreadyPublished)return{...before,replayed:true,publicationId:before.publishedVersionId,protectedStateUnchanged:true};
 if(options.expectedPreviewHash!==undefined)assert.equal(before.previewHash,options.expectedPreviewHash,'Reviewed Demo preview changed');
 assert(options.rehearse===true||options.expectedPreviewHash,'Apply requires the exact reviewed preview hash');
 const intent=(await client.query('SELECT begin_school_publication($1,$2,$3,$4,$5) AS value',
  [options.operatorId,retainedDemoSchoolId,before.draftRevision,before.settingsRevision,options.requestId])).rows[0].value;
 await client.query('SELECT finish_school_publication($1,$2)',[options.operatorId,intent.id]);
 const version=(await client.query('SELECT id,school_id,snapshot,published_by FROM school_branding_versions WHERE id=$1',[intent.id])).rows[0];
 assert.equal(version.school_id,retainedDemoSchoolId);assert.equal(version.published_by,options.operatorId);
 assert.equal(version.snapshot.demo,true);assert.equal(version.snapshot.defaultArtworkVersion,'demo-v1');
 assert.deepEqual(version.snapshot.objects,[]);assert(defaultDetails(version.snapshot.branding));
 assert.deepEqual(await protectedDemoArtworkState(client),before.protectedState,'Demo protected data or operational state changed');
 return{...before,replayed:false,publicationId:version.id,publishedBy:version.published_by,protectedStateUnchanged:true,mediaRowsCreated:0};
}
