import { createHash } from 'node:crypto';
import { MEDIA_LIMITS,MediaInputError,processMediaImage } from './image-media.mjs';
import * as imageMedia from './image-media.mjs';
import { isUuid } from './school-access.mjs';
import { createMediaStorage,MediaServiceError } from './media-storage.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const failure=(res,error)=>{
  const status=error instanceof MediaServiceError?error.status:error instanceof MediaInputError?400:
    ({'42501':403,'22023':400,'23514':409,'23505':409,'40001':409,'40P01':409,'P0003':429,'P0002':404})[error?.code]||503;
  return res.status(status).json({ok:false,error:error instanceof MediaServiceError||error instanceof MediaInputError?error.message:
    status===403?'media.forbidden':status===409?'media.conflict':status===429?'media.quota':'media.unavailable'});
};
export function mediaUploadOptions(header) {
  if(typeof header!=='string'||header.length>2000)throw new MediaServiceError('media.invalidImage',400);
  let input;try{input=JSON.parse(header);}catch{throw new MediaServiceError('media.invalidImage',400);}
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['requestId','purpose','schoolId','revision','crop','replaceAssetId'].includes(k))||
    !isUuid(input.requestId)||!['profile','logo','cover','gallery'].includes(input.purpose)||
    (input.revision!==undefined&&(!Number.isSafeInteger(input.revision)||input.revision<1||input.revision>2147483647))||
    (input.purpose==='profile'?input.schoolId!==undefined||!Number.isSafeInteger(input.revision)||input.revision<1||input.revision>2147483647:!isUuid(input.schoolId))||
    (input.replaceAssetId!==undefined&&!isUuid(input.replaceAssetId)))throw new MediaServiceError('media.invalidImage',400);
  const crop=input.crop??{zoom:1,x:50,y:50};
  if(!crop||typeof crop!=='object'||Array.isArray(crop)||Object.keys(crop).some(k=>!['zoom','x','y'].includes(k))||
    !Number.isFinite(crop.zoom)||crop.zoom<1||crop.zoom>4||!Number.isFinite(crop.x)||crop.x<0||crop.x>100||!Number.isFinite(crop.y)||crop.y<0||crop.y>100)
    throw new MediaServiceError('media.invalidCrop',400);
  return {...input,requestId:input.requestId.toLowerCase(),schoolId:input.schoolId?.toLowerCase(),replaceAssetId:input.replaceAssetId?.toLowerCase(),crop};
}
export async function readMediaUpload(req) {
  const type=req.headers['content-type'];
  if(!['image/jpeg','image/png','image/webp'].includes(type))throw new MediaServiceError('media.unsupportedFormat',400);
  const declared=req.headers['content-length'];
  if(declared!==undefined&&(!/^\d+$/.test(declared)||Number(declared)>MEDIA_LIMITS.inputBytes))throw new MediaServiceError('media.fileTooLarge',413);
  const chunks=[];let size=0;
  for await(const chunk of req) {size+=chunk.length;if(size>MEDIA_LIMITS.inputBytes)throw new MediaServiceError('media.fileTooLarge',413);chunks.push(chunk);}
  if(!size)throw new MediaServiceError('media.invalidImage',400);
  return {bytes:Buffer.concat(chunks,size),contentType:type};
}

