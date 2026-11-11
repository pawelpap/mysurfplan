import { isUuid } from './school-access.mjs';
import { BrandingInputError, brandingInput } from './school-branding.mjs';
import { createMediaStorage, mediaObjectUrl } from './media-storage.mjs';

const statusFor = error => error instanceof BrandingInputError ? 400 :
  ({'42501':403,'P0002':404,'22023':400,'22P02':400,'23514':409,'23505':409,'40001':409,'40P01':409})[error?.code] || error?.status || 503;

export function schoolBrandingHandler({ sql, requireAuth, storage = createMediaStorage({sql}) }) {
  return async (req,res) => {
    res.setHeader('Cache-Control','private, no-store');
    if (!['GET','PATCH','POST'].includes(req.method)) {
      res.setHeader('Allow','GET, PATCH, POST');return res.status(405).json({ok:false,error:'branding.unavailable'});
    }
    const session=await requireAuth(req,res);if(!session)return;
    if(session.demo)return res.status(403).json({ok:false,error:'branding.forbidden'});
    let intent;
    try {
      if(req.method==='GET') {
        if(!isUuid(req.query.schoolId))throw new BrandingInputError();
        const [row]=await sql`SELECT school_branding_json(s.id,${session.userId}::uuid) AS data FROM schools s
          WHERE s.id=${req.query.schoolId}::uuid AND account_reads_school_settings(${session.userId}::uuid,s.id)`;
        if(!row)return res.status(404).json({ok:false,error:'branding.forbidden'});
        return res.json({ok:true,data:row.data});
      }
      const input=brandingInput(req.body,req.method==='POST'?'publish':'save');
      if(req.method==='PATCH') {
        const [row]=await sql`SELECT save_school_branding(${session.userId}::uuid,${input.schoolId}::uuid,
          ${input.revision}::integer,${input.settingsRevision}::integer,${JSON.stringify(input.details)}::jsonb) AS data`;
        return res.json({ok:true,data:row.data});
      }
      const [reserved]=await sql`SELECT begin_school_publication(${session.userId}::uuid,${input.schoolId}::uuid,
        ${input.revision}::integer,${input.settingsRevision}::integer,${input.requestId}::uuid) AS intent`;
      intent=reserved.intent;
      if(intent.state!=='published') {
        const deadline=Date.now()+90000;
        const assets=[intent.snapshot.branding.logoAssetId,intent.snapshot.branding.coverAssetId,
          ...intent.snapshot.branding.gallery.map(item=>item.assetId)].filter(Boolean);
        if(assets.length)await storage.config();
        for(const assetId of assets) {
          if(Date.now()>deadline)throw new Error('Publication time budget exceeded');
          const objects=await sql`SELECT o.* FROM media_objects o JOIN media_assets a ON a.id=o.asset_id
            WHERE o.asset_id=${assetId}::uuid AND a.owner_school_id=${input.schoolId}::uuid AND a.state='ready'
            AND o.access='private' AND o.state='written' AND o.role<>'master' ORDER BY o.role`;
          if(objects.length!==2)throw new Error('Incomplete private derivatives');
          const variants=[];
          for(const object of objects)variants.push({role:object.role,bytes:await storage.readPrivateObject(object),
            byteCount:Number(object.byte_count),checksum:object.checksum,width:object.width,height:object.height});
          await storage.writeJournaledObjects(session.userId,assetId,variants,{access:'public',publicationId:intent.id});
        }
      }
      const [published]=await sql`SELECT finish_school_publication(${session.userId}::uuid,${intent.id}::uuid) AS data`;
      return res.json({ok:true,data:published.data});
    } catch(error) {
      if(intent?.state==='pending') {
        try {await sql`SELECT abort_school_publication(${session.userId}::uuid,${intent.id}::uuid)`;}catch{}
      }
      const status=statusFor(error);
      return res.status(status).json({ok:false,error:status===403?'branding.forbidden':status===409?'branding.conflict':status===400?'branding.invalid':'branding.unavailable'});
    }
  };
}

export async function publicSchoolBranding(sql,school) {
  if(typeof school!=='string'||school.length>200)return null;
  const [row]=await sql`SELECT v.id,v.version_number,v.snapshot,school_is_operational(s) AS operational
    FROM schools s JOIN school_branding_versions v ON v.id=s.published_branding_version_id AND v.school_id=s.id
    WHERE s.deleted_at IS NULL AND s.workspace_status NOT IN ('closed','suspended') AND s.listing_status='published'
    AND (v.snapshot->>'slug'=${school} OR s.id::text=${school}) LIMIT 1`;
  if(!row)return null;
  const objects=await sql`SELECT id,asset_id,role,store_id,pathname,access,state,width,height FROM media_objects
    WHERE publication_id=${row.id}::uuid AND access='public' AND state='written'`;
  const images=objects.map(object=>({assetId:object.asset_id,role:object.role,url:mediaObjectUrl(object),width:object.width,height:object.height}));
  // Only the immutable public projection is returned. No draft/settings JSON.
  return {...row.snapshot,objects:undefined,versionId:row.id,version:row.version_number,operational:row.operational,images};
}
