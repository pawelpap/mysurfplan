import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { connect,fingerprint } from './membership-migration-support.mjs';
import { verifySchoolBranding } from './verify-school-branding.mjs';
const [environment,action='--audit',...flags]=process.argv.slice(2);
assert(['rehearsal','staging','production'].includes(environment));assert(['--audit','--rehearse','--apply'].includes(action));
assert(action!=='--apply'||environment==='rehearsal'||flags.includes(`--${environment}-approved`));
const id='20261111_school_branding',client=await connect(environment);
async function state(){const values=await fingerprint(client);const schools=(await client.query(`SELECT 'schools' AS name,count(*)::int AS count,
 md5(COALESCE(jsonb_agg(row ORDER BY row::text),'[]'::jsonb)::text) AS digest FROM
 (SELECT to_jsonb(s)-ARRAY['workspace_kind','workspace_status','listing_status','owner_membership_id','owner_required_status','published_branding_version_id']::text[] AS row FROM schools s) q`)).rows[0];
 return values.map(v=>v.name==='schools'?schools:v);}
try{await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='90s'");await client.query('SELECT pg_advisory_xact_lock(20261111)');
 const required=['20261111_school_locations_spots','20261111_school_media'];
 assert.equal((await client.query('SELECT count(*)::int AS n FROM identity_schema_migrations WHERE id=ANY($1::text[])',[required])).rows[0].n,2,'Apply verified stage2 dependencies first');
 const before=await state(),ddl=await fs.readFile(new URL(`../db/migrations/${id}.sql`,import.meta.url),'utf8'),checksum=createHash('sha256').update(ddl).digest('hex');
 const prior=(await client.query('SELECT checksum FROM identity_schema_migrations WHERE id=$1',[id])).rows[0];if(prior)assert.equal(prior.checksum,checksum);
 if(!prior&&action!=='--audit'){await client.query(ddl);await client.query('INSERT INTO identity_schema_migrations(id,checksum) VALUES($1,$2)',[id,checksum]);}
 let checks=[];if(action!=='--audit'){await client.query('SAVEPOINT synthetic_branding');checks=await verifySchoolBranding(client);await client.query('SET CONSTRAINTS ALL IMMEDIATE');await client.query('ROLLBACK TO SAVEPOINT synthetic_branding');assert.deepEqual(await state(),before);}
 await client.query(action==='--apply'?'COMMIT':'ROLLBACK');console.log(JSON.stringify({environment,migration:id,action,previouslyInstalled:Boolean(prior),checks,existingDataUnchanged:action!=='--audit'}));
}catch(e){await client.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({environment,migration:id,error:e.message,code:e.code}));process.exitCode=1;}finally{await client.end();}
