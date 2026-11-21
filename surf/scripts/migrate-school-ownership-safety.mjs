import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connect,sourceTables} from './membership-migration-support.mjs';import {verifySchoolOwnershipSafety} from './verify-school-ownership-safety.mjs';
const tables=[...sourceTables,'school_memberships','membership_roles','platform_role_assignments','school_ownership_claims','school_ownership_offers','school_ownership_acceptances','school_ownership_requests','school_ownership_notice_jobs','school_access_events','job_outbox'];
async function fingerprint(client){return(await client.query(tables.map(t=>`SELECT '${t}'AS name,count(*)::int AS count,md5(COALESCE(jsonb_agg(row ORDER BY row::text),'[]'::jsonb)::text)AS digest FROM(SELECT to_jsonb(t)AS row FROM ${t} t)rows`).join(' UNION ALL '))).rows.sort((a,b)=>a.name.localeCompare(b.name));}
const[environment,action='--rehearse',...flags]=process.argv.slice(2);assert(['rehearsal','staging','production'].includes(environment));assert(['--audit','--rehearse','--apply'].includes(action));
assert(action!=='--apply'||environment==='rehearsal'||flags.includes(`--${environment}-approved`));const id='20261111_school_ownership_safety',client=await connect(environment);
try{await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='45s'");await client.query('SELECT pg_advisory_xact_lock(20261111)');
 const base=await fs.readFile(new URL('../db/migrations/20261111_school_ownership.sql',import.meta.url),'utf8'),baseHash=createHash('sha256').update(base).digest('hex');
 assert.equal(baseHash,'6a0db274da41a7348e1a635e02b339b2514bedc9539cd8148503316676c010da');
 assert.equal((await client.query('SELECT checksum FROM identity_schema_migrations WHERE id=$1',['20261111_school_ownership'])).rows[0]?.checksum,baseHash);
 const before=await fingerprint(client),ddl=await fs.readFile(new URL(`../db/migrations/${id}.sql`,import.meta.url),'utf8'),checksum=createHash('sha256').update(ddl).digest('hex');
 const prior=(await client.query('SELECT checksum FROM identity_schema_migrations WHERE id=$1',[id])).rows[0];if(prior)assert.equal(prior.checksum,checksum);
 if(!prior&&action!=='--audit'){await client.query(ddl);await client.query('INSERT INTO identity_schema_migrations(id,checksum)VALUES($1,$2)',[id,checksum]);}
 let checks=[];if(action!=='--audit'){assert.deepEqual(await fingerprint(client),before);await client.query('SAVEPOINT ownership_safety_fixtures');checks=await verifySchoolOwnershipSafety(client);await client.query('SET CONSTRAINTS ALL IMMEDIATE');await client.query('ROLLBACK TO SAVEPOINT ownership_safety_fixtures');assert.deepEqual(await fingerprint(client),before);}
 await client.query(action==='--apply'?'COMMIT':'ROLLBACK');console.log(JSON.stringify({environment,migration:id,checksum,action,checks,existingDataUnchanged:true,originalMigrationUnchanged:true}));
}catch(e){await client.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({environment,migration:id,error:e.message,code:e.code,where:e.where,position:e.position}));process.exitCode=1;}finally{await client.end();}
