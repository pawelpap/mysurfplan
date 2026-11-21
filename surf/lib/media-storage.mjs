import * as blobSdk from '@vercel/blob';
import { createHash } from 'node:crypto';

export class MediaServiceError extends Error {
  constructor(code='media.unavailable',status=503) { super(code);this.status=status; }
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const projectIds={staging:'prj_sWC9MbvG8rWtAO0YpuSNiOqZwYlO',production:'prj_J100oKHrcYqghajndUkaEI8LDSvi'};

export function mediaObjectUrl(object) {
  if(object.access!=='public'||object.state!=='written'||!/^store_[A-Za-z0-9]+$/.test(object.store_id)||!new RegExp(`^(staging|production)/public/${uuid}/${uuid}\\.webp$`).test(object.pathname))
    throw new MediaServiceError();
  return `https://${object.store_id.slice(6).toLowerCase()}.public.blob.vercel-storage.com/${object.pathname}`;
}

export function createMediaStorage({sql,env=process.env,blob=blobSdk}) {
  async function config() {
    const [row]=await sql`SELECT c.*,j.environment AS actual_environment FROM media_storage_config c CROSS JOIN job_environment j WHERE c.singleton AND j.singleton`;
    if(!row||!Object.hasOwn(projectIds,env.APP_ENVIRONMENT)||row.environment!==env.APP_ENVIRONMENT||row.actual_environment!==env.APP_ENVIRONMENT||
      !/^store_[A-Za-z0-9]+$/.test(row.private_store_id)||!/^store_[A-Za-z0-9]+$/.test(row.public_store_id)||row.private_store_id===row.public_store_id||
      row.private_store_id!==env.MEDIA_PRIVATE_STORE_ID||row.public_store_id!==env.MEDIA_PUBLIC_STORE_ID||
      (env.VERCEL_PROJECT_ID&&env.VERCEL_PROJECT_ID!==projectIds[env.APP_ENVIRONMENT])||env.BLOB_READ_WRITE_TOKEN) throw new MediaServiceError();
    // Runtime OIDC comes from the trusted Vercel request context, not necessarily
    // process.env. The SDK resolves fresh credentials and rejects missing auth.
    return row;
  }
  async function options(object,cfg) {
    if(!['private','public'].includes(object.access)||object.store_id!==(object.access==='private'?cfg.private_store_id:cfg.public_store_id)||
      object.pathname!==`${cfg.environment}/${object.access}/${object.asset_id}/${object.id}.webp`) throw new MediaServiceError();
    // The SDK resolves/refreshed runtime OIDC itself. An explicit token would
    // bypass its @vercel/oidc refresh path and freeze a short-lived credential.
    return {storeId:object.store_id,abortSignal:AbortSignal.timeout(12000)};
  }
  async function readObject(object,cfg) {
    const auth=await options(object,cfg);
    const response=await blob.get(object.pathname,{...auth,access:object.access,useCache:false});
    if(!response||response.statusCode!==200||response.blob.contentType!=='image/webp'||response.blob.size!==Number(object.byte_count)) throw new MediaServiceError();
    const reader=response.stream.getReader();const chunks=[];let size=0;
    try {
      for(;;) {const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16777216)throw new MediaServiceError();chunks.push(value);}
    } finally {await reader.cancel().catch(()=>{});}
    const bytes=Buffer.concat(chunks,size);
    if(size!==Number(object.byte_count)||hash(bytes)!==object.checksum)throw new MediaServiceError();
    return bytes;
  }
  return {
    config,
    async readPrivateObject(object) {
      if(object.access!=='private'||object.state!=='written')throw new MediaServiceError();
      try{return await readObject(object,await config());}catch{throw new MediaServiceError();}
    },
    async writeJournaledObjects(actor,asset,variants,{access='private',publicationId=null}={}) {
      const cfg=await config();
      if(!Array.isArray(variants)||!variants.length||variants.length>3)throw new MediaServiceError('media.invalidImage',400);
      const manifest=variants.map(v=>{
        if(!Buffer.isBuffer(v.bytes)||v.bytes.length!==v.byteCount||hash(v.bytes)!==v.checksum)throw new MediaServiceError('media.invalidImage',400);
        return {role:v.role,byteCount:v.byteCount,checksum:v.checksum,width:v.width,height:v.height};
      });
      const [reservation]=await sql`SELECT journal_media_objects(${actor}::uuid,${asset}::uuid,${JSON.stringify(manifest)}::jsonb,${access}::text,${publicationId}::uuid) AS objects`;
      const objects=reservation?.objects;
      if(!Array.isArray(objects)||objects.length!==variants.length)throw new MediaServiceError();
      for(const object of objects) {
        const variant=variants.find(v=>v.role===object.role);
        const auth=await options(object,cfg);
        if(object.state!=='written') {
          try {
            await blob.put(object.pathname,variant.bytes,{...auth,access:object.access,contentType:'image/webp',
              addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:60});
          } catch {
            // Immutable path replay is valid only when the recorded bytes exist.
            // Never overwrite or expose upstream diagnostics/credentials.
            await readObject({...object,state:'written'},cfg);
          }
        }
        await readObject({...object,state:'written'},cfg);
        const updated=await sql`UPDATE media_objects SET state='written',written_at=COALESCE(written_at,now())
          WHERE id=${object.id}::uuid AND state IN ('planned','written') RETURNING id`;
        if(!updated.length)throw new MediaServiceError('media.conflict',409);
        object.state='written';
      }
      return objects.map(object=>({...object,...(object.access==='public'?{url:mediaObjectUrl(object)}:{})}));
    },
    async removeJournaledObject(object) {
      const cfg=await config();const auth=await options(object,cfg);
      await blob.del(object.pathname,auth);
      const remaining=await blob.get(object.pathname,{...auth,access:object.access,useCache:false});
      if(remaining) {await remaining.stream?.cancel().catch(()=>{});throw new MediaServiceError();}
    },
    async cleanup(batch=3) {
      await config();
      if(!Number.isInteger(batch)||batch<1||batch>20)throw new MediaServiceError('media.unavailable',400);
      // Three objects fit within both the two-minute database lease and route
      // duration, including each bounded delete and origin verification.
      const bounded=Math.min(batch,3);
      const [maintenance]=await sql`SELECT school_branding_maintenance(${bounded}::integer) AS data`;
      const [claimed]=await sql`SELECT claim_media_cleanup(${bounded}::integer) AS objects`;
      let deleted=0,failed=0;
      for(const object of claimed?.objects||[]) {
        let success=false;
        try {await this.removeJournaledObject(object);success=true;deleted++;}catch{failed++;}
        await sql`SELECT finish_media_cleanup(${object.id}::uuid,${object.leaseId}::uuid,${success}::boolean)`;
      }
      return {deleted,failed,...maintenance?.data};
    },
  };
}
