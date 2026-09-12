// Updates future deployments only; it does not promote a deployment or change
// SESSION_SECRET. Connection files must be private and endpoints are pinned.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const environment=process.argv[2], apply=process.argv.includes('--apply');
const projects={staging:'prj_sWC9MbvG8rWtAO0YpuSNiOqZwYlO',production:'prj_J100oKHrcYqghajndUkaEI8LDSvi'};
assert(projects[environment],'Specify staging or production');
const directory='/private/tmp/mwp-a8-private';
async function connection(name){
 const file=`${directory}/eu-${name}.url`;assert.equal((await fs.stat(file)).mode&0o077,0);
 const u=new URL((await fs.readFile(file,'utf8')).trim());
 assert.equal(u.hostname,name==='staging'?'ep-shiny-violet-b2em1q82.c-6.eu-central-1.aws.neon.tech':'ep-soft-smoke-b2v7g8iu.c-6.eu-central-1.aws.neon.tech');
 return u;
}
function api(path,method='GET',input){
 return JSON.parse(execFileSync('vercel',['api',path,'-X',method,'--scope','pawelpaps-projects','--raw',...(input?['--input',input]:[])],{maxBuffer:4e6,stdio:['ignore','pipe','pipe']}).toString());
}
async function body(name,value){const path=`${directory}/${name}.json`;await fs.writeFile(path,JSON.stringify(value),{mode:0o600});await fs.chmod(path,0o600);return path;}
try{
 const id=projects[environment],p=api(`/v9/projects/${id}`);
 await body(`${environment}-before-config`,p);
 const selected=p.env.filter(e=>['DATABASE_URL','DATABASE_URL_UNPOOLED','POSTGRES_URL','POSTGRES_URL_NON_POOLING'].includes(e.key));
 assert(selected.length>=3);
 const session=p.env.find(e=>e.key==='SESSION_SECRET'&&e.target.includes('production'));
 assert(session,'Existing session secret must remain configured');
 for(const e of process.argv.includes('--region-only')?[]:selected){
   const name=environment==='production'&&e.target.includes('production')?'production':'staging';
   const u=await connection(name);
   if(!/UNPOOLED|NON_POOLING/.test(e.key))u.hostname=u.hostname.replace('.c-6.','-pooler.c-6.');
   console.log(JSON.stringify({environment,key:e.key,targets:e.target,host:u.hostname,apply}));
   if(apply){const request=await body(`env-${e.id}`,{value:u.toString()});api(`/v9/projects/${id}/env/${e.id}`,'PATCH',request);}
 }
 if(apply){
   const request=await body(`${environment}-region`,{resourceConfig:{...p.resourceConfig,functionDefaultRegions:['fra1'],functionZeroConfigFailover:false}});
   api(`/v9/projects/${id}`,'PATCH',request);
   const after=api(`/v9/projects/${id}`);await body(`${environment}-after-config`,after);
   assert.equal(after.env.find(e=>e.id===session.id)?.updatedAt,session.updatedAt,'Session secret changed');
   assert.deepEqual(after.resourceConfig.functionDefaultRegions,['fra1']);
   console.log(JSON.stringify({environment,region:'fra1',sessionSecretPreserved:true}));
 }
}catch(e){await fs.writeFile(`${directory}/vercel-config-error.log`,e.stack+'\n'+String(e.stderr||''),{mode:0o600});console.error('Configuration failed; inspect the private error log.');process.exitCode=1;}
