import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
const [env,mode]=process.argv.slice(2);
if(!['staging','production'].includes(env)||!['check','cleanup'].includes(mode))throw new Error('Explicit environment and check/cleanup required');
const base=env==='staging'?'https://staging.mywaveplan.com':'https://mywaveplan.com';
const stateFile=`/private/tmp/mwp-request-security-${env}.json`;
const c=new pg.Client({connectionString:(await fs.readFile(`/private/tmp/mwp-security-${env}-url`,'utf8')).trim().replace('sslmode=require','sslmode=verify-full')});
await c.connect();
let state;
const save=()=>fs.writeFile(stateFile,JSON.stringify(state),{mode:0o600});
const call=async(path,{method='GET',body,cookie,headers={},marker=true,origin=base}={})=>{
 const response=await fetch(base+path,{method,headers:{...(cookie?{cookie}:{}),...(body?{'Content-Type':'application/json'}:{}),...(marker?{'X-MyWavePlan-Request':'1'}:{}),...(origin===null?{}:{Origin:origin}),...headers},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(65000)});
 return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],retry:response.headers.get('retry-after')};
};
const login=(email,password,options={})=>call('/api/auth/login',{method:'POST',body:{email,password},...options});
const keys=async()=>new Set((await c.query('SELECT key FROM auth_login_limits WHERE attempt_limit IN (10,40)')).rows.map(x=>x.key));
const collect=async(before)=>{state.keys.push(...[...await keys()].filter(k=>!before.has(k)));await save();};
let passed=0;
const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+env+': '+name);};
try {
 if(mode==='cleanup') {
  state=JSON.parse(await fs.readFile(stateFile,'utf8'));assert.equal(state.base,base);
  await c.query('BEGIN');
  if(state.school) {
    assert.equal((await c.query("SELECT id FROM schools WHERE id=$1 AND name LIKE 'Security check %' FOR UPDATE",[state.school.id])).rowCount,1);
    for(const table of ['lessons','coaches','students','users'])assert.equal((await c.query(`SELECT count(*)::int n FROM ${table} WHERE school_id=$1`,[state.school.id])).rows[0].n,0);
    await c.query('DELETE FROM schools WHERE id=$1',[state.school.id]);
  }
  assert.equal((await c.query('DELETE FROM users WHERE id=$1 AND email=$2 AND name=$3',[state.user.id,state.user.email,'Security check'])).rowCount,1);
  await c.query('COMMIT');await fs.unlink(stateFile);console.log(env+': dedicated test account and school removed; rate counters expire normally');
 } else {
  try {await fs.access(stateFile);throw new Error('Existing fixtures must be cleaned first');}catch(e){if(e.code!=='ENOENT')throw e;}
  const id=crypto.randomUUID(),password=crypto.randomBytes(24).toString('base64url'),salt=crypto.randomBytes(16);
  const hash=['msp-scrypt-v1',16384,8,1,salt.toString('base64url'),crypto.scryptSync(password,salt,64).toString('base64url')].join('$');
  state={base,password,keys:[],user:{id,email:`security-${id}@example.invalid`,username:`security-${id}`}};await save();
  await c.query("INSERT INTO users(id,name,email,username,role,password_hash) VALUES($1,'Security check',$2,$3,'platform_admin',$4)",[id,state.user.email,state.user.username,hash]);
  let admin,student;
  const beforeAdmin=await keys();
  await check('normal username login and secure session',async()=>{
    admin=await login(state.user.username,password);assert.equal(admin.status,200);assert(admin.cookie);state.cookie=admin.cookie;await collect(beforeAdmin);
    assert.equal((await call('/api/auth/session',{cookie:admin.cookie})).body.data.userId,id);
  });
  const paths=[['POST','/api/schools'],['PATCH',`/api/schools/${id}`],['POST','/api/users'],['PATCH',`/api/users/${id}`],['POST','/api/lessons'],['DELETE',`/api/lessons/${id}`],['POST',`/api/lessons/${id}/book`],['PUT',`/api/lessons/${id}/coaches`],['POST','/api/coaches'],['PUT','/api/spots'],['PUT','/api/calibration'],['DELETE','/api/auth/session'],['POST','/api/auth/login'],['POST','/api/auth/bootstrap']];
  await check('all 14 mutation handlers reject cross-origin requests before processing data',async()=>{
    for(const [method,path] of paths)assert.equal((await call(path,{method,cookie:admin.cookie,body:{},origin:'https://untrusted.example'})).status,403,path);
    assert.equal((await call('/api/auth/session',{cookie:admin.cookie})).body.data.userId,id);
  });
  await check('missing-origin simple requests, opaque origins and cross-site metadata are denied',async()=>{
    for(const options of [{origin:null,marker:false},{origin:'null'},{headers:{'Sec-Fetch-Site':'cross-site'}},{origin:base.replace('https:','http:')}])
      assert.equal((await call('/api/auth/session',{method:'DELETE',cookie:admin.cookie,...options})).status,403);
  });
  await check('same-origin browser requests work without the new marker',async()=>{
    const result=await login(state.user.username,password,{marker:false});assert.equal(result.status,200);
    assert.equal((await call('/api/auth/session',{method:'DELETE',cookie:result.cookie,marker:false})).status,200);
  });
  await check('student forecast access and permissions remain intact',async()=>{
    student=await login('teststudent','teststudent');assert.equal(student.status,200);
    assert.equal((await call('/api/spots',{cookie:student.cookie})).status,200);
    assert.equal((await call('/api/schools',{method:'POST',cookie:student.cookie,body:{name:'Must not create'}})).status,403);
    assert.equal((await call('/api/spots',{method:'PUT',cookie:student.cookie,body:{}})).status,403);
    assert.equal((await call('/api/auth/session',{method:'DELETE',cookie:student.cookie})).status,200);
    assert.equal((await call('/api/auth/session',{cookie:student.cookie})).body.data,null);
  });
  await check('authorised creation and editing work, forged edits do not change the record',async()=>{
    const result=await call('/api/schools',{method:'POST',cookie:admin.cookie,body:{name:`Security check ${id}`}});assert.equal(result.status,201);state.school=result.body.data;await save();
    const path='/api/schools/'+state.school.id;
    assert.equal((await call(path,{method:'PATCH',cookie:admin.cookie,body:{name:`Security check updated ${id}`}})).status,200);
    assert.equal((await call(path,{method:'PATCH',cookie:admin.cookie,origin:'https://untrusted.example',body:{name:'Must not change'}})).status,403);
    assert.equal((await c.query('SELECT name FROM schools WHERE id=$1',[state.school.id])).rows[0].name,`Security check updated ${id}`);
  });
  const unknown=`missing-${id}`,beforeUnknown=await keys();let missing;
  await check('existing, missing and disabled accounts share the same invalid-login error',async()=>{
    missing=await login(unknown,'wrong');await collect(beforeUnknown);
    const wrong=await login(state.user.username,'wrong');assert.equal(wrong.status,401);assert.deepEqual(wrong.body,missing.body);
    await c.query('UPDATE users SET disabled_at=now() WHERE id=$1',[id]);
    const disabled=await login(state.user.username,password);assert.equal(disabled.status,401);assert.deepEqual(disabled.body,missing.body);
    await c.query('UPDATE users SET disabled_at=NULL WHERE id=$1',[id]);
  });
  await check('ten attempts are admitted; spoofed forwarding headers cannot evade the pair limit',async()=>{
    for(let i=1;i<10;i++)assert.equal((await login(unknown,'wrong',{headers:{'X-Forwarded-For':`203.0.113.${i}`,'X-Vercel-Forwarded-For':`198.51.100.${i}`}})).status,401);
    const blocked=await login(unknown,'wrong');assert.equal(blocked.status,429);assert(Number(blocked.retry)>0&&Number(blocked.retry)<=900);
  });
  await check('expired test identifier counters recover without changing any real account limit',async()=>{
    const testKeys=[...await keys()].filter(k=>!beforeUnknown.has(k)&&state.keys.includes(k));
    assert.equal(testKeys.length,2);
    await c.query("UPDATE auth_login_limits SET expires_at=now()-interval '1 second' WHERE key=ANY($1::text[]) AND attempt_limit IN (10,40)",[testKeys]);
    assert.equal((await login(unknown,'wrong')).status,401);
  });
  // Re-enable the dedicated account for browser verification, then retain only its own session.
  admin=await login(state.user.username,password);assert.equal(admin.status,200);state.cookie=admin.cookie;await save();
  console.log(JSON.stringify({environment:env,passed,fixtureSchoolId:state.school.id}));
 }
} finally {await c.end();}
