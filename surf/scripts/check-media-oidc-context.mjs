import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createMediaStorage} from '../lib/media-storage.mjs';
const require=createRequire(new URL('../package.json',import.meta.url));
const {MockAgent,setGlobalDispatcher}=require('undici');
// Run as a separate process. Clear only that process's credential sources;
// no real credentials are read, saved or printed.
for(const key of ['VERCEL_OIDC_TOKEN','VERCEL_OIDC_TOKEN_FILE','BLOB_READ_WRITE_TOKEN'])delete process.env[key];
const token=n=>[Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,sub:'synthetic-review-'+n})).toString('base64url'),'test-signature'].join('.');
let activeToken=token(1),reads=0;
globalThis[Symbol.for('@vercel/request-context')]={get:()=>({headers:{'x-vercel-oidc-token':activeToken}})};
const mock=new MockAgent();mock.disableNetConnect();setGlobalDispatcher(mock);
const bytes=Buffer.from('sanitised synthetic image bytes');
const cfg={environment:'staging',actual_environment:'staging',private_store_id:'store_Private',public_store_id:'store_Public'};
const env={APP_ENVIRONMENT:'staging',MEDIA_PRIVATE_STORE_ID:'store_Private',MEDIA_PUBLIC_STORE_ID:'store_Public'};
const asset='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const object={id,asset_id:asset,access:'private',role:'w128',store_id:'store_Private',pathname:`staging/private/${asset}/${id}.webp`,byte_count:bytes.length,checksum:createHash('sha256').update(bytes).digest('hex'),state:'written'};
const storage=createMediaStorage({sql:async()=>[cfg],env});
try{
 for(let n=1;n<=2;n++){
  activeToken=token(n);
  mock.get('https://private.private.blob.vercel-storage.com').intercept({path:`/${object.pathname}?cache=0`,method:'GET',headers:{authorization:`Bearer ${activeToken}`}}).reply(200,bytes,{headers:{'content-type':'image/webp','content-length':String(bytes.length)}});
  assert.deepEqual(await storage.readPrivateObject(object),bytes);reads++;
 }
 for(const patch of [{APP_ENVIRONMENT:'production'},{MEDIA_PRIVATE_STORE_ID:'store_Other'},{VERCEL_PROJECT_ID:'wrong'},{BLOB_READ_WRITE_TOKEN:'synthetic-prohibited'}])
  await assert.rejects(createMediaStorage({sql:async()=>[cfg],env:{...env,...patch}}).readPrivateObject(object),/media.unavailable/);
 mock.assertNoPendingInterceptors();
 console.log({passed:true,interceptedReads:reads,networkDisabled:true,scopeChecksPreserved:true});
}finally{await mock.close();}
