// Create only this check's own sessions. Preserve and compare a valid and a
// revoked cookie across cutover without changing passwords or other sessions.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const [environment,mode]=process.argv.slice(2);
assert(['staging','production'].includes(environment));
const base=environment==='staging'?'https://staging.mywaveplan.com':'https://mywaveplan.com';
const file=`/private/tmp/mwp-a8-private/${environment}-session-continuity.json`;
async function call(path,cookie,method='GET',body){const r=await fetch(base+path,{method,headers:{'X-MyWavePlan-Request':'1',...(cookie?{cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
if(mode==='prepare'){
 const login=async()=>{const r=await call('/api/auth/login',null,'POST',{email:process.env.MWP_TEST_EMAIL,password:process.env.MWP_TEST_PASSWORD});assert.equal(r.status,200);assert(r.cookie);return r.cookie;};
 const valid=await login(),revoked=await login();assert.equal((await call('/api/auth/session',revoked,'DELETE')).status,200);
 const account=(await call('/api/auth/session',valid)).body.data;assert(account?.userId);assert.equal((await call('/api/auth/session',revoked)).body.data,null);
 await fs.writeFile(file,JSON.stringify({valid,revoked,account}),{mode:0o600});console.log(`${environment}: valid and revoked baseline cookies saved privately`);
}else if(mode==='verify'){
 assert.equal((await fs.stat(file)).mode&0o077,0);const saved=JSON.parse(await fs.readFile(file,'utf8'));
 assert.deepEqual((await call('/api/auth/session',saved.valid)).body.data,saved.account);assert.equal((await call('/api/auth/session',saved.revoked)).body.data,null);
 await call('/api/auth/session',saved.valid,'DELETE');console.log(`${environment}: existing session preserved; revoked session still rejected; own test session logged out`);
}else throw new Error('Specify prepare or verify');
