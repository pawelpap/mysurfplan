// Uses disposable accounts only. node scripts/check-session-release.mjs staging|production prepare|check|cleanup
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
const [env,mode]=process.argv.slice(2);
if(!['staging','production'].includes(env)||!['prepare','check','cleanup'].includes(mode))throw new Error('Explicit environment and mode required.');
const base=env==='staging'?'https://staging.mywaveplan.com':'https://mywaveplan.com';
const stateFile=`/private/tmp/mwp-revocation-${env}-fixtures.json`;
const c=new pg.Client({connectionString:(await fs.readFile(`/private/tmp/mwp-revocation-${env}-url`,'utf8')).trim()});await c.connect();
const call=async(path,cookie='',method='GET',body,origin)=>{
 const r=await fetch(base+path,{method,headers:{'X-MyWavePlan-Request':'1',...(cookie?{cookie}:{}),...(body?{'Content-Type':'application/json'}:{}),...(origin?{Origin:origin}:{})},body:body?JSON.stringify(body):undefined});
 return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};
};
const login=async(f,who='member',password=f.password)=>{const r=await call('/api/auth/login','','POST',{email:f[who].email,password});assert.equal(r.status,200,`login ${who}`);assert(r.cookie);assert.match(r.headers.get('set-cookie'),/HttpOnly.*SameSite=Lax.*Secure/);return r.cookie;};
let f;
try{
 if(mode==='prepare'){
  try{await fs.access(stateFile);throw new Error('Fixture file exists; clean it first.');}catch(e){if(e.code!=='ENOENT')throw e;}
  const suffix=crypto.randomUUID(),password=crypto.randomBytes(20).toString('base64url'),salt=crypto.randomBytes(16);
  const hash=['msp-scrypt-v1',16384,8,1,salt.toString('base64url'),crypto.scryptSync(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('base64url')].join('$');
  f={base,password,schools:[]};await c.query('BEGIN');
  for(let i=0;i<2;i++)f.schools.push((await c.query('INSERT INTO schools(name) VALUES($1) RETURNING id,slug',[`Session release check ${suffix} ${i}`])).rows[0]);
  for(const[who,role,school]of[['admin','platform_admin',null],['member','school_admin',f.schools[0].id],['student','student',f.schools[0].id],['outsider','school_admin',f.schools[1].id]])f[who]=(await c.query("INSERT INTO users(school_id,name,family_name,email,role,password_hash) VALUES($1,'Session','Check',$2,$3,$4) RETURNING id,email",[school,`${who}-${suffix}@example.invalid`,role,hash])).rows[0];
  await fs.writeFile(stateFile,JSON.stringify(f),{mode:0o600});await c.query('COMMIT');
  f.beforeCookie=await login(f);await fs.writeFile(stateFile,JSON.stringify(f),{mode:0o600});console.log(`${env}: disposable fixtures prepared; previous cookie captured privately.`);
 }else{
  f=JSON.parse(await fs.readFile(stateFile,'utf8'));assert.equal(f.base,base);
  if(mode==='cleanup'){
   await c.query('BEGIN');
   const ids=['admin','member','student','outsider'].map(k=>f[k].id),schoolIds=f.schools.map(s=>s.id);
   const lockedSchools=await c.query('SELECT id,name FROM schools WHERE id=ANY($1::uuid[]) FOR UPDATE',[schoolIds]);
   assert.equal(lockedSchools.rowCount,2);assert(lockedSchools.rows.every(s=>s.name.startsWith('Session release check ')));
   const lockedUsers=await c.query('SELECT id,name,family_name,email FROM users WHERE id=ANY($1::uuid[]) FOR UPDATE',[ids]);
   assert.equal(lockedUsers.rowCount,4);
   for(const who of['admin','member','student','outsider'])assert(lockedUsers.rows.some(u=>u.id===f[who].id&&u.email===f[who].email&&u.name==='Session'&&u.family_name==='Check'));
   assert.equal((await c.query('SELECT count(*)::int AS n FROM users WHERE school_id=ANY($1::uuid[]) AND NOT(id=ANY($2::uuid[]))',[schoolIds,ids])).rows[0].n,0);
   for(const table of['lessons','coaches','students'])assert.equal((await c.query(`SELECT count(*)::int AS n FROM ${table} WHERE school_id=ANY($1::uuid[])`,[schoolIds])).rows[0].n,0);
   for(const table of['coaches','students'])assert.equal((await c.query(`SELECT count(*)::int AS n FROM ${table} WHERE user_id=ANY($1::uuid[])`,[ids])).rows[0].n,0);
   for(const who of['admin','member','student','outsider'])assert.equal((await c.query('DELETE FROM users WHERE id=$1 AND email=$2',[f[who].id,f[who].email])).rowCount,1);
   for(const school of f.schools)assert.equal((await c.query('DELETE FROM schools WHERE id=$1 AND slug=$2',[school.id,school.slug])).rowCount,1);
   await c.query('COMMIT');await fs.unlink(stateFile);console.log(`${env}: disposable accounts, sessions and schools removed.`);
  }else{
   let n=0;const check=async(name,fn)=>{await fn();n++;console.log(`PASS ${env}: ${name}`);};
   const active=async(cookie)=>(await call('/api/auth/session',cookie)).data.data;
   const denied=async(cookie)=>assert.equal((await call('/api/users',cookie)).status,401);
   let admin=await login(f,'admin'),a,b,s=await login(f,'student');
   const patch=async(body)=>assert.equal((await call(`/api/users/${f.member.id}`,admin,'PATCH',body)).status,200);
   const beforePayload=JSON.parse(Buffer.from(decodeURIComponent(f.beforeCookie.split('=')[1]).split('.')[0],'base64url').toString());
   await check('pre-release cookie compatibility',async()=>{if(beforePayload.sid){assert.equal((await active(f.beforeCookie)).userId,f.member.id);}else{assert.equal(await active(f.beforeCookie),null);await denied(f.beforeCookie);}});
   await check('new session and no-store responses',async()=>{a=await login(f);b=await login(f);assert.equal((await active(a)).userId,f.member.id);assert.match((await call('/api/auth/session',a)).headers.get('cache-control'),/no-store/);});
   await check('student and cross-school permissions',async()=>{assert.equal((await call('/api/users',s)).status,403);const o=await login(f,'outsider');assert.equal((await call(`/api/users/${f.member.id}`,o)).status,403);});
   await check('single logout rejects replay and preserves a second session',async()=>{assert.equal((await call('/api/auth/session',a,'DELETE')).status,200);await denied(a);assert.equal((await active(b)).userId,f.member.id);});
   await check('invalid and cross-origin logout rejected',async()=>{assert.equal((await call('/api/auth/session?all=wrong',b,'DELETE')).status,400);assert.equal((await call('/api/auth/session?all=1',b,'DELETE',undefined,'https://example.invalid')).status,403);assert.equal((await active(b)).userId,f.member.id);});
   await check('global logout revokes both sessions, preserving other users',async()=>{a=await login(f);assert.equal((await call('/api/auth/session?all=1',b,'DELETE',undefined,base)).status,200);await denied(a);await denied(b);assert.equal((await active(s)).userId,f.student.id);});
   await check('role changes apply without a new login',async()=>{a=await login(f);await patch({role:'student'});assert.equal((await active(a)).role,'student');assert.equal((await call('/api/users',a)).status,403);await patch({role:'school_admin'});assert.equal((await call('/api/users',a)).status,200);});
   await check('school scope changes apply without a new login',async()=>{await patch({school:f.schools[1].id});assert.equal((await active(a)).schoolId,f.schools[1].id);assert.equal((await call(`/api/users/${f.student.id}`,a)).status,403);await patch({school:f.schools[0].id});});
   await check('disable and re-enable never restore an old cookie',async()=>{await patch({disabled:true});await denied(a);assert.equal((await call('/api/auth/login','','POST',{email:f.member.email,password:f.password})).status,401);await patch({disabled:false});await denied(a);a=await login(f);});
   await check('password change invalidates existing sessions',async()=>{const next=crypto.randomBytes(20).toString('base64url');await patch({password:next});await denied(a);assert.equal((await call('/api/auth/login','','POST',{email:f.member.email,password:f.password})).status,401);a=await login(f,'member',next);});
   await check('deactivation immediately blocks existing sessions',async()=>{assert.equal((await call(`/api/users/${f.member.id}`,admin,'DELETE')).status,200);await denied(a);assert.equal(await active(a),null);});
   await check('self-disable and unauthenticated global logout rejected',async()=>{assert.equal((await call(`/api/users/${f.admin.id}`,admin,'PATCH',{disabled:true})).status,400);assert.equal((await call('/api/auth/session?all=1','','DELETE')).status,401);});
   await check('student still reads spots and forecast',async()=>{const spots=await call('/api/spots',s);assert.equal(spots.status,200);assert(spots.data.data.length>0);const r=await call(`/api/conditions?spot=${encodeURIComponent(spots.data.data[0].id)}`,s);assert.equal(r.status,200);assert(r.data.data);});
   await call('/api/auth/session?all=1',admin,'DELETE');await call('/api/auth/session',s,'DELETE');console.log(`${env}: ${n} deployed API checks passed.`);
  }
 }
}finally{await c.query('ROLLBACK').catch(()=>{});await c.end();}
