import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connect,sourceTables} from './membership-migration-support.mjs';import {verifySchoolOwnership} from './verify-school-ownership.mjs';
export async function ownershipSourceFingerprint(client){
 return(await client.query(sourceTables.map(t=>`SELECT '${t}' AS name,count(*)::int AS count,md5(COALESCE(jsonb_agg(row ORDER BY row::text),'[]'::jsonb)::text)AS digest FROM(SELECT to_jsonb(t)-ARRAY[${t==='schools'?"'ownership_revision','explicit_owner_required_status'":''}]::text[] AS row FROM ${t} t)rows`).join(' UNION ALL '))).rows.sort((a,b)=>a.name.localeCompare(b.name));
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
 const[environment,action='--rehearse',...flags]=process.argv.slice(2);assert(['rehearsal','staging','production'].includes(environment));assert(['--audit','--rehearse','--apply'].includes(action));
 assert(action!=='--apply'||environment==='rehearsal'||flags.includes(`--${environment}-approved`));const id='20261111_school_ownership',client=await connect(environment);
 try{await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='45s'");await client.query('SELECT pg_advisory_xact_lock(20261111)');const before=await ownershipSourceFingerprint(client);
  const ddl=await fs.readFile(new URL(`../db/migrations/${id}.sql`,import.meta.url),'utf8'),checksum=createHash('sha256').update(ddl).digest('hex');
  const prior=(await client.query('SELECT checksum FROM identity_schema_migrations WHERE id=$1',[id])).rows[0];if(prior)assert.equal(prior.checksum,checksum);
  if(!prior&&action!=='--audit'){await client.query(ddl);await client.query('INSERT INTO identity_schema_migrations(id,checksum)VALUES($1,$2)',[id,checksum]);}
  let checks=[];if(action!=='--audit'){assert.deepEqual(await ownershipSourceFingerprint(client),before);await client.query('SAVEPOINT ownership_fixtures');checks=await verifySchoolOwnership(client);await client.query('SET CONSTRAINTS ALL IMMEDIATE');await client.query('ROLLBACK TO SAVEPOINT ownership_fixtures');assert.deepEqual(await ownershipSourceFingerprint(client),before);}
  await client.query(action==='--apply'?'COMMIT':'ROLLBACK');console.log(JSON.stringify({environment,migration:id,checksum,action,checks,existingDataUnchanged:true}));
 }catch(e){await client.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({environment,migration:id,error:e.message,code:e.code,where:e.where,position:e.position}));process.exitCode=1;}finally{await client.end();}
}
