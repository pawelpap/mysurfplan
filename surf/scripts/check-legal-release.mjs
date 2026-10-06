import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomBytes, randomUUID, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { connect } from './membership-migration-support.mjs';
import { preferenceVersion,optionalPurposes } from '../lib/legal/contracts.mjs';
import { pathToFileURL } from 'node:url';

const [base,output='/private/tmp/mwp-legal-release.json'] = process.argv.slice(2);
assert(['https://staging.mywaveplan.com','http://localhost:3000'].includes(base));
const client=await connect('staging');
const userId=randomUUID(),schoolId=randomUUID(),membershipId=randomUUID(),password=randomBytes(32).toString('base64url');
const salt=randomBytes(16),key=await promisify(scrypt)(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
const passwordHash=['msp-scrypt-v1',16384,8,1,salt.toString('base64url'),key.toString('base64url')].join('$');
let cookie;
const headers={'Content-Type':'application/json','X-MyWavePlan-Request':'1',Origin:base};
const checks=[];
try {
  assert.equal((await client.query('SELECT environment FROM job_environment')).rows[0].environment,'staging');
  await client.query('BEGIN');
  await client.query(`INSERT INTO users(id,name,family_name,email,role,password_hash) VALUES($1,'Synthetic','Legal fixture',$2,'student',$3)`,[userId,`${userId}@example.invalid`,passwordHash]);
  await client.query(`INSERT INTO schools(id,name,workspace_status) VALUES($1,$2,'active')`,[schoolId,'Synthetic legal '+schoolId]);
  await client.query(`INSERT INTO school_memberships(id,user_id,school_id,status) VALUES($1,$2,$3,'active')`,[membershipId,userId,schoolId]);
  await client.query(`INSERT INTO membership_roles(membership_id,role) VALUES($1,'school_admin')`,[membershipId]);
  await client.query('COMMIT');
  // Exercise the deployed login; never assume the local signing secret matches
  // staging or export a deployment secret to fabricate authentication.
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers,body:JSON.stringify({email:`${userId}@example.invalid`,password})});
  assert.equal(login.status,200,'Synthetic fixture login');
  cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  headers.Cookie=cookie;
  const read = async path=>{
    const response=await fetch(base+path,{headers});assert.equal(response.status,200,path);return (await response.json()).data;
  };
  const post = async(body,status=200,origin=base)=>{
    const response=await fetch(base+'/api/legal/records',{method:'POST',headers:{...headers,Origin:origin},body:JSON.stringify(body)});
    assert.equal(response.status,status,body.action);return response.json();
  };
  assert.equal((await fetch(base+'/api/legal/records')).status,401);
  let records=await read('/api/legal/records');assert.equal(records.acceptances.length,0);assert.equal(records.notices.length,0);
  const doc=async id=>(await client.query('SELECT document_id,version,language,content_hash,kind FROM legal_documents WHERE document_id=$1 ORDER BY reviewed_at DESC LIMIT 1',[id])).rows[0];
  const terms=await doc('mywaveplan.adult-pilot-terms'),school=await doc('mywaveplan.school-processing');
  const body=d=>({documentId:d.document_id,version:d.version,language:d.language,contentHash:d.content_hash,accepted:true});
  const page=await fetch(base+'/legal/privacy',{headers});assert.equal(page.status,200);assert((await page.text()).includes('PAWEL PAPLINSKI'));
  records=await read('/api/legal/records');assert.equal(records.notices.length,1);assert.equal(records.acceptances.length,0);
  checks.push('notice delivery does not accept terms or enable optional purposes');
  await post({action:'notice_delivery',...body(terms)},400);
  await post({action:'accept_terms',...body(terms),accepted:false},400);
  await post({action:'accept_terms',...body(terms),language:'pt-PT'},409);
  await post({action:'accept_terms',...body(terms),contentHash:'0'.repeat(64)},409);
  assert.equal((await read('/api/auth/session')).userId,userId);
  checks.push('refused and stale acceptance leaves core account access available');
  await post({action:'accept_terms',...body(terms)},403,'https://untrusted.example');
  await post({action:'accept_terms',...body(terms),userId:randomUUID()});
  await post({action:'accept_terms',...body(terms)});
  await post({action:'accept_school',...body(school),schoolId:randomUUID(),authorisedRepresentative:true},403);
  await post({action:'accept_school',...body(school),schoolId,authorisedRepresentative:false},400);
  await post({action:'accept_school',...body(school),schoolId,authorisedRepresentative:true});
  records=await read('/api/legal/records');assert.equal(records.acceptances.length,2);
  assert(records.acceptances.every(a=>a.language==='en-GB' && a.status==='staging_preview'));
  checks.push('CSRF, subject isolation, school authority, exact version/language and idempotence');
  await post({action:'optional_preference',purpose:'analytics',selected:true,version:preferenceVersion,language:'en-GB'},409);
  for(const purpose of optionalPurposes) await post({action:'optional_preference',purpose,selected:false,version:preferenceVersion,language:'en-GB'});
  records=await read('/api/legal/records');assert(Object.values(records.preferences).every(v=>v===false));
  assert.equal(records.acceptances.length,2);assert.equal(records.notices.length,1);
  assert.equal((await read('/api/auth/session')).userId,userId);
  checks.push('independent withdrawal preserves agreements, notice and service access');
  const {chromium}=await import(pathToFileURL(process.env.MWP_PLAYWRIGHT_MODULE || '/Users/pawel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    await context.addCookies([{name:'msp_session',value:cookie.slice('msp_session='.length),url:base,httpOnly:true,secure:base.startsWith('https'),sameSite:'Lax'}]);
    const p=await context.newPage();await p.goto(base+'/legal/records');
    await p.getByRole('heading',{name:'Your legal records',exact:true}).waitFor();
    await p.getByRole('button',{name:'Keep optional purposes off',exact:true}).click();
    await p.getByRole('status').filter({hasText:'Optional purposes remain off.'}).waitFor();
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await context.close();checks.push('mobile account records and withdrawal control');
  } finally {await browser.close();}
  await client.query('UPDATE membership_roles SET revoked_at=now() WHERE membership_id=$1',[membershipId]);
  await post({action:'accept_school',...body(school),schoolId,authorisedRepresentative:true},403);
  checks.push('revoked membership permission reflected in live API');
} finally {
  await client.query('ROLLBACK').catch(()=>{});
  await client.query('BEGIN');
  for(const table of ['legal_acceptances','privacy_notice_deliveries','optional_preference_events','auth_sessions']) await client.query(`DELETE FROM ${table} WHERE user_id=$1`,[userId]);
  await client.query('DELETE FROM membership_roles WHERE membership_id=$1',[membershipId]);
  await client.query('DELETE FROM school_memberships WHERE id=$1',[membershipId]);
  await client.query('DELETE FROM users WHERE id=$1',[userId]);
  await client.query('DELETE FROM schools WHERE id=$1',[schoolId]);
  await client.query('COMMIT');
  assert.equal((await client.query('SELECT count(*)::int AS n FROM users WHERE id=$1',[userId])).rows[0].n,0);
  await client.end();
}
const result={base,checkedAt:new Date().toISOString(),checks,syntheticFixtureRemoved:true,productionUntouched:true};
await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