export function mediaHandlers({sql,requireAuth,env=process.env,storage=createMediaStorage({sql,env}),processor=processMediaImage,
  trustedProcessor=(bytes,options)=>{if(typeof imageMedia.processSanitisedMaster!=='function')throw new MediaServiceError();return imageMedia.processSanitisedMaster(bytes,options);}}) {
  const auth=async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
    const session=await requireAuth(req,res);if(!session)return null;
    if(session.demo){res.status(403).json({ok:false,error:'media.forbidden'});return null;}return session;
  };
  async function performUpload(session,input,bytes,contentType,process,sourceAssetId=null) {
    let assetId;
    try {
      const sourceHash=hash(bytes);
      const fingerprint=hash(JSON.stringify({sourceHash,contentType,purpose:input.purpose,schoolId:input.schoolId||null,revision:input.revision||null,crop:input.crop,replacing:input.replaceAssetId||null,sourceAssetId}));
      const [reserved]=await sql`SELECT reserve_media_upload(${session.userId}::uuid,${input.schoolId||null}::uuid,${input.purpose}::text,${input.requestId}::uuid,
        ${fingerprint}::text,${sourceHash}::text,${input.revision||null}::integer,${input.replaceAssetId||null}::uuid) AS asset`;
      assetId=reserved?.asset?.id;if(!assetId)throw new MediaServiceError();
      if(reserved.asset.state==='ready') {
        const [prior]=await sql`SELECT finish_media_asset(${session.userId}::uuid,${assetId}::uuid,${reserved.asset.source_width}::integer,${reserved.asset.source_height}::integer) AS data`;
        return {status:200,data:prior.data};
      }
      const processed=await process(bytes,{contentType,purpose:input.purpose,crop:input.crop});
      await storage.writeJournaledObjects(session.userId,assetId,processed.variants);
      const [finished]=await sql`SELECT finish_media_asset(${session.userId}::uuid,${assetId}::uuid,${processed.sourceWidth}::integer,${processed.sourceHeight}::integer) AS data`;
      return {status:201,data:finished.data};
    }catch(error) {
      if(assetId) {
        await sql`SELECT fail_media_upload(${session.userId}::uuid,${assetId}::uuid)`.catch(()=>{});
        await storage.cleanup(3).catch(()=>{});
      }
      throw error;
    }
  }
  return {
    async upload(req,res) {
      if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'media.unavailable'});}
      const session=await auth(req,res);if(!session)return;
      try {
        const input=mediaUploadOptions(req.headers['x-media-options']);
        // Check access before buffering/decoding attacker-controlled image data.
        const [allowed]=await sql`SELECT EXISTS(SELECT 1 FROM users WHERE id=${session.userId}::uuid AND deleted_at IS NULL AND disabled_at IS NULL
          AND self_closed_at IS NULL AND NOT is_demo AND email_verified_at IS NOT NULL) AND
          (${input.schoolId||null}::uuid IS NULL OR account_edits_school_settings(${session.userId}::uuid,${input.schoolId||null}::uuid)) AS allowed`;
        if(!allowed?.allowed)throw new MediaServiceError('media.forbidden',403);
        await storage.config();
        const {bytes,contentType}=await readMediaUpload(req);
        const result=await performUpload(session,input,bytes,contentType,processor);
        return res.status(result.status).json({ok:true,data:result.data});
      }catch(error){return failure(res,error);}
    },
    async recrop(req,res) {
      if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'media.unavailable'});}
      const session=await auth(req,res);if(!session)return;
      try {
        const body=req.body;
        if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['assetId','requestId','crop','revision'].includes(k))||
          !isUuid(body.assetId)||!isUuid(body.requestId)||!Object.hasOwn(body,'crop'))throw new MediaServiceError('media.invalidImage',400);
        const [source]=await sql`SELECT to_jsonb(a) AS asset,to_jsonb(o) AS object FROM media_assets a JOIN media_objects o ON o.asset_id=a.id
          WHERE a.id=${body.assetId}::uuid AND a.state='ready' AND o.access='private' AND o.role='master' AND o.state='written'
          AND EXISTS(SELECT 1 FROM users WHERE id=${session.userId}::uuid AND deleted_at IS NULL AND disabled_at IS NULL AND self_closed_at IS NULL AND NOT is_demo)
          AND (a.owner_user_id=${session.userId}::uuid OR (a.owner_school_id IS NOT NULL AND account_edits_school_settings(${session.userId}::uuid,a.owner_school_id)))`;
        if(!source)throw new MediaServiceError('media.notFound',404);
        const input=mediaUploadOptions(JSON.stringify({requestId:body.requestId,purpose:source.asset.purpose,
          ...(source.asset.owner_school_id?{schoolId:source.asset.owner_school_id}:{revision:body.revision}),
          crop:body.crop,replaceAssetId:body.assetId}));
        const bytes=await storage.readPrivateObject(source.object);
        const result=await performUpload(session,input,bytes,'image/webp',trustedProcessor,body.assetId);
        return res.status(result.status).json({ok:true,data:result.data});
      }catch(error){return failure(res,error);}
    },
    async profile(req,res) {
      if(!['GET','DELETE'].includes(req.method)){res.setHeader('Allow','GET, DELETE');return res.status(405).json({ok:false,error:'media.unavailable'});}
      const session=await auth(req,res);if(!session)return;
      try {
        if(req.method==='GET') {const [row]=await sql`SELECT media_profile_json(${session.userId}::uuid) AS data`;return res.json({ok:true,data:row?.data});}
        if(!req.body||Object.keys(req.body).some(k=>k!=='revision')||!Number.isSafeInteger(req.body.revision)||req.body.revision<1||req.body.revision>2147483647)
          throw new MediaServiceError('media.invalidImage',400);
        const [row]=await sql`SELECT remove_personal_photo(${session.userId}::uuid,${req.body.revision}::integer) AS data`;
        return res.json({ok:true,data:row.data});
      }catch(error){return failure(res,error);}
    },
    async image(req,res) {
      if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({ok:false,error:'media.unavailable'});}
      const session=await auth(req,res);if(!session)return;
      try {
        const {id,variant}=req.query;
        if(!isUuid(id)||variant!==undefined&&!['master','w128','w384','w512','w600','w800','w1200','w1600'].includes(variant))throw new MediaServiceError('media.notFound',404);
        const [object]=await sql`SELECT o.* FROM media_objects o JOIN media_assets a ON a.id=o.asset_id WHERE a.id=${id}::uuid AND a.state='ready'
          AND o.access='private' AND o.state='written' AND o.role=COALESCE(${variant||null}::text,CASE a.purpose WHEN 'profile' THEN 'w384' WHEN 'logo' THEN 'w512' WHEN 'cover' THEN 'w1600' ELSE 'w1200' END)
          AND EXISTS(SELECT 1 FROM users WHERE id=${session.userId}::uuid AND deleted_at IS NULL AND disabled_at IS NULL AND self_closed_at IS NULL AND NOT is_demo)
          AND ((a.owner_user_id=${session.userId}::uuid) OR (a.owner_school_id IS NOT NULL AND account_reads_school_settings(${session.userId}::uuid,a.owner_school_id)))`;
        if(!object)throw new MediaServiceError('media.notFound',404);
        const bytes=await storage.readPrivateObject(object);
        res.setHeader('Content-Type','image/webp');res.setHeader('Content-Length',bytes.length);
        res.setHeader('Content-Disposition','inline');return res.status(200).end(bytes);
      }catch(error){return failure(res,error);}
    },
    async maintenance(req,res) {
      if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'media.unavailable'});}
      const session=await auth(req,res);if(!session)return;
      try {
        const [actor]=await sql`SELECT account_is_platform(${session.userId}::uuid) AS allowed`;
        if(!actor?.allowed)throw new MediaServiceError('media.forbidden',403);
        return res.json({ok:true,data:await storage.cleanup(10)});
      }catch(error){return failure(res,error);}
    },
  };
}
